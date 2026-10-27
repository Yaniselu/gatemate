package app.gatemate;

import static org.junit.jupiter.api.Assertions.*;

import app.gatemate.common.TokenCipher;
import app.gatemate.config.GatemateProperties;
import app.gatemate.config.JwtKeys;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JwtKeysTest {
    private static GatemateProperties props(String encKey) {
        return new GatemateProperties(new GatemateProperties.Jwt("iss", Duration.ofMinutes(15), Duration.ofDays(60), null, null), null, null,
                new GatemateProperties.Security(encKey, 5, Duration.ofMinutes(15)), null, null, null, null, null);
    }

    @Test
    void generatedKeySurvivesRestartAndRotatesWhenEncryptionKeyChanges() throws Exception {
        var jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:keys;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("CREATE TABLE server_keys (id VARCHAR(40) PRIMARY KEY, secret TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        var p = props("q2d9WQ0x6M2b2wQwq3l0Hc0b4e0tH7Kc2h3VqJ8nYw0=");
        var first = new JwtKeys(p, new TokenCipher(p), jdbc);
        var second = new JwtKeys(p, new TokenCipher(p), jdbc);
        assertEquals(first.publicKey, second.publicKey, "same key after a restart");
        // The private key is never stored in clear text.
        String stored = jdbc.queryForObject("SELECT secret FROM server_keys", String.class);
        assertFalse(stored.contains(java.util.Base64.getEncoder().encodeToString(first.privateKey.getEncoded()).substring(0, 40)));

        var other = props("a-completely-different-but-long-enough-secret-value");
        var rotated = new JwtKeys(other, new TokenCipher(other), jdbc);
        assertNotEquals(first.publicKey, rotated.publicKey);
    }
}
