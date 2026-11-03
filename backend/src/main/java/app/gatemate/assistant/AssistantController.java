package app.gatemate.assistant;

import app.gatemate.common.CurrentUser;
import app.gatemate.common.RateLimiter;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/assistant")
public class AssistantController {
    private final AssistantService assistant;
    private final RateLimiter limiter;
    private final ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();

    public AssistantController(AssistantService assistant, RateLimiter limiter) {
        this.assistant = assistant;
        this.limiter = limiter;
    }

    public record ChatRequest(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Size(max = 60) List<AssistantService.Turn> messages) {}

    @GetMapping
    public AssistantService.Status status() {
        return assistant.status(CurrentUser.id());
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@jakarta.validation.Valid @RequestBody ChatRequest in) {
        var me = CurrentUser.id();
        limiter.check("assistant:" + me, 6, Duration.ofMinutes(1));
        assistant.reserve(me);
        var emitter = new SseEmitter(Duration.ofMinutes(4).toMillis());
        pool.submit(() -> {
            try {
                assistant.chat(me, in.messages(), event -> send(emitter, event));
                emitter.complete();
            } catch (RuntimeException e) {
                send(emitter, Map.of("type", "error", "message", e instanceof app.gatemate.common.ApiException ? e.getMessage() : "unavailable"));
                emitter.complete();
            }
        });
        return emitter;
    }

    private static void send(SseEmitter emitter, Map<String, Object> event) {
        try {
            emitter.send(SseEmitter.event().data(event, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
        }
    }
}
