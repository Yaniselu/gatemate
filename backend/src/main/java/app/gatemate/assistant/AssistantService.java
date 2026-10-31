package app.gatemate.assistant;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.common.ApiException;
import app.gatemate.common.Messages;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.helpers.BetaMessageAccumulator;
import com.anthropic.models.beta.messages.BetaCacheControlEphemeral;
import com.anthropic.models.beta.messages.BetaContentBlock;
import com.anthropic.models.beta.messages.BetaContentBlockParam;
import com.anthropic.models.beta.messages.BetaFallbacksParam;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.BetaMessageParam;
import com.anthropic.models.beta.messages.BetaOutputConfig;
import com.anthropic.models.beta.messages.BetaRawMessageStreamEvent;
import com.anthropic.models.beta.messages.BetaStopReason;
import com.anthropic.models.beta.messages.BetaTextBlockParam;
import com.anthropic.models.beta.messages.BetaToolResultBlockParam;
import com.anthropic.models.beta.messages.BetaWebSearchTool20260209;
import com.anthropic.models.beta.messages.MessageCreateParams;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Velo, Gatemate's travel agent (built by Velosyntech): a Claude conversation that can read the traveller's trips,
 * look up airports and destinations, convert money, estimate EU261 compensation, search the web and add checklist
 * items. Answers stream to the app as server-sent events.
 */
@Service
public class AssistantService {
    private static final Logger log = LoggerFactory.getLogger(AssistantService.class);

    /** Messages a day: enough for real trip planning, while keeping the API bill predictable. */
    static final int FREE_DAILY = 20, PRO_DAILY = 200;
    private static final int MAX_STEPS = 10, MAX_TURNS = 40, MAX_CHARS = 4000;

    public record Turn(String role, String text) {}

    public record Status(boolean enabled, int used, int limit) {}

    /** A tool's result for the model: the value, or the error message it should recover from. */
    record Outcome(Object value, boolean error) {}

    private final AnthropicClient client;
    /** Used when the server has a Gemini key and no Anthropic key. */
    private final GeminiAgent gemini;
    private final String model;
    private final BetaOutputConfig.Effort effort;
    private final AssistantTools tools;
    private final UserRepository users;
    private final AirportCatalog airports;
    private final JsonMapper json;
    /** Caps simultaneous conversations on this instance; the rest wait briefly or get a "busy" answer. */
    private final Semaphore slots = new Semaphore(24);

    public AssistantService(AssistantTools tools, UserRepository users, AirportCatalog airports, JsonMapper json,
            @Value("${gatemate.assistant.api-key:}") String apiKey,
            @Value("${gatemate.assistant.base-url:}") String baseUrl,
            @Value("${gatemate.assistant.model:claude-opus-5-5}") String model,
            @Value("${gatemate.assistant.effort:low}") String effort,
            @Value("${gatemate.assistant.gemini-key:}") String geminiKey,
            @Value("${gatemate.assistant.gemini-model:gemini-flash-lite-latest}") String geminiModel,
            @Value("${gatemate.assistant.gemini-base-url:}") String geminiBaseUrl,
            @Value("${gatemate.assistant.gemini-timeout-seconds:75}") int geminiTimeoutSeconds) {
        this.tools = tools;
        this.users = users;
        this.airports = airports;
        this.json = json;
        this.model = model;
        this.effort = BetaOutputConfig.Effort.of(effort);
        if (apiKey == null || apiKey.isBlank()) {
            this.client = null;
        } else {
            var b = AnthropicOkHttpClient.builder().apiKey(apiKey).timeout(Duration.ofMinutes(3)).maxRetries(2);
            if (baseUrl != null && !baseUrl.isBlank()) b.baseUrl(baseUrl);
            this.client = b.build();
        }
        this.gemini = client == null && geminiKey != null && !geminiKey.isBlank()
                ? new GeminiAgent(geminiKey, geminiModel, geminiBaseUrl, Duration.ofSeconds(geminiTimeoutSeconds), tools.geminiDeclarations(), json) : null;
        if (gemini != null) log.info("Velo runs on Gemini ({})", geminiModel);
    }

    public boolean enabled() {
        return client != null || gemini != null;
    }

    public Status status(UUID me) {
        var u = users.findById(me).orElseThrow(() -> ApiException.notFound("Account"));
        return new Status(enabled(), today().equals(u.aiDay) ? u.aiCount : 0, limit(u));
    }

