package app.gatemate.config;

import app.gatemate.common.TokenCipher;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class JwtKeys {
    private static final Logger log = LoggerFactory.getLogger(JwtKeys.class);
    private static final String DB_ID = "jwt-rsa";
    public final RSAPublicKey publicKey;
    public final RSAPrivateKey privateKey;

    public JwtKeys(GatemateProperties props, TokenCipher cipher, JdbcTemplate jdbc) throws Exception {
        var jwt = props.jwt();
        KeyFactory kf = KeyFactory.getInstance("RSA");
        if (jwt.privateKeyPem() != null && !jwt.privateKeyPem().isBlank()) {
            privateKey = (RSAPrivateKey) kf.generatePrivate(new PKCS8EncodedKeySpec(pem(jwt.privateKeyPem())));
            publicKey = (RSAPublicKey) kf.generatePublic(new X509EncodedKeySpec(pem(jwt.publicKeyPem())));
            return;
        }
        if (cipher.isEphemeral()) {
            log.warn("No JWT keys and no TOKEN_ENCRYPTION_KEY — using an in-memory key pair (sessions end on restart). Never do this in production.");
            KeyPair kp = generate();
            privateKey = (RSAPrivateKey) kp.getPrivate();
            publicKey = (RSAPublicKey) kp.getPublic();
            return;
        }
        KeyPair kp = loadOrCreate(cipher, jdbc, kf);
        privateKey = (RSAPrivateKey) kp.getPrivate();
        publicKey = (RSAPublicKey) kp.getPublic();
    }

    private static KeyPair loadOrCreate(TokenCipher cipher, JdbcTemplate jdbc, KeyFactory kf) throws Exception {
        var stored = jdbc.queryForList("SELECT secret FROM server_keys WHERE id = ?", String.class, DB_ID);
        if (!stored.isEmpty()) {
            try {
                return decode(cipher.decrypt(stored.get(0)), kf);
            } catch (IllegalStateException e) {
                log.warn("Stored JWT key can't be decrypted with the current TOKEN_ENCRYPTION_KEY — rotating it.");
                jdbc.update("DELETE FROM server_keys WHERE id = ?", DB_ID);
            }
        }
        KeyPair kp = generate();
        String encoded = Base64.getEncoder().encodeToString(kp.getPrivate().getEncoded()) + "." + Base64.getEncoder().encodeToString(kp.getPublic().getEncoded());
        try {
            jdbc.update("INSERT INTO server_keys (id, secret) VALUES (?, ?)", DB_ID, cipher.encrypt(encoded));
            log.info("Generated and stored a new JWT signing key.");
            return kp;
        } catch (DuplicateKeyException race) {
            return decode(cipher.decrypt(jdbc.queryForObject("SELECT secret FROM server_keys WHERE id = ?", String.class, DB_ID)), kf);
        }
    }

    private static KeyPair decode(String encoded, KeyFactory kf) throws Exception {
        String[] parts = encoded.split("\\.", 2);
        return new KeyPair(kf.generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(parts[1]))),
                kf.generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(parts[0]))));
    }

    private static KeyPair generate() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(3072);
        return g.generateKeyPair();
    }

    static byte[] pem(String pem) {
        return Base64.getDecoder().decode(pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", ""));
    }
}
