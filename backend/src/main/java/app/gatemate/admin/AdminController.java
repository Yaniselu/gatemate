package app.gatemate.admin;

import app.gatemate.chat.ChatRepos;
import app.gatemate.common.ApiException;
import app.gatemate.common.CurrentUser;
import app.gatemate.moderation.ModerationEntities;
import app.gatemate.user.UserRepository;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Moderation queue for user reports (App Store 1.2: act on objectionable content within 24 hours). ROLE_ADMIN only. */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private final ModerationEntities.Reports reports;
    private final ChatRepos.Messages messages;
    private final UserRepository users;

    public AdminController(ModerationEntities.Reports reports, ChatRepos.Messages messages, UserRepository users) {
        this.reports = reports;
        this.messages = messages;
        this.users = users;
    }

    public record ReportView(String id, String reason, String createdAt, String messageId, String text, String authorId, int reportCount, boolean hidden) {}

    public record Resolve(@Pattern(regexp = "dismiss|hide|ban") String action) {}

    @GetMapping("/reports")
    public List<ReportView> open() {
        return reports.findByStatusOrderByCreatedAt("OPEN").stream().map(r -> {
            var m = messages.findById(r.messageId).orElse(null);
            return new ReportView(r.id.toString(), r.reason, r.createdAt.toString(), r.messageId.toString(), m == null ? null : m.text,
                    m == null ? null : m.authorId.toString(), m == null ? 0 : m.reportCount, m != null && m.hidden);
        }).toList();
    }

    @PostMapping("/reports/{id}/resolve")
    @Transactional
    public ResponseEntity<Void> resolve(@PathVariable UUID id, @RequestBody Resolve in) {
        var r = reports.findById(id).orElseThrow(() -> ApiException.notFound("Report"));
        var msg = messages.findById(r.messageId).orElse(null);
        switch (in.action()) {
            case "dismiss" -> {
                if (msg != null) {
                    msg.hidden = false;
                    messages.save(msg);
                }
            }
            case "hide" -> {
                if (msg != null) {
                    msg.hidden = true;
                    messages.save(msg);
                }
            }
            case "ban" -> {
                if (msg != null) {
                    msg.hidden = true;
                    messages.save(msg);
                    users.findById(msg.authorId).ifPresent(u -> {
                        u.banned = true;
                        users.save(u);
                    });
                }
            }
            default -> throw ApiException.badRequest("bad_action", "Unknown action.");
        }
        r.status = "dismiss".equals(in.action()) ? "DISMISSED" : "ACTIONED";
        r.resolvedAt = Instant.now();
        r.resolvedBy = CurrentUser.id();
        reports.save(r);
        return ResponseEntity.noContent().build();
    }
}
