package app.gatemate.alert;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@Table(name = "alerts")
public class AlertEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID userId;
    public String kind;
    public String title;
    public String body;
    public UUID flightId;
    @Column(name = "is_read") public boolean read;
    public Instant createdAt = Instant.now();

    public interface Repo extends JpaRepository<AlertEntity, UUID> {
        List<AlertEntity> findTop100ByUserIdOrderByCreatedAtDesc(UUID userId);
        List<AlertEntity> findByUserIdAndIdIn(UUID userId, List<UUID> ids);
    }
}
