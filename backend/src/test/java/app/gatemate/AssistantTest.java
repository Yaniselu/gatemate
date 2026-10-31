package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.gatemate.assistant.AssistantService;
import app.gatemate.common.ApiException;
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

@SpringBootTest
@ActiveProfiles("test")
class AssistantTest {
    static final HttpServer api;
    static final List<String> bodies = new CopyOnWriteArrayList<>();
    static final List<String> betas = new CopyOnWriteArrayList<>();
    static final AtomicInteger calls = new AtomicInteger();
    static volatile String tripId = "";

    static {
        try {
            api = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        api.createContext("/v1/messages", ex -> {
            bodies.add(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            betas.add(String.valueOf(ex.getRequestHeaders().getFirst("anthropic-beta")));
            String sse = calls.incrementAndGet() == 1 ? toolTurn() : answerTurn();
            byte[] out = sse.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "text/event-stream");
            ex.sendResponseHeaders(200, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        api.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("gatemate.assistant.api-key", () -> "test-key");
        r.add("gatemate.assistant.base-url", () -> "http://127.0.0.1:" + api.getAddress().getPort());
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
    void agentCallsToolsStreamsTheAnswerAndActsOnTheTrip() {
        var u = user();
        var trip = trips.addManualFlight(u.id, new TripDtos.NewFlight("RO", "TAROM", "301", LocalDate.now().plusDays(5) + "T08:00:00", "OTP", "CDG", null, null, null));
        tripId = trip.id();

        List<Map<String, Object>> events = new ArrayList<>();
        assistant.chat(u.id, List.of(new AssistantService.Turn("assistant", "Hi, I'm Velo!"),
                new AssistantService.Turn("user", "Pregătește-mi lista pentru Paris")), events::add);

        assertThat(events).anySatisfy(e -> assertThat(e).containsEntry("type", "tool").containsEntry("name", "add_checklist_items"));
        assertThat(events).anySatisfy(e -> assertThat(e).containsEntry("type", "tool_done").containsEntry("ok", true));
        assertThat(events).anySatisfy(e -> assertThat(e).containsEntry("type", "action").containsEntry("tripId", tripId));
        String text = events.stream().filter(e -> "delta".equals(e.get("type"))).map(e -> (String) e.get("text")).reduce("", String::concat);
        assertThat(text).isEqualTo("Am adăugat **2 lucruri** în listă.");
        assertThat(events.get(events.size() - 1)).containsEntry("type", "done");

        var labels = checklist.findByTripIdOrderByPosition(UUID.fromString(tripId)).stream().map(c -> c.label).toList();
        assertThat(labels).contains("Adaptor priză tip E", "Euro cash");

        JsonNode first = json.readTree(bodies.get(0));
        assertThat(first.path("model").asString()).isEqualTo("claude-opus-5-5");
        assertThat(first.path("fallbacks").asString()).isEqualTo("default");
        assertThat(betas.get(0)).contains("server-side-fallback-2026-07-01");
        assertThat(first.path("system").get(0).path("cache_control").path("type").asString()).isEqualTo("ephemeral");
        assertThat(first.path("output_config").path("effort").asString()).isEqualTo("low");
        assertThat(first.path("tools").toString()).contains("web_search_20260209").contains("\"eager_input_streaming\":true");
        JsonNode msgs = first.path("messages");
        assertThat(msgs.get(0).path("role").asString()).isEqualTo("user");
        assertThat(msgs.get(msgs.size() - 1).path("role").asString()).isEqualTo("system");
        assertThat(msgs.get(msgs.size() - 1).path("content").toString()).contains("Context from Gatemate").contains("Romanian");
        assertThat(bodies.get(0)).doesNotContain(u.email);

        JsonNode second = json.readTree(bodies.get(1));
        String echoed = second.path("messages").toString();
        assertThat(echoed).contains("\"tool_use\"").contains("toolu_1").contains("\"tool_result\"").contains("Euro cash");
    }

    @Test
    void dailyAllowanceIsEnforced() {
        var u = user();
        for (int i = 0; i < 20; i++) assistant.reserve(u.id);
        assertThatThrownBy(() -> assistant.reserve(u.id)).isInstanceOf(ApiException.class).hasMessageContaining("Gatemate Pro");
        assertThat(assistant.status(u.id).used()).isEqualTo(20);
    }

    private UserEntity user() {
        var u = new UserEntity();
        u.email = "velo+" + UUID.randomUUID() + "@example.com";
        u.displayName = "Ana Popescu";
        u.provider = "password";
        u.avatarColor = "#123456";
        u.lang = "ro";
        u.homeAirport = "OTP";
        u.legalFirstName = "Ana";
        u.legalLastName = "Popescu";
        u.importToken = UUID.randomUUID().toString().replace("-", "");
        return users.save(u);
    }

    private static String toolTurn() {
        String input = "{\"trip_id\": \"" + tripId + "\", \"items\": [{\"label\": \"Adaptor priză tip E\", \"category\": \"packing\"}, {\"label\": \"Euro cash\", \"category\": \"tasks\"}]}";
        String half = input.substring(0, 30), rest = input.substring(30);
        return event("message_start", "{\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-opus-5-5\","
                + "\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":900,\"output_tokens\":1,\"cache_read_input_tokens\":0,\"cache_creation_input_tokens\":0}}}")
                + event("content_block_start", "{\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"fallback\",\"from\":{\"model\":\"claude-opus-5-5\"},\"to\":{\"model\":\"claude-opus-5\"}}}")
                + event("content_block_stop", "{\"type\":\"content_block_stop\",\"index\":0}")
                + event("content_block_start", "{\"type\":\"content_block_start\",\"index\":1,\"content_block\":{\"type\":\"tool_use\",\"id\":\"toolu_1\",\"name\":\"add_checklist_items\",\"input\":{}}}")
                + event("content_block_delta", "{\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":" + quote(half) + "}}")
                + event("content_block_delta", "{\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":" + quote(rest) + "}}")
                + event("content_block_stop", "{\"type\":\"content_block_stop\",\"index\":1}")
                + event("message_delta", "{\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":60}}")
                + event("message_stop", "{\"type\":\"message_stop\"}");
    }

    private static String answerTurn() {
        return event("message_start", "{\"type\":\"message_start\",\"message\":{\"id\":\"msg_2\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-opus-5-5\","
                + "\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":40,\"output_tokens\":1,\"cache_read_input_tokens\":900,\"cache_creation_input_tokens\":0}}}")
                + event("content_block_start", "{\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}")
                + event("content_block_delta", "{\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Am adăugat \"}}")
                + event("content_block_delta", "{\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"**2 lucruri** în listă.\"}}")
                + event("content_block_stop", "{\"type\":\"content_block_stop\",\"index\":0}")
                + event("message_delta", "{\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":12}}")
                + event("message_stop", "{\"type\":\"message_stop\"}");
    }

    private static String event(String name, String data) {
        return "event: " + name + "\ndata: " + data + "\n\n";
    }

    private static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
