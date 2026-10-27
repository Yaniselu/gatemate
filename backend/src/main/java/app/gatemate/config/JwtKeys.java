package app.gatemate.config;

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
import org.springframework.stereotype.Component;

/** RS256 signing keys for access tokens. In production both PEMs must be provided (env / secret manager). */
@Component
public class JwtKeys {
    private static final Logger log = LoggerFactory.getLogger(JwtKeys.class);
    public final RSAPublicKey publicKey;
    public final RSAPrivateKey privateKey;

    public JwtKeys(GatemateProperties props) throws Exception {
        var jwt = props.jwt();
        if (jwt.privateKeyPem() != null && !jwt.privateKeyPem().isBlank()) {
            KeyFactory kf = KeyFactory.getInstance("RSA");
            privateKey = (RSAPrivateKey) kf.generatePrivate(new PKCS8EncodedKeySpec(pem(jwt.privateKeyPem())));
            publicKey = (RSAPublicKey) kf.generatePublic(new X509EncodedKeySpec(pem(jwt.publicKeyPem())));
        } else {
            log.warn("No JWT keys configured — generating an ephemeral key pair (tokens die on restart). Never do this in production.");
            KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
            g.initialize(2048);
            KeyPair kp = g.generateKeyPair();
            privateKey = (RSAPrivateKey) kp.getPrivate();
            publicKey = (RSAPublicKey) kp.getPublic();
        }
    }

    static byte[] pem(String pem) {
        return Base64.getDecoder().decode(pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", ""));
    }
}
