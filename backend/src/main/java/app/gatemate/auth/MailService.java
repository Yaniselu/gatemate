package app.gatemate.auth;

import app.gatemate.config.GatemateProperties;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Transactional e-mail through an HTTP API: Brevo (free, 300 e-mails a day, any verified sender address) or Resend.
 * Without a key nothing is sent and features that need e-mail say so. Codes and links are never logged.
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private final GatemateProperties.Mail cfg;
    private final RestClient http = app.gatemate.common.Http.builder(Duration.ofSeconds(15)).build();

    public MailService(GatemateProperties props) {
        this.cfg = props.mail();
    }

    public boolean enabled() {
        return cfg != null && cfg.apiKey() != null && !cfg.apiKey().isBlank() && cfg.from() != null && !cfg.from().isBlank();
    }

    public void sendVerificationCode(String to, String name, String code) {
        send(to, code + " is your Gatemate code", page("Confirm your e-mail", "Hi " + esc(first(name)) + ", here is your code to confirm this e-mail address for Gatemate:",
                code, "It expires in 30 minutes. If you didn’t create a Gatemate account, you can ignore this e-mail."),
                "Your Gatemate code is " + code + ". It expires in 30 minutes.");
    }

    public void sendPasswordResetCode(String to, String name, String code) {
        send(to, code + " is your Gatemate password reset code", page("Reset your password", "Hi " + esc(first(name)) + ", use this code in the app to choose a new password:",
                code, "It expires in 30 minutes. If you didn’t ask to reset your password, ignore this e-mail: your password stays the same."),
                "Your Gatemate password reset code is " + code + ". It expires in 30 minutes.");
    }

    void send(String to, String subject, String html, String text) {
        if (!enabled()) {
            log.info("E-mail not sent to {} (no mail provider configured)", mask(to));
            return;
        }
        try {
            if ("resend".equalsIgnoreCase(cfg.provider())) {
                http.post().uri("https://api.resend.com/emails").header("Authorization", "Bearer " + cfg.apiKey()).contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("from", cfg.fromName() + " <" + cfg.from() + ">", "to", List.of(to), "subject", subject, "html", html, "text", text))
                        .retrieve().toBodilessEntity();
            } else {
                http.post().uri("https://api.brevo.com/v3/smtp/email").header("api-key", cfg.apiKey()).contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("sender", Map.of("name", cfg.fromName(), "email", cfg.from()), "to", List.of(Map.of("email", to)), "subject", subject,
                                "htmlContent", html, "textContent", text))
                        .retrieve().toBodilessEntity();
            }
            log.info("E-mail sent to {}", mask(to));
        } catch (Exception e) {
            log.warn("E-mail to {} failed: {}", mask(to), e.getMessage());
            throw new app.gatemate.common.ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "mail_failed", "We couldn’t send the e-mail right now. Please try again in a minute.");
        }
    }

    private static String page(String title, String intro, String code, String outro) {
        return """
            <!doctype html><html><body style="margin:0;background:#f4f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1b2b">
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
            <table role="presentation" width="100%%" style="max-width:480px;background:#ffffff;border-radius:20px;padding:32px" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:20px;font-weight:800;color:#0a93a6">Gatemate</td></tr>
            <tr><td style="padding-top:18px;font-size:22px;font-weight:800">%s</td></tr>
            <tr><td style="padding-top:10px;font-size:15px;line-height:1.5;color:#3a4a5c">%s</td></tr>
            <tr><td align="center" style="padding:24px 0"><div style="display:inline-block;padding:14px 22px;border-radius:14px;background:#e6f8fa;font-size:32px;font-weight:800;letter-spacing:8px;color:#08707f">%s</div></td></tr>
            <tr><td style="font-size:13px;line-height:1.5;color:#74859a">%s</td></tr>
            </table></td></tr></table></body></html>""".formatted(esc(title), intro, code, esc(outro));
    }

    private static String first(String name) {
        return name == null || name.isBlank() ? "there" : name.trim().split("\\s+")[0];
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    static String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? "***" : email.charAt(0) + "***" + email.substring(at);
    }
}
