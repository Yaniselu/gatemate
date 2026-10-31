package app.gatemate.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

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
        String publicUrl) {
    public record Jwt(String issuer, Duration accessTtl, Duration refreshTtl, String privateKeyPem, String publicKeyPem) {}

    public record Apple(List<String> audiences, String teamId, String keyId, String clientId, String privateKeyPem) {
        public boolean canRevoke() {
            return notBlank(teamId) && notBlank(keyId) && notBlank(clientId) && notBlank(privateKeyPem);
        }
    }

    public record Google(List<String> audiences) {}

    public record Security(String tokenEncryptionKey, int maxLoginAttempts, Duration lockout) {}

    public record Booking(boolean sandbox, String inboundSecret, List<String> airlineEmailDomains, String importDomain, String importAddress) {}

    public record Mail(String from, String resetUrl, String provider, String apiKey, String fromName) {
        public Mail {
            if (fromName == null || fromName.isBlank()) fromName = "Gatemate";
        }
    }

    public record Billing(String webhookSecret, String secretApiKey, String entitlement, int freeUpcomingTrips) {}

    public record Integrations(String unsplashAccessKey, String aeroDataBoxKey, boolean publicDataEnabled) {}

    static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
