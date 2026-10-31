package app.gatemate.auth;

import app.gatemate.common.Messages;
import app.gatemate.config.GatemateProperties;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

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

    public void sendVerificationCode(String to, String name, String code, String lang) {
        sendCode("mail.verify", to, name, code, lang);
    }

    public void sendPasswordResetCode(String to, String name, String code, String lang) {
        sendCode("mail.reset", to, name, code, lang);
    }

    public void sendInvite(String to, String inviter, String trip, String url, String lang) {
        String subject = Messages.get(lang, "mail.invite.subject", "name", first(inviter), "trip", trip);
        String html = """
            <!doctype html><html><body style="margin:0;background:#f4f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1b2b">
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
            <table role="presentation" width="100%%" style="max-width:480px;background:#ffffff;border-radius:20px;padding:32px" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:20px;font-weight:800;color:#0a93a6">Gatemate</td></tr>
            <tr><td style="padding-top:18px;font-size:22px;font-weight:800">%s</td></tr>
            <tr><td style="padding-top:10px;font-size:15px;line-height:1.5;color:#3a4a5c">%s</td></tr>
            <tr><td align="center" style="padding:26px 0"><a href="%s" style="display:inline-block;padding:14px 26px;border-radius:14px;background:#0a93a6;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none">%s</a></td></tr>
            <tr><td style="font-size:13px;line-height:1.5;color:#74859a">%s</td></tr>
            </table></td></tr></table></body></html>""".formatted(esc(subject), esc(Messages.get(lang, "mail.invite.intro", "name", first(inviter), "trip", trip)), esc(url),
                esc(Messages.get(lang, "mail.invite.button")), esc(Messages.get(lang, "mail.invite.note")));
        send(to, subject, html, Messages.get(lang, "mail.invite.intro", "name", first(inviter), "trip", trip) + "\n\n" + url);
    }

    private void sendCode(String kind, String to, String name, String code, String lang) {
        send(to, Messages.get(lang, kind + ".subject", "code", code),
                page(Messages.get(lang, kind + ".title"), Messages.get(lang, kind + ".intro", "name", esc(first(name))), code, Messages.get(lang, kind + ".note")),
                Messages.get(lang, kind + ".text", "code", code));
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
