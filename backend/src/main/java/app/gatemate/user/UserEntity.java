package app.gatemate.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity {
    @Id public UUID id = UUID.randomUUID();
    public String email;
    public boolean emailVerified;
    public String passwordHash;
    public String displayName;
    public String legalFirstName;
    public String legalLastName;
    public String phone;
    public String homeAirport;
    public String lang = "en";
    public java.time.LocalDate aiDay;
    public int aiCount;
    public String seatPreference;
    public String bio;
    public String avatarUrl;
    public String avatarColor;
    public String provider;
    public String appleSub;
    public String googleSub;
    public String appleRefreshToken;
    public String importToken;
    public String role = "USER";
    public boolean banned;
    public int failedLogins;
    public Instant lockedUntil;
    public Instant proUntil;
    public String proProduct;
    public Instant createdAt = Instant.now();

    public boolean isPro() {
        return proUntil != null && proUntil.isAfter(Instant.now());
    }
}
