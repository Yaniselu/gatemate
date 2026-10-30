package app.gatemate.assistant;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;

/**
 * Velo on Google's Gemini API, for servers that have a Gemini key and no Anthropic key. Same tools and the same
 * events for the app as the Claude version; Gemini has no web search alongside function calling, so Velo points to
 * official sources instead.
 */
final class GeminiAgent {
    private static final Logger log = LoggerFactory.getLogger(GeminiAgent.class);
    private static final Set<String> BLOCKED = Set.of("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION");

    /** Runs one tool call for the model; the service owns validation, logging and the tool_done event. */
    interface ToolCall {
        AssistantService.Outcome run(String id, String name, Map<String, Object> input);
    }

    /** The Gemini API answered with an error status (429 = quota). */
    static final class Failure extends RuntimeException {
        final int status;

        Failure(int status, String body) {
            super("Gemini HTTP " + status + ": " + (body.length() > 300 ? body.substring(0, 300) : body));
            this.status = status;
        }
    }

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final String key;
    /** Endpoint + model pairs to try, in order; the first that accepts the key is remembered. */
    private final List<String> routes = new ArrayList<>();
    private volatile int route;
    private final List<Map<String, Object>> declarations;
    private final JsonMapper json;
    private final java.util.concurrent.atomic.AtomicInteger nextId = new java.util.concurrent.atomic.AtomicInteger();

    GeminiAgent(String key, String model, String baseUrl, Duration timeout, List<Map<String, Object>> declarations, JsonMapper json) {
        this.key = key;
        this.timeout = timeout;
        // Google AI Studio keys (AIza… and the newer AQ.…) use the Gemini API; Vertex AI express keys use Vertex. Both take
        // the same request. The model alias may not exist on both, so fall back to a pinned model.
        List<String> endpoints = baseUrl != null && !baseUrl.isBlank() ? List.of(baseUrl.replaceAll("/+$", "") + "/v1beta/models/")
                : List.of(STUDIO, VERTEX);
        // Overloaded (503) or out of quota (429) on one model: the next one usually answers (quotas are per model).
        var models = new java.util.LinkedHashSet<>(List.of(model, "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"));
        for (String e : endpoints) for (String m : models) routes.add(e + URLEncoder.encode(m, StandardCharsets.UTF_8) + ":generateContent");
        this.declarations = declarations;
        this.json = json;
    }

    private static final String STUDIO = "https://generativelanguage.googleapis.com/v1beta/models/";
    private static final String VERTEX = "https://aiplatform.googleapis.com/v1/publishers/google/models/";

    static String system() {
        return AssistantService.SYSTEM
                .replace(WEB_SEARCH, "- You can't search the web. For things that change (entry and visa rules, strikes, events, opening hours, "
                        + "prices), share what you know, say it may be out of date and point to the official source (government, airport or airline).")
                .replace("powered by Claude", "powered by Google Gemini");
    }

    static final String WEB_SEARCH = "- Use web search for things that change: entry and visa rules, strikes, events, opening hours, prices. "
            + "Prefer official sources (governments, airports, airlines) and say where the information comes from.";

    /** One conversation turn: the model answers, calling tools for up to {@code maxSteps} rounds. */
    void run(List<AssistantService.Turn> history, String context, int maxSteps, ToolCall tools, Consumer<Map<String, Object>> emit)
            throws IOException, InterruptedException {
        List<Map<String, Object>> contents = new ArrayList<>();
        for (var t : history) contents.add(Map.of("role", "user".equals(t.role()) ? "user" : "model", "parts", List.of(Map.of("text", t.text()))));
        for (int step = 0; step < maxSteps; step++) {
            Reply reply = generate(contents, context, emit);
            if (!reply.parts.isEmpty()) contents.add(Map.of("role", "model", "parts", reply.parts));
            if (reply.calls.isEmpty()) {
                if (reply.blocked && !reply.wroteText) emit.accept(Map.of("type", "error", "message", "refused"));
                else {
                    if ("MAX_TOKENS".equals(reply.finish)) emit.accept(Map.of("type", "truncated"));
                    emit.accept(Map.of("type", "done"));
                }
                return;
            }
            List<Map<String, Object>> results = new ArrayList<>();
            for (Call c : reply.calls) {
                var out = tools.run(c.id, c.name, c.args);
                var response = new LinkedHashMap<String, Object>();
                response.put("name", c.name);
                response.put("response", out.error() ? Map.of("error", out.value()) : Map.of("result", out.value()));
                if (c.apiId != null) response.put("id", c.apiId);
                results.add(Map.of("functionResponse", response));
            }
            contents.add(Map.of("role", "user", "parts", results));
        }
        emit.accept(Map.of("type", "done"));
    }

    private record Call(String id, String apiId, String name, Map<String, Object> args) {}

    private static final class Reply {
        final List<Map<String, Object>> parts = new ArrayList<>();
        final List<Call> calls = new ArrayList<>();
        String finish;
        boolean blocked, wroteText;
    }

