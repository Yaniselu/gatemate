package app.gatemate.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshTokenEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID userId;
    public String tokenHash;
    public UUID familyId;
    public Instant expiresAt;
    public Instant revokedAt;
    public Instant createdAt = Instant.now();
}
