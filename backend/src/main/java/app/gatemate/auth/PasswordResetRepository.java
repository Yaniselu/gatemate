package app.gatemate.auth;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetRepository extends JpaRepository<PasswordResetEntity, String> {
    @org.springframework.transaction.annotation.Transactional
    void deleteByUserId(java.util.UUID userId);
}