    /** Gemini 3 models take a thinking level, 2.5 models a budget; older ones neither. The first one accepted is kept. */
    private static final List<Map<String, Object>> THINKING = List.of(Map.of("thinkingLevel", "low"), Map.of("thinkingBudget", 0), Map.of());
    private volatile int thinking;
    /** Longest wait for one model reply before the traveller gets an error instead of an endless spinner. */
    private final Duration timeout;

    /**
     * One model reply, as a whole (Gemini's streaming proved unreliable from our host: replies stalled mid-stream). Text
     * still reaches the app as a delta event and tool calls as tool events, so the screen looks the same.
     */
    @SuppressWarnings("unchecked")
    private Reply generate(List<Map<String, Object>> contents, String context, Consumer<Map<String, Object>> emit) throws IOException, InterruptedException {
        long started = System.nanoTime();
        HttpResponse<String> res;
        for (int r = route; ; ) {
            var config = new LinkedHashMap<String, Object>();
            config.put("maxOutputTokens", 8192);
            if (!THINKING.get(thinking).isEmpty()) config.put("thinkingConfig", THINKING.get(thinking));
            var body = new LinkedHashMap<String, Object>();
            body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system()), Map.of("text", context))));
            body.put("contents", contents);
            body.put("tools", List.of(Map.of("functionDeclarations", declarations)));
            body.put("generationConfig", config);
            var req = HttpRequest.newBuilder(URI.create(routes.get(r)))
                    .timeout(timeout)
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", key)
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                    .build();
            try {
                res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            } catch (java.net.http.HttpTimeoutException e) {
                throw new Failure(504, "no reply from Gemini within " + timeout.toSeconds() + " s");
            }
            if (res.statusCode() == 200) {
                if (r != route) log.info("Velo on Gemini uses {}", routes.get(r).replaceAll(":generate.*", ""));
                route = r;
                break;
            }
            String err = res.body().replaceAll("\\s+", " ");
            int code = res.statusCode();
            // This model doesn't take that kind of thinking setting: try the next kind on the same route.
            if (code == 400 && err.toLowerCase(java.util.Locale.ROOT).contains("thinking") && thinking + 1 < THINKING.size()) {
                log.info("Gemini refused thinking config {}, trying {}", THINKING.get(thinking), THINKING.get(thinking + 1));
                thinking++;
                continue;
            }
            // Wrong endpoint for this kind of key, or a model this endpoint doesn't have: try the next route.
            boolean wrongRoute = code == 401 || code == 403 || code == 404 || (code == 400 && err.contains("API key"));
            boolean busy = code == 429 || code >= 500;
            if (!(wrongRoute || busy) || r + 1 >= routes.size()) throw new Failure(code, err);
            log.warn("Gemini route {} {} ({}), trying the next one", routes.get(r).replaceAll(":generate.*", ""), busy ? "busy" : "refused", code);
            if (busy) Thread.sleep(300);
            r++;
        }

        var reply = new Reply();
        StringBuilder text = new StringBuilder();
        Map<String, Object> answer = json.readValue(res.body(), Map.class);
        if (answer.get("promptFeedback") instanceof Map<?, ?> fb && fb.get("blockReason") != null) reply.blocked = true;
        if (answer.get("candidates") instanceof List<?> cands && !cands.isEmpty()) {
            var cand = (Map<String, Object>) cands.get(0);
            if (cand.get("finishReason") instanceof String f) {
                reply.finish = f;
                if (BLOCKED.contains(f)) reply.blocked = true;
            }
            if (cand.get("content") instanceof Map<?, ?> content && content.get("parts") instanceof List<?> parts) {
                for (Object o : parts) {
                    var part = (Map<String, Object>) o;
                    if (Boolean.TRUE.equals(part.get("thought"))) continue;
                    if (part.get("text") instanceof String t) {
                        if (!t.isEmpty()) {
                            emit.accept(Map.of("type", "delta", "text", t));
                            reply.wroteText = true;
                        }
                        // Plain text parts are joined; a part carrying a thought signature goes back exactly as sent.
                        if (part.size() == 1) {
                            text.append(t);
                            continue;
                        }
                    }
                    flush(text, reply);
                    reply.parts.add(part);
                    if (part.get("functionCall") instanceof Map<?, ?> fc) {
                        var call = new Call("g" + nextId.incrementAndGet(), fc.get("id") instanceof String s ? s : null, String.valueOf(fc.get("name")),
                                fc.get("args") instanceof Map<?, ?> a ? (Map<String, Object>) a : Map.of());
                        reply.calls.add(call);
                        emit.accept(Map.of("type", "tool", "id", call.id, "name", call.name));
                    }
                }
            }
        }
        flush(text, reply);
        log.info("gemini turn: model={} took={}ms finish={} calls={} text={}", answer.get("modelVersion"),
                (System.nanoTime() - started) / 1_000_000, reply.finish, reply.calls.size(), reply.wroteText);
        return reply;
    }

    private static void flush(StringBuilder text, Reply reply) {
        if (text.isEmpty()) return;
        reply.parts.add(Map.of("text", text.toString()));
        text.setLength(0);
    }
}
