package app.gatemate.auth;

import app.gatemate.common.ApiException;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;
    private final TokenService tokens;
    private final EmailVerificationService verification;

    public AuthController(AuthService auth, TokenService tokens, EmailVerificationService verification) {
        this.auth = auth;
        this.tokens = tokens;
        this.verification = verification;
    }

    @GetMapping("/features")
    public java.util.Map<String, Boolean> features() {
        return java.util.Map.of("emailCodes", verification.mailEnabled());
    }

    @PostMapping("/register")
    public AuthDtos.Session register(@Valid @RequestBody AuthDtos.RegisterRequest r) {
        var session = auth.register(r);
        verification.sendQuietly(session.user().id());
        return session;
    }

    @PostMapping("/login")
    public AuthDtos.Session login(@Valid @RequestBody AuthDtos.LoginRequest r) {
        return auth.login(r);
    }

    @PostMapping("/oauth/{provider}")
    public AuthDtos.Session social(@PathVariable String provider, @Valid @RequestBody AuthDtos.SocialRequest r) {
        if (!provider.equals("apple") && !provider.equals("google")) throw ApiException.badRequest("bad_provider", "Unsupported sign-in provider.");
        return auth.social(provider, r);
    }

    @PostMapping("/refresh")
    public AuthDtos.Session refresh(@Valid @RequestBody AuthDtos.RefreshRequest r) {
        return tokens.rotate(r.refreshToken());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody AuthDtos.RefreshRequest r) {
        try {
            var s = tokens.rotate(r.refreshToken());
            tokens.revokeAll(s.user().id());
        } catch (ApiException ignored) {
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset")
    public ResponseEntity<Void> reset(@Valid @RequestBody AuthDtos.ResetRequest r) {
        auth.requestReset(r.email());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> confirm(@Valid @RequestBody AuthDtos.ResetConfirm r) {
        auth.confirmReset(r);
        return ResponseEntity.noContent().build();
    }
}
