package app.gatemate.push;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@Table(name = "push_tokens")
public class PushTokenEntity {
    @Id public String token;
    public UUID userId;
    public String platform;
    public String muted = "";
    public String apnsEnv;
    public Instant updatedAt = Instant.now();

    public boolean wants(String kind) {
        return muted == null || muted.isBlank() || Arrays.stream(muted.split(",")).noneMatch(kind::equals);
    }

    public interface Repo extends JpaRepository<PushTokenEntity, String> {
        List<PushTokenEntity> findByUserId(UUID userId);
    }
}
