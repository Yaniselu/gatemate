package app.gatemate.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {
    Optional<RefreshTokenEntity> findByTokenHash(String hash);

    @Modifying
    @Query("update RefreshTokenEntity t set t.revokedAt = :now where t.familyId = :family and t.revokedAt is null")
    int revokeFamily(UUID family, Instant now);

    @Modifying
    @Query("update RefreshTokenEntity t set t.revokedAt = :now where t.userId = :user and t.revokedAt is null")
    int revokeAllForUser(UUID user, Instant now);
}
