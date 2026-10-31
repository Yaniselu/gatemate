package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;

import app.gatemate.assistant.AssistantService;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripDtos;
import app.gatemate.trip.TripService;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Velo on Gemini (only a Gemini key configured), against a stand-in for the Gemini API that streams the same
 * server-sent events: a turn that calls a tool, then a turn that writes the answer, then a quota error.
 */
@SpringBootTest
@ActiveProfiles("test")
class GeminiAssistantTest {
    static final HttpServer api;
    static final List<String> bodies = new CopyOnWriteArrayList<>();
    static final List<String> paths = new CopyOnWriteArrayList<>();
    static final List<String> keys = new CopyOnWriteArrayList<>();
    static final AtomicInteger calls = new AtomicInteger();
    static volatile String tripId = "";

    static {
        try {
            api = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        api.createContext("/v1beta/models/", ex -> {
            bodies.add(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            paths.add(ex.getRequestURI().toString());
            keys.add(String.valueOf(ex.getRequestHeaders().getFirst("x-goog-api-key")));
            int n = calls.incrementAndGet();
            if (n == 1) { // this model takes a thinking budget, not a level
                reply(ex, 400, "{\"error\":{\"code\":400,\"message\":\"Unknown name \\\"thinkingLevel\\\" at 'generation_config.thinking_config'\"}}");
            } else if (n == 2) {
                reply(ex, 200, toolTurn());
            } else if (n == 3) {
                reply(ex, 200, answerTurn());
            } else if (n == 4) { // this model is overloaded…
                reply(ex, 503, "{\n  \"error\": {\"code\": 503, \"status\": \"UNAVAILABLE\", \"message\": \"The model is overloaded.\"}\n}");
            } else if (n == 5) { // …the next one answers
                reply(ex, 200, answerTurn());
            } else if (n <= 8) { // every remaining model is out of quota
                reply(ex, 429, "{\"error\":{\"code\":429,\"status\":\"RESOURCE_EXHAUSTED\"}}");
            } else { // never answers within the timeout
                try {
                    Thread.sleep(6000);
                } catch (InterruptedException ignored) {
                    // test over
                }
                reply(ex, 200, "{}");
            }
        });
        api.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        api.start();
    }

    static void reply(com.sun.net.httpserver.HttpExchange ex, int status, String body) throws IOException {
        byte[] out = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, out.length);
        ex.getResponseBody().write(out);
        ex.close();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("gatemate.assistant.api-key", () -> "");
        r.add("gatemate.assistant.gemini-key", () -> "gemini-test-key");
        r.add("gatemate.assistant.gemini-timeout-seconds", () -> "2");
        r.add("gatemate.assistant.gemini-base-url", () -> "http://127.0.0.1:" + api.getAddress().getPort());
    }

    @AfterAll
    static void stop() {
        api.stop(0);
    }

    @Autowired AssistantService assistant;
    @Autowired UserRepository users;
    @Autowired TripService trips;
    @Autowired Repos.Checklist checklist;
    @Autowired JsonMapper json;

    @Test
    void geminiRunsTheSameAgentLoop() {
        assertThat(assistant.enabled()).isTrue();
        var u = user();
        var trip = trips.addManualFlight(u.id, new TripDtos.NewFlight("RO", "TAROM", "301", LocalDate.now().plusDays(5) + "T08:00:00", "CRA", "BCN", null, null, null));
        tripId = trip.id();

        List<Map<String, Object>> events = new ArrayList<>();
        assistant.chat(u.id, List.of(new AssistantService.Turn("assistant", "Hi, I'm Velo!"),
                new AssistantService.Turn("user", "Pregătește-mi lista pentru Barcelona")), events::add);

        assertThat(events).anySatisfy(e -> assertThat(e).containsEntry("type", "tool").containsEntry("name", "add_checklist_items"));
        assertThat(events).anySatisfy(e -> assertThat(e).containsEntry("type", "tool_done").containsEntry("ok", true));
        assertThat(events).anySatisfy(e -> assertThat(e).containsEntry("type", "action").containsEntry("tripId", tripId));
        String text = events.stream().filter(e -> "delta".equals(e.get("type"))).map(e -> (String) e.get("text")).reduce("", String::concat);
        assertThat(text).isEqualTo("Am adăugat **2 lucruri** în listă.");
        assertThat(events.get(events.size() - 1)).containsEntry("type", "done");
        var labels = checklist.findByTripIdOrderByPosition(UUID.fromString(tripId)).stream().map(c -> c.label).toList();
        assertThat(labels).contains("Adaptor priză tip F", "Euro cash");

        // The first request asked for a low thinking level; refused, the same turn went out with a thinking budget.
        assertThat(json.readTree(bodies.get(0)).path("generationConfig").path("thinkingConfig").path("thinkingLevel").asString()).isEqualTo("low");
        assertThat(json.readTree(bodies.get(1)).path("generationConfig").path("thinkingConfig").path("thinkingBudget").asInt()).isZero();

        // First request: streaming endpoint, key in a header (never in the URL), Gemini-style tool schemas.
        assertThat(paths.get(0)).isEqualTo("/v1beta/models/gemini-flash-lite-latest:generateContent");
        assertThat(keys.get(0)).isEqualTo("gemini-test-key");
        JsonNode first = json.readTree(bodies.get(1));
        String decl = first.path("tools").get(0).path("functionDeclarations").toString();
        assertThat(decl).contains("\"add_checklist_items\"").contains("\"OBJECT\"").contains("\"ARRAY\"").doesNotContain("additionalProperties").doesNotContain("maxItems");
        String system = first.path("systemInstruction").toString();
        assertThat(system).contains("powered by Google Gemini").contains("can't search the web").contains("Context from Gatemate").doesNotContain("Use web search");
        assertThat(first.path("contents").get(0).path("role").asString()).isEqualTo("user"); // the app's greeting isn't sent
        assertThat(bodies.get(1)).doesNotContain(u.email);

        // Second request: the model's call echoed back with its thought signature, then the tool's result.
        String echoed = json.readTree(bodies.get(2)).path("contents").toString();
        assertThat(bodies.get(2)).contains("thinkingBudget"); // the accepted setting is kept
        assertThat(echoed).contains("\"functionCall\"").contains("sig-123").contains("\"functionResponse\"").contains("\"id\":\"call-1\"").contains("Euro cash");

        // Quota exhausted on Google's side: the app gets "busy", not a crash.
        // Overloaded model: the same turn is answered by the next model, which is then kept.
        List<Map<String, Object>> retried = new ArrayList<>();
        assistant.chat(u.id, List.of(new AssistantService.Turn("user", "Salut")), retried::add);
        assertThat(retried.get(retried.size() - 1)).containsEntry("type", "done");
        assertThat(paths.get(3)).contains("/gemini-flash-lite-latest:");
        assertThat(paths.get(4)).contains("/gemini-flash-latest:");

        List<Map<String, Object>> later = new ArrayList<>();
        assistant.chat(u.id, List.of(new AssistantService.Turn("user", "Și vremea?")), later::add);
        assertThat(later).containsExactly(Map.of("type", "error", "message", "busy"));

        // Google doesn't answer in time: the traveller gets an error, not an endless spinner.
        List<Map<String, Object>> stuck = new ArrayList<>();
        long t0 = System.currentTimeMillis();
        assistant.chat(u.id, List.of(new AssistantService.Turn("user", "Ce fac?")), stuck::add);
        assertThat(System.currentTimeMillis() - t0).isLessThan(4500);
        assertThat(stuck.get(stuck.size() - 1)).containsEntry("type", "error").containsEntry("message", "unavailable");
    }

    private UserEntity user() {
        var u = new UserEntity();
        u.email = "velo-gemini+" + UUID.randomUUID() + "@example.com";
        u.displayName = "Ana Popescu";
        u.provider = "password";
        u.avatarColor = "#123456";
        u.lang = "ro";
        u.homeAirport = "CRA";
        u.legalFirstName = "Ana";
        u.legalLastName = "Popescu";
        u.importToken = UUID.randomUUID().toString().replace("-", "");
        return users.save(u);
    }

    private static String toolTurn() {
        String args = "{\"trip_id\":\"" + tripId + "\",\"items\":[{\"label\":\"Adaptor priză tip F\",\"category\":\"packing\"},{\"label\":\"Euro cash\",\"category\":\"tasks\"}]}";
        return "{\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"functionCall\":{\"id\":\"call-1\",\"name\":\"add_checklist_items\",\"args\":" + args
                + "},\"thoughtSignature\":\"sig-123\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-test\"}";
    }

    private static String answerTurn() {
        return "{\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"Am adăugat **2 lucruri** în listă.\"}]},\"finishReason\":\"STOP\"}]}";
    }
}
