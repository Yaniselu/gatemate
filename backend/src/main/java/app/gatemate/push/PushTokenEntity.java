package app.gatemate.push;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@Table(name = "push_tokens")
public class PushTokenEntity {
    @Id public String token;
    public UUID userId;
    public String platform;
    public Instant updatedAt = Instant.now();

    public interface Repo extends JpaRepository<PushTokenEntity, String> {
        List<PushTokenEntity> findByUserId(UUID userId);
    }
}