    /** Counts one message against the traveller's daily allowance, or refuses with 429. */
    @Transactional
    public void reserve(UUID me) {
        if (!enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "assistant_off", "Velo isn’t switched on on this server yet.");
        var u = users.findById(me).orElseThrow(() -> ApiException.notFound("Account"));
        if (!today().equals(u.aiDay)) {
            u.aiDay = today();
            u.aiCount = 0;
        }
        if (u.aiCount >= limit(u)) {
            long reset = Duration.between(Instant.now(), today().plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC)).toSeconds();
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "assistant_limit",
                    u.isPro() ? "You’ve used today’s Velo messages. They reset at midnight UTC." : "You’ve used today’s free Velo messages. Gatemate Pro has 10× more.",
                    Math.max(60, reset));
        }
        u.aiCount++;
        users.save(u);
    }

    /**
     * Runs one turn of the conversation: Claude answers, calling tools as often as it needs (up to MAX_STEPS rounds),
     * and every piece of progress goes to {@code emit} as an event map.
     */
    public void chat(UUID me, List<Turn> history, Consumer<Map<String, Object>> emit) {
        var u = users.findById(me).orElseThrow(() -> ApiException.notFound("Account"));
        List<Turn> turns = clean(history);
        log.info("assistant chat: {} turns on {}", turns.size(), client != null ? "Claude" : "Gemini");
        var ctx = new AssistantTools.Ctx(me, emit);

        boolean slot = false;
        try {
            slot = slots.tryAcquire(10, java.util.concurrent.TimeUnit.SECONDS);
            if (!slot) {
                emit.accept(Map.of("type", "error", "message", "busy"));
                return;
            }
            if (client == null) {
                gemini.run(turns, context(u), MAX_STEPS, (id, name, input) -> call(id, name, input, ctx, emit), emit);
                return;
            }
            List<BetaMessageParam> messages = new ArrayList<>(toParams(turns));
            messages.add(BetaMessageParam.ofSystem(context(u)));
            for (int step = 0; step < MAX_STEPS; step++) {
                BetaMessage reply = stream(messages, emit);
                List<BetaContentBlock> kept = afterFallback(reply.content());
                messages.add(kept.size() == reply.content().size() ? reply.toParam()
                        : BetaMessageParam.ofAssistantOfContentBlockParams(kept.stream().map(BetaContentBlock::toParam).toList()));
                BetaStopReason stop = reply.stopReason().orElse(BetaStopReason.END_TURN);
                sources(reply, emit);
                if (stop.equals(BetaStopReason.REFUSAL)) {
                    emit.accept(Map.of("type", "error", "message", "refused"));
                    return;
                }
                if (stop.equals(BetaStopReason.PAUSE_TURN)) continue; // a long web search: let Claude carry on
                if (!stop.equals(BetaStopReason.TOOL_USE)) {
                    if (stop.equals(BetaStopReason.MAX_TOKENS)) emit.accept(Map.of("type", "truncated"));
                    emit.accept(Map.of("type", "done"));
                    return;
                }
                messages.add(BetaMessageParam.ofUserOfContentBlockParams(runTools(kept, ctx, emit)));
            }
            emit.accept(Map.of("type", "done"));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RateLimitException e) {
            log.warn("assistant rate limited by the API");
            emit.accept(Map.of("type", "error", "message", "busy"));
        } catch (AnthropicServiceException e) {
            log.warn("assistant API error {}: {}", e.statusCode(), e.getMessage());
            emit.accept(Map.of("type", "error", "message", "unavailable"));
        } catch (GeminiAgent.Failure e) {
            log.warn("assistant {}", e.getMessage());
            emit.accept(Map.of("type", "error", "message", e.status == 429 ? "busy" : "unavailable"));
        } catch (java.io.IOException | RuntimeException e) {
            log.warn("assistant failed: {}", e.toString());
            emit.accept(Map.of("type", "error", "message", "unavailable"));
        } finally {
            if (slot) slots.release();
        }
    }

    /** One model response, streamed: text goes out as it's written, tool calls are announced as they start. */
    private BetaMessage stream(List<BetaMessageParam> messages, Consumer<Map<String, Object>> emit) {
        var params = request(messages);
        var acc = BetaMessageAccumulator.create();
        try (var response = client.beta().messages().createStreaming(params)) {
            response.stream().forEach(event -> {
                acc.accumulate(event);
                relay(event, emit);
            });
        }
        BetaMessage m = acc.message();
        m.usage().cacheReadInputTokens().ifPresent(cached -> log.info("assistant turn: in={} cached={} out={}",
                m.usage().inputTokens(), cached, m.usage().outputTokens()));
        return m;
    }

    private void relay(BetaRawMessageStreamEvent event, Consumer<Map<String, Object>> emit) {
        event.contentBlockStart().ifPresent(start -> {
            start.contentBlock().toolUse().ifPresent(t -> emit.accept(Map.of("type", "tool", "id", t.id(), "name", t.name())));
            start.contentBlock().serverToolUse().ifPresent(t -> emit.accept(Map.of("type", "tool", "id", t.id(), "name", "web_search")));
        });
        event.contentBlockDelta().flatMap(d -> d.delta().text()).ifPresent(t -> emit.accept(Map.of("type", "delta", "text", t.text())));
    }

    MessageCreateParams request(List<BetaMessageParam> messages) {
        var b = MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .outputConfig(BetaOutputConfig.builder().effort(effort).build())
                .systemOfBetaTextBlockParams(List.of(BetaTextBlockParam.builder().text(SYSTEM)
                        .cacheControl(BetaCacheControlEphemeral.builder().ttl(BetaCacheControlEphemeral.Ttl.TTL_1H).build()).build()))
                // Also cache the growing conversation, so each tool round re-reads it at the cached rate.
                .cacheControl(BetaCacheControlEphemeral.builder().build())
                .messages(messages)
                // If a safety classifier declines, the API re-runs the turn on the model Anthropic recommends.
                .addBeta("server-side-fallback-2026-07-01")
                .fallbacks(BetaFallbacksParam.ofDefault())
                .addTool(BetaWebSearchTool20260209.builder().maxUses(3L).build());
        for (var t : tools.definitions()) b.addTool(t);
        return b.build();
    }

    private List<BetaContentBlockParam> runTools(List<BetaContentBlock> blocks, AssistantTools.Ctx ctx, Consumer<Map<String, Object>> emit) {
        List<BetaContentBlockParam> results = new ArrayList<>();
        for (BetaContentBlock block : blocks) {
            block.toolUse().ifPresent(call -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> input = call._input().convert(Map.class);
                Outcome out = call(call.id(), call.name(), input, ctx, emit);
                String text = out.error() ? (String) out.value() : json.writeValueAsString(out.value());
                results.add(BetaContentBlockParam.ofToolResult(BetaToolResultBlockParam.builder().toolUseId(call.id()).content(text).isError(out.error()).build()));
            });
        }
        return results;
    }

    /** Runs one tool for either model and reports it to the app. */
    Outcome call(String id, String name, Map<String, Object> input, AssistantTools.Ctx ctx, Consumer<Map<String, Object>> emit) {
        Outcome out;
        try {
            out = new Outcome(tools.run(name, input == null ? Map.of() : input, ctx), false);
        } catch (AssistantTools.ToolError e) {
            out = new Outcome(e.getMessage(), true);
        } catch (RuntimeException e) {
            log.warn("assistant tool {} failed: {}", name, e.toString());
            out = new Outcome("This lookup failed. Tell the traveller you couldn't check it right now.", true);
        }
        emit.accept(Map.of("type", "tool_done", "id", id, "ok", !out.error()));
        return out;
    }

    /**
     * When a safety classifier stopped the first model mid-answer and another one carried on, the declined model's
     * thinking and tool calls before the switch must not be sent back (or run); text and finished searches stay.
     */
    static List<BetaContentBlock> afterFallback(List<BetaContentBlock> content) {
        int boundary = -1;
        for (int i = 0; i < content.size(); i++) if (content.get(i).isFallback()) boundary = i;
        if (boundary < 0) return content;
        var answered = new java.util.HashSet<String>();
        for (var b : content) b.webSearchToolResult().ifPresent(r -> answered.add(r.toolUseId()));
        List<BetaContentBlock> kept = new ArrayList<>();
        for (int i = 0; i < content.size(); i++) {
            var b = content.get(i);
            if (b.isFallback()) continue;
            if (i < boundary && (b.isThinking() || b.isRedactedThinking() || b.isToolUse())) continue;
            if (i < boundary && b.isServerToolUse() && !answered.contains(b.serverToolUse().get().id())) continue;
            kept.add(b);
        }
        return kept;
    }

    /** Web pages Claude read, so the app can show them as sources under the answer. */
    private void sources(BetaMessage reply, Consumer<Map<String, Object>> emit) {
        List<Map<String, String>> found = new ArrayList<>();
        for (BetaContentBlock block : reply.content()) {
            block.webSearchToolResult().ifPresent(r -> r.content().resultBlocks().ifPresent(list -> list.stream().limit(4)
                    .forEach(w -> found.add(Map.of("title", w.title(), "url", w.url())))));
        }
        if (!found.isEmpty()) emit.accept(Map.of("type", "sources", "items", found));
    }

    /** The conversation as the app sent it, trimmed and checked: starts and ends with the traveller. */
    static List<Turn> clean(List<Turn> history) {
        if (history == null || history.isEmpty() || history.size() > MAX_TURNS) throw ApiException.badRequest("bad_conversation", "Start a new conversation.");
        List<Turn> out = new ArrayList<>();
        for (Turn t : history) {
            if (t == null || t.text() == null || t.text().isBlank()) continue;
            String text = t.text().length() > MAX_CHARS ? t.text().substring(0, MAX_CHARS) : t.text();
            if ("user".equals(t.role())) out.add(new Turn("user", text));
            else if ("assistant".equals(t.role()) && !out.isEmpty()) out.add(new Turn("assistant", text)); // the app's greeting isn't sent
        }
        if (out.isEmpty() || !"user".equals(history.get(history.size() - 1).role())) throw ApiException.badRequest("bad_conversation", "Ask Velo something.");
        return out;
    }

    private static List<BetaMessageParam> toParams(List<Turn> turns) {
        return turns.stream().map(t -> "user".equals(t.role()) ? BetaMessageParam.ofUser(t.text()) : BetaMessageParam.ofAssistant(t.text())).toList();
    }

    /** Facts about this traveller and moment, after the cached prefix so the cache stays warm across users. */
    private String context(UserEntity u) {
        var m = new LinkedHashMap<String, Object>();
        m.put("now_utc", Instant.now().toString());
        m.put("traveller_first_name", u.displayName == null ? "" : u.displayName.split("\\s+")[0]);
        if (u.homeAirport != null) airports.get(u.homeAirport).ifPresent(a -> m.put("home_airport", a.iata() + " " + a.city() + ", " + airports.countryName(a.country())));
        m.put("app_language", LANGUAGE.get(Messages.lang(u.lang)));
        m.put("gatemate_pro", u.isPro());
        return "Context from Gatemate (not written by the traveller): " + json.writeValueAsString(m);
    }

    private int limit(UserEntity u) {
        return u.isPro() ? PRO_DAILY : FREE_DAILY;
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private static final Map<String, String> LANGUAGE = Map.of("en", "English", "ro", "Romanian", "es", "Spanish", "fr", "French", "de", "German", "it", "Italian");

    static final String SYSTEM = """
            You are Velo, the travel agent inside Gatemate, an app for air travellers made by Velosyntech. You help one traveller at a \
            time plan trips, get through airports and handle problems on the way: delays, gate changes, packing, money, local customs \
            and their rights as passengers.

            How to work:
            - The traveller's own trips, flights, gates, seats and checklists come only from your tools. Call get_my_trips before \
            answering anything about them, and never make up a flight time, gate or status. If something isn't in the data, say so.
            - Times from the tools are already in each airport's local time; say "local time" when it matters.
            - Use web search for things that change: entry and visa rules, strikes, events, opening hours, prices. Prefer official \
            sources (governments, airports, airlines) and say where the information comes from.
            - When the traveller asks you to prepare or plan something for a trip, do it: build a concrete plan from their real \
            flights and the destination guide, and add the useful items to their checklist with add_checklist_items. Tell them what \
            you added. Don't add items they didn't ask for.
            - For delays and cancellations, check the route with estimate_compensation and explain what they can claim, from \
            whom and how. Make clear it's an estimate, not legal advice.
            - Health, safety and visa questions: give practical general guidance and point to the official source; for anything \
            urgent, tell them to contact airport staff, the airline or emergency services.

            How to answer:
            - Reply in the app language given in the context, unless the traveller writes to you in another language; then use theirs.
            - You're on a phone screen: lead with the answer, keep it short (a few sentences or a short list), use **bold** for the \
            key facts (times, gates, amounts) and short bullet lists. No tables, no headings longer than a few words.
            - Be warm and direct, like an experienced friend who works in aviation. One emoji at most, only when it helps.
            - Never ask for or repeat passwords, booking references, card numbers or passport numbers.
            - You only help with travel. For anything unrelated, say briefly that you're Gatemate's travel agent and offer travel help.
            - If asked who made you: Velo is built by Velosyntech for Gatemate, powered by Claude.
            """;
}
