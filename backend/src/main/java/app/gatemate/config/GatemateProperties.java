package app.gatemate.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** All tunables live under {@code gatemate.*}. Secrets come from environment variables, never from git. */
@ConfigurationProperties(prefix = "gatemate")
public record GatemateProperties(
        Jwt jwt,
        Apple apple,
        Google google,
        Security security,
        Booking booking,
        Mail mail,
        Integrations integrations,
        Billing billing,
        List<String> corsOrigins,
        /** Public https origin used to build invite links, e.g. https://gatemate.app */
        String publicUrl) {

    public record Jwt(String issuer, Duration accessTtl, Duration refreshTtl, String privateKeyPem, String publicKeyPem) {}

    /** Sign in with Apple. {@code privateKeyPem} is the .p8 key used for the client secret (code exchange + revocation). */
    public record Apple(List<String> audiences, String teamId, String keyId, String clientId, String privateKeyPem) {
        public boolean canRevoke() {
            return notBlank(teamId) && notBlank(keyId) && notBlank(clientId) && notBlank(privateKeyPem);
        }
    }

    public record Google(List<String> audiences) {}

    /** {@code tokenEncryptionKey}: base64 AES-256 key for third-party tokens stored at rest. */
    public record Security(String tokenEncryptionKey, int maxLoginAttempts, Duration lockout) {}

    /** {@code sandbox}: return deterministic demo bookings (development only). */
    /** importAddress: the provider's inbound address with {token}, e.g. "1a2b3c+{token}@cloudmailin.net". */
    public record Booking(boolean sandbox, String inboundSecret, List<String> airlineEmailDomains, String importDomain, String importAddress) {}

    public record Mail(String from, String resetUrl) {}

    /**
     * RevenueCat: {@code webhookSecret} is the Authorization header value configured on the webhook;
     * {@code secretApiKey} (optional) lets the server re-check a subscription right after a purchase.
     */
    public record Billing(String webhookSecret, String secretApiKey, String entitlement, int freeUpcomingTrips) {}

    public record Integrations(String unsplashAccessKey, String aeroDataBoxKey, boolean publicDataEnabled) {}

    static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
