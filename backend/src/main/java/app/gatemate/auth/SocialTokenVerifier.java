package app.gatemate.auth;

import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.config.GatemateProperties;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

@Component
public class SocialTokenVerifier {
    public record Identity(String subject, String email, boolean emailVerified) {}

    private final JwtDecoder apple;
    private final JwtDecoder google;

    @org.springframework.beans.factory.annotation.Autowired
    public SocialTokenVerifier(GatemateProperties props) {
        this.apple = decoder("https://appleid.apple.com/auth/keys", List.of("https://appleid.apple.com"), props.apple().audiences());
        this.google = decoder("https://www.googleapis.com/oauth2/v3/certs", List.of("https://accounts.google.com", "accounts.google.com"), props.google().audiences());
    }

    SocialTokenVerifier(JwtDecoder apple, JwtDecoder google) {
        this.apple = apple;
        this.google = google;
    }

    private static JwtDecoder decoder(String jwks, List<String> issuers, List<String> audiences) {
        var d = NimbusJwtDecoder.withJwkSetUri(jwks).build();
        d.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                jwt -> issuers.contains(String.valueOf(jwt.getClaims().get("iss"))) ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "bad issuer", null)),
                jwt -> jwt.getAudience() != null && jwt.getAudience().stream().anyMatch(audiences::contains) ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "bad audience", null))));
        return d;
    }

    public Identity verify(String provider, String idToken, String rawNonce) {
        Jwt jwt;
        try {
            jwt = switch (provider) {
                case "apple" -> apple.decode(idToken);
                case "google" -> google.decode(idToken);
                default -> throw ApiException.badRequest("bad_provider", "Unsupported sign-in provider.");
            };
        } catch (JwtException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_token", "Sign-in could not be verified. Please try again.");
        }
        String nonce = jwt.getClaimAsString("nonce");
        if (nonce == null || !(Crypto.constantTimeEquals(nonce, rawNonce) || Crypto.constantTimeEquals(nonce, Crypto.sha256(rawNonce)))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_nonce", "Sign-in could not be verified. Please try again.");
        }
        Object ev = jwt.getClaims().get("email_verified");
        boolean verified = Boolean.TRUE.equals(ev) || "true".equals(String.valueOf(ev));
        return new Identity(jwt.getSubject(), jwt.getClaimAsString("email"), verified);
    }
}
