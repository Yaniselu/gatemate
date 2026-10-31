package app.gatemate.auth;

import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.common.RateLimiter;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailVerificationService {
    @Entity
    @Table(name = "email_verifications")
    public static class Verification {
        @Id public UUID userId;
        public String codeHash;
        public Instant expiresAt;
        public int attempts;
    }

    public interface Repo extends JpaRepository<Verification, UUID> {}

    private static final SecureRandom RNG = new SecureRandom();
    static final int MAX_ATTEMPTS = 5;

    private final Repo codes;
    private final UserRepository users;
    private final MailService mail;
    private final RateLimiter limiter;

    public EmailVerificationService(Repo codes, UserRepository users, MailService mail, RateLimiter limiter) {
        this.codes = codes;
        this.users = users;
        this.mail = mail;
        this.limiter = limiter;
    }

    public boolean mailEnabled() {
        return mail.enabled();
    }

    @Transactional
    public void send(UserEntity u) {
        if (u.emailVerified) return;
        if (!mail.enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "mail_unavailable", "E-mail sending isn’t set up on this server yet.");
        limiter.check("verify-send-min:" + u.id, 1, Duration.ofMinutes(1));
        limiter.check("verify-send-hour:" + u.id, 5, Duration.ofHours(1));
        String code = code();
        var v = codes.findById(u.id).orElseGet(Verification::new);
        v.userId = u.id;
        v.codeHash = hash(u.id, code);
        v.expiresAt = Instant.now().plus(Duration.ofMinutes(30));
        v.attempts = 0;
        codes.save(v);
        mail.sendVerificationCode(u.email, u.displayName, code, u.lang);
    }

    public void sendQuietly(UUID userId) {
        try {
            if (mail.enabled()) users.findById(userId).ifPresent(this::send);
        } catch (Exception ignored) {
        }
    }

    @Transactional(noRollbackFor = ApiException.class)
    public UserEntity verify(UUID userId, String code) {
        var u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Account"));
        if (u.emailVerified) return u;
        var v = codes.findById(userId).orElseThrow(() -> ApiException.badRequest("no_code", "Ask for a new code first."));
        if (v.expiresAt.isBefore(Instant.now()) || v.attempts >= MAX_ATTEMPTS) {
            codes.delete(v);
            throw ApiException.badRequest("code_expired", "This code has expired. Ask for a new one.");
        }
        if (code == null || !Crypto.constantTimeEquals(v.codeHash, hash(userId, code.trim()))) {
            v.attempts++;
            codes.save(v);
            int left = MAX_ATTEMPTS - v.attempts;
            throw ApiException.badRequest("wrong_code", left > 0 ? "That code isn’t right. " + left + (left == 1 ? " try" : " tries") + " left." : "Too many wrong codes. Ask for a new one.");
        }
        codes.delete(v);
        u.emailVerified = true;
        return users.save(u);
    }

    static String code() {
        return String.format("%06d", RNG.nextInt(1_000_000));
    }

    static String hash(UUID userId, String code) {
        return Crypto.sha256(userId + ":" + code);
    }
}
