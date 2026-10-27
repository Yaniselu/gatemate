package app.gatemate.invite;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@Table(name = "invites")
public class InviteEntity {
    @Id public UUID id = UUID.randomUUID();
    public String tokenHash;
    public String targetType;
    public UUID targetId;
    public UUID createdBy;
    public Instant expiresAt;
    public UUID usedBy;
    public Instant usedAt;

    public interface Repo extends JpaRepository<InviteEntity, UUID> {
        Optional<InviteEntity> findByTokenHash(String hash);
    }
}
