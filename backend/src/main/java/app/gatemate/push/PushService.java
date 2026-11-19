package app.gatemate.push;

import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class PushService {
    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    private final PushTokenEntity.Repo tokens;
    private final ApnsClient apns;
    private final ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();

    public PushService(PushTokenEntity.Repo tokens, ApnsClient apns) {
        this.tokens = tokens;
        this.apns = apns;
    }

    public void send(UUID userId, String kind, String title, String body, String thread) {
        var list = tokens.findByUserId(userId).stream().filter(t -> t.wants(kind)).toList();
        if (list.isEmpty()) return;
        pool.submit(() -> list.forEach(t -> deliver(t, title, body, thread)));
    }

    void deliver(PushTokenEntity t, String title, String body, String thread) {
        if (!"ios".equals(t.platform)) return;
        if (!apns.enabled()) {
            log.info("push skipped, APNs not configured");
            return;
        }
        boolean sandboxFirst = "sandbox".equals(t.apnsEnv);
        String first = sandboxFirst ? ApnsClient.SANDBOX : ApnsClient.PRODUCTION;
        String second = sandboxFirst ? ApnsClient.PRODUCTION : ApnsClient.SANDBOX;
        var r = apns.send(first, t.token, title, body, thread);
        String env = sandboxFirst ? "sandbox" : "prod";
        if (r == ApnsClient.Result.WRONG_ENVIRONMENT) {
            r = apns.send(second, t.token, title, body, thread);
            env = sandboxFirst ? "prod" : "sandbox";
        }
        switch (r) {
            case SENT -> {
                if (!env.equals(t.apnsEnv)) {
                    t.apnsEnv = env;
                    tokens.save(t);
                }
            }
            case GONE, WRONG_ENVIRONMENT -> tokens.deleteById(t.token);
            case FAILED -> log.warn("push to a device failed");
        }
    }
}
