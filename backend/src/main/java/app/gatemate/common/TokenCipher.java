package app.gatemate.common;

import app.gatemate.config.GatemateProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public class TokenCipher {
    private final SecretKeySpec key;
    private final boolean ephemeral;
    private final SecureRandom rng = new SecureRandom();

    public TokenCipher(GatemateProperties props) {
        String k = props.security().tokenEncryptionKey();
        byte[] raw;
        ephemeral = k == null || k.isBlank();
        if (ephemeral) {
            org.slf4j.LoggerFactory.getLogger(TokenCipher.class).warn("TOKEN_ENCRYPTION_KEY not set — using an ephemeral key. Never do this in production.");
            raw = new byte[32];
            rng.nextBytes(raw);
        } else {
            raw = decodeKey(k.trim());
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    private static byte[] decodeKey(String k) {
        try {
            byte[] b = Base64.getDecoder().decode(k);
            if (b.length == 32) return b;
        } catch (IllegalArgumentException notBase64) {
        }
        if (k.length() < 32) throw new IllegalStateException("TOKEN_ENCRYPTION_KEY is too short (use openssl rand -base64 32)");
        try {
            return java.security.MessageDigest.getInstance("SHA-256").digest(k.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public boolean isEphemeral() {
        return ephemeral;
    }

    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[12];
            rng.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array());
        } catch (Exception e) {
            throw new IllegalStateException("encrypt failed", e);
        }
    }

    public String decrypt(String b64) {
        try {
            byte[] all = Base64.getDecoder().decode(b64);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("decrypt failed", e);
        }
    }
}
