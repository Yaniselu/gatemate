package app.gatemate.push;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Delivery goes through FCM (Android) and APNs (iOS). Credentials are not configured in this repository,
 * so until they are, notifications are only logged; device reminders still work locally on the phone.
 */
@Service
public class PushService {
    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    private final PushTokenEntity.Repo tokens;

    public PushService(PushTokenEntity.Repo tokens) {
        this.tokens = tokens;
    }

    public void send(UUID userId, String title, String body) {
        int n = tokens.findByUserId(userId).size();
        if (n > 0) log.info("push → {} device(s): {}", n, title);
    }
}
