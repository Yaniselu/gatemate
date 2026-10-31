package app.gatemate.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByAppleSub(String sub);
    Optional<UserEntity> findByGoogleSub(String sub);
    Optional<UserEntity> findByImportToken(String token);
    Optional<UserEntity> findByIdentityDocHash(String hash);
}
