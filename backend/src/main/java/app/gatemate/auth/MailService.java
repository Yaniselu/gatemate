package app.gatemate.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Transactional e-mail. The default implementation only logs that a mail would be sent (never its
 * secret link). Replace with your provider (SES, Postmark, SendGrid) before launch.
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    public void sendPasswordReset(String to, String link) {
        log.info("Password reset e-mail queued for {}", mask(to));
    }

    static String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? "***" : email.charAt(0) + "***" + email.substring(at);
    }
}
