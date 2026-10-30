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
import java.util.stream.Collectors;
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
    private final String key, model, baseUrl;
    private final List<Map<String, Object>> declarations;
    private final JsonMapper json;
    private final java.util.concurrent.atomic.AtomicInteger nextId = new java.util.concurrent.atomic.AtomicInteger();

    GeminiAgent(String key, String model, String baseUrl, List<Map<String, Object>> declarations, JsonMapper json) {
        this.key = key;
        this.model = model;
        this.baseUrl = baseUrl == null || baseUrl.isBlank() ? "https://generativelanguage.googleapis.com" : baseUrl.replaceAll("/+$", "");
        this.declarations = declarations;
        this.json = json;
    }

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
            Reply reply = stream(contents, context, emit);
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

    @SuppressWarnings("unchecked")
    private Reply stream(List<Map<String, Object>> contents, String context, Consumer<Map<String, Object>> emit) throws IOException, InterruptedException {
        var body = new LinkedHashMap<String, Object>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system()), Map.of("text", context))));
        body.put("contents", contents);
        body.put("tools", List.of(Map.of("functionDeclarations", declarations)));
        body.put("generationConfig", Map.of("maxOutputTokens", 8192));
        var req = HttpRequest.newBuilder(URI.create(baseUrl + "/v1beta/models/" + URLEncoder.encode(model, StandardCharsets.UTF_8) + ":streamGenerateContent?alt=sse"))
                .timeout(Duration.ofMinutes(3))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", key)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .build();
        HttpResponse<java.util.stream.Stream<String>> res = http.send(req, HttpResponse.BodyHandlers.ofLines());
        if (res.statusCode() != 200) {
            String err;
            try (var lines = res.body()) {
                err = lines.collect(Collectors.joining("\n"));
            }
            throw new Failure(res.statusCode(), err);
        }
        var reply = new Reply();
        StringBuilder text = new StringBuilder();
        try (var lines = res.body()) {
            for (String line : (Iterable<String>) lines::iterator) {
                if (!line.startsWith("data:")) continue;
                Map<String, Object> chunk = json.readValue(line.substring(5).trim(), Map.class);
                if (chunk.get("promptFeedback") instanceof Map<?, ?> fb && fb.get("blockReason") != null) reply.blocked = true;
                if (!(chunk.get("candidates") instanceof List<?> cands) || cands.isEmpty()) continue;
                var cand = (Map<String, Object>) cands.get(0);
                if (cand.get("finishReason") instanceof String f) {
                    reply.finish = f;
                    if (BLOCKED.contains(f)) reply.blocked = true;
                }
                if (!(cand.get("content") instanceof Map<?, ?> content) || !(content.get("parts") instanceof List<?> parts)) continue;
                for (Object o : parts) {
                    var part = (Map<String, Object>) o;
                    if (part.get("text") instanceof String t && !Boolean.TRUE.equals(part.get("thought"))) {
                        if (!t.isEmpty()) {
                            emit.accept(Map.of("type", "delta", "text", t));
                            reply.wroteText = true;
                        }
                        // Plain text chunks are joined; a part carrying a thought signature goes back exactly as sent.
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
        if (reply.finish == null) log.warn("gemini stream ended without a finish reason");
        return reply;
    }

    private static void flush(StringBuilder text, Reply reply) {
        if (text.isEmpty()) return;
        reply.parts.add(Map.of("text", text.toString()));
        text.setLength(0);
    }
}
