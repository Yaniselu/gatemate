package app.gatemate.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "password_resets")
public class PasswordResetEntity {
    @Id public String tokenHash;
    public UUID userId;
    public Instant expiresAt;
    public Instant usedAt;
}
