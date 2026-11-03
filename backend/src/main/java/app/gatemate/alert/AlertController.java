package app.gatemate.alert;

import app.gatemate.common.CurrentUser;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {
    private final AlertEntity.Repo alerts;

    public AlertController(AlertEntity.Repo alerts) {
        this.alerts = alerts;
    }

    public record AlertDto(String id, String kind, String title, String body, String createdAt, boolean read, String flightId, String source) {}

    public record ReadRequest(@Size(max = 200) List<UUID> ids) {}

    @GetMapping
    public List<AlertDto> list() {
        return alerts.findTop100ByUserIdOrderByCreatedAtDesc(CurrentUser.id()).stream()
                .map(a -> new AlertDto(a.id.toString(), a.kind, a.title, a.body, a.createdAt.toString(), a.read, a.flightId == null ? null : a.flightId.toString(), "server"))
                .toList();
    }

    @PostMapping("/read")
    @Transactional
    public ResponseEntity<Void> read(@jakarta.validation.Valid @RequestBody ReadRequest r) {
        if (r.ids() != null && !r.ids().isEmpty()) {
            var list = alerts.findByUserIdAndIdIn(CurrentUser.id(), r.ids());
            list.forEach(a -> a.read = true);
            alerts.saveAll(list);
        }
        return ResponseEntity.noContent().build();
    }
}
