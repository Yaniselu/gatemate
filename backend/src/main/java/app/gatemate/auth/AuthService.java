package app.gatemate.auth;

import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.common.TokenCipher;
import app.gatemate.config.GatemateProperties;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final String[] COLORS = {"#0FB5C3", "#8B7CF6", "#FF8A5B", "#2FD18A", "#5EC8FF"};
    // Checked on unknown e-mails so response timing doesn't reveal which accounts exist.
    private final String dummyHash;

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final SocialTokenVerifier social;
    private final AppleClient apple;
    private final TokenCipher cipher;
    private final PasswordResetRepository resets;
    private final MailService mail;
    private final GatemateProperties props;

    public AuthService(UserRepository users, PasswordEncoder encoder, TokenService tokens, SocialTokenVerifier social, AppleClient apple,
            TokenCipher cipher, PasswordResetRepository resets, MailService mail, GatemateProperties props) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
        this.social = social;
        this.apple = apple;
        this.cipher = cipher;
        this.resets = resets;
        this.mail = mail;
        this.props = props;
        this.dummyHash = encoder.encode(Crypto.token(16));
    }

    @Transactional
    public AuthDtos.Session register(AuthDtos.RegisterRequest r) {
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        PasswordPolicy.check(r.password(), email);
        if (users.findByEmail(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "email_taken", "An account with this email already exists.");
        }
        var u = newUser(r.name().trim(), email, "password");
        u.passwordHash = encoder.encode(r.password());
        String[] parts = u.displayName.split("\\s+", 2);
        u.legalFirstName = parts[0];
        u.legalLastName = parts.length > 1 ? parts[1] : null;
        users.save(u);
        return tokens.issue(u);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthDtos.Session login(AuthDtos.LoginRequest r) {
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        var found = users.findByEmail(email);
        if (found.isEmpty() || found.get().passwordHash == null) {
            encoder.matches(r.password(), dummyHash);
            throw badCredentials();
        }
        var u = found.get();
        Instant now = Instant.now();
        if (u.lockedUntil != null && u.lockedUntil.isAfter(now)) {
            throw ApiException.tooMany(Duration.between(now, u.lockedUntil).toSeconds() + 1);
        }
        if (!encoder.matches(r.password(), u.passwordHash)) {
            u.failedLogins++;
            int over = u.failedLogins - props.security().maxLoginAttempts();
            if (over >= 0) u.lockedUntil = now.plus(props.security().lockout().multipliedBy(1L << Math.min(over, 6)));
            users.save(u);
            throw badCredentials();
        }
        if (u.banned) throw new ApiException(HttpStatus.FORBIDDEN, "banned", "This account has been suspended for breaking the Community Guidelines.");
        u.failedLogins = 0;
        u.lockedUntil = null;
        if (encoder.upgradeEncoding(u.passwordHash)) u.passwordHash = encoder.encode(r.password());
        users.save(u);
        return tokens.issue(u);
    }

    @Transactional
    public AuthDtos.Session social(String provider, AuthDtos.SocialRequest r) {
        var id = social.verify(provider, r.idToken(), r.nonce());
        var existing = "apple".equals(provider) ? users.findByAppleSub(id.subject()) : users.findByGoogleSub(id.subject());
        UserEntity u = existing.orElseGet(() -> {
            // Link to an existing account only when the provider vouches for the e-mail.
            var byEmail = id.email() != null && id.emailVerified() ? users.findByEmail(id.email().toLowerCase(Locale.ROOT)) : java.util.Optional.<UserEntity>empty();
            UserEntity n = byEmail.orElseGet(() -> {
                String name = r.displayName() != null && !r.displayName().isBlank() ? r.displayName().trim() : ("apple".equals(provider) ? "Apple user" : "Google user");
                String email = id.email() != null ? id.email().toLowerCase(Locale.ROOT) : provider + "-" + id.subject() + "@users.gatemate.app";
                var x = newUser(name, email, provider);
                x.emailVerified = id.emailVerified();
                return x;
            });
            if ("apple".equals(provider)) n.appleSub = id.subject();
            else n.googleSub = id.subject();
            return n;
        });
        if (u.banned) throw new ApiException(HttpStatus.FORBIDDEN, "banned", "This account has been suspended for breaking the Community Guidelines.");
        if ("apple".equals(provider)) apple.exchangeCode(r.authorizationCode()).ifPresent(rt -> u.appleRefreshToken = cipher.encrypt(rt));
        users.save(u);
        return tokens.issue(u);
    }

    /** Always succeeds — never reveals whether the e-mail has an account. */
    @Transactional
    public void requestReset(String rawEmail) {
        users.findByEmail(rawEmail.trim().toLowerCase(Locale.ROOT)).filter(u -> u.passwordHash != null).ifPresent(u -> {
            String token = Crypto.token(32);
            var pr = new PasswordResetEntity();
            pr.tokenHash = Crypto.sha256(token);
            pr.userId = u.id;
            pr.expiresAt = Instant.now().plus(Duration.ofMinutes(30));
            resets.save(pr);
            mail.sendPasswordReset(u.email, props.mail().resetUrl() + "#token=" + token);
        });
    }

    @Transactional
    public void confirmReset(AuthDtos.ResetConfirm r) {
        var pr = resets.findById(Crypto.sha256(r.token())).filter(x -> x.usedAt == null && x.expiresAt.isAfter(Instant.now()))
                .orElseThrow(() -> ApiException.badRequest("invalid_token", "This reset link is invalid or has expired."));
        var u = users.findById(pr.userId).orElseThrow(() -> ApiException.notFound("Account"));
        PasswordPolicy.check(r.password(), u.email);
        u.passwordHash = encoder.encode(r.password());
        u.failedLogins = 0;
        u.lockedUntil = null;
        pr.usedAt = Instant.now();
        users.save(u);
        resets.save(pr);
        tokens.revokeAll(u.id); // sign out every device
    }

    private UserEntity newUser(String name, String email, String provider) {
        var u = new UserEntity();
        u.displayName = name.length() > 60 ? name.substring(0, 60) : name;
        u.email = email;
        u.provider = provider;
        u.avatarColor = COLORS[Math.floorMod(email.hashCode(), COLORS.length)];
        u.homeAirport = null;
        u.seatPreference = "no-preference";
        u.importToken = Crypto.token(12).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "x");
        return u;
    }

    private static ApiException badCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Incorrect email or password.");
    }
}
