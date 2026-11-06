package app.gatemate.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ProofOfWork {
    private static final Duration TTL = Duration.ofMinutes(5);
    private final SecureRandom random = new SecureRandom();
    private final byte[] key = new byte[32];
    private final int bits;
    private final Cache<String, Boolean> spent = Caffeine.newBuilder().expireAfterWrite(TTL.plusMinutes(1)).maximumSize(500_000).build();

    public ProofOfWork(@Value("${gatemate.security.pow-bits:16}") int bits) {
        this.bits = Math.max(0, Math.min(24, bits));
        random.nextBytes(key);
    }

    public boolean enabled() {
        return bits > 0;
    }

    public Map<String, Object> challenge() {
        byte[] salt = new byte[12];
        random.nextBytes(salt);
        String payload = Instant.now().plus(TTL).getEpochSecond() + "." + bits + "." + HexFormat.of().formatHex(salt);
        String token = b64(payload.getBytes(StandardCharsets.US_ASCII)) + "." + b64(hmac(payload));
        return Map.of("token", token, "bits", bits);
    }

    public boolean verify(String proof) {
        if (!enabled()) return true;
        if (proof == null || proof.length() > 300) return false;
        int colon = proof.lastIndexOf(':');
        if (colon < 1) return false;
        String token = proof.substring(0, colon), nonce = proof.substring(colon + 1);
        if (!nonce.matches("\\d{1,12}")) return false;
        int dot = token.indexOf('.');
        if (dot < 1) return false;
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(token.substring(0, dot)), StandardCharsets.US_ASCII);
            if (!MessageDigest.isEqual(hmac(payload), Base64.getUrlDecoder().decode(token.substring(dot + 1)))) return false;
        } catch (IllegalArgumentException e) {
            return false;
        }
        String[] parts = payload.split("\\.");
        if (parts.length != 3) return false;
        long exp;
        int need;
        try {
            exp = Long.parseLong(parts[0]);
            need = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            return false;
        }
        if (need < bits || Instant.now().getEpochSecond() > exp) return false;
        if (leadingZeroBits(sha256(token + ":" + nonce)) < need) return false;
        return spent.asMap().putIfAbsent(token, Boolean.TRUE) == null;
    }

    static int leadingZeroBits(byte[] h) {
        int n = 0;
        for (byte b : h) {
            if (b == 0) {
                n += 8;
                continue;
            }
            return n + Integer.numberOfLeadingZeros(b & 0xff) - 24;
        }
        return n;
    }

    static byte[] sha256(String s) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private byte[] hmac(String s) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(s.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String b64(byte[] b) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }
}
