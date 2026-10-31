package app.gatemate.auth;

import app.gatemate.config.GatemateProperties;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class AppleClient {
    private static final Logger log = LoggerFactory.getLogger(AppleClient.class);
    private final GatemateProperties.Apple cfg;
    private final RestClient http = app.gatemate.common.Http.builder().baseUrl("https://appleid.apple.com").build();

    public AppleClient(GatemateProperties props) {
        this.cfg = props.apple();
    }

    public Optional<String> exchangeCode(String code) {
        if (!cfg.canRevoke() || code == null || code.isBlank()) return Optional.empty();
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("client_id", cfg.clientId());
            form.add("client_secret", clientSecret());
            form.add("code", code);
            form.add("grant_type", "authorization_code");
            @SuppressWarnings("unchecked")
            Map<String, Object> res = http.post().uri("/auth/token").contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(Map.class);
            return Optional.ofNullable(res).map(r -> (String) r.get("refresh_token"));
        } catch (Exception e) {
            log.warn("Apple code exchange failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public void revoke(String refreshToken) {
        if (!cfg.canRevoke() || refreshToken == null) {
            log.warn("Apple token revocation skipped (Sign in with Apple keys not configured)");
            return;
        }
        var form = new LinkedMultiValueMap<String, String>();
        form.add("client_id", cfg.clientId());
        form.add("client_secret", clientSecret());
        form.add("token", refreshToken);
        form.add("token_type_hint", "refresh_token");
        http.post().uri("/auth/revoke").contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().toBodilessEntity();
    }

    private String clientSecret() {
        try {
            byte[] der = Base64.getDecoder().decode(cfg.privateKeyPem().replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", ""));
            var key = (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(der));
            var now = Instant.now();
            var claims = new JWTClaimsSet.Builder().issuer(cfg.teamId()).issueTime(Date.from(now)).expirationTime(Date.from(now.plusSeconds(300)))
                    .audience("https://appleid.apple.com").subject(cfg.clientId()).build();
            var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(cfg.keyId()).build(), claims);
            jwt.sign(new ECDSASigner(key));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException("Cannot build Apple client secret", e);
        }
    }
}
