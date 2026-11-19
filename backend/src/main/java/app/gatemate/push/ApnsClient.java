package app.gatemate.push;

import app.gatemate.config.GatemateProperties;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class ApnsClient {
    public enum Result { SENT, WRONG_ENVIRONMENT, GONE, FAILED }

    static final String PRODUCTION = "https://api.push.apple.com";
    static final String SANDBOX = "https://api.sandbox.push.apple.com";

    private final GatemateProperties.Apple apple;
    private final String topic;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_2).connectTimeout(Duration.ofSeconds(8)).build();
    private volatile String jwt;
    private volatile Instant jwtAt = Instant.EPOCH;

    public ApnsClient(GatemateProperties props, @Value("${gatemate.push.apns-topic:com.velosyntech.gatemate}") String topic, JsonMapper json) {
        this.apple = props.apple();
        this.topic = topic;
        this.json = json;
    }

    public boolean enabled() {
        return notBlank(apple.teamId()) && notBlank(apple.keyId()) && notBlank(apple.privateKeyPem());
    }

    public Result send(String host, String token, String title, String body, String thread) {
        Map<String, Object> aps = new LinkedHashMap<>();
        aps.put("alert", Map.of("title", title, "body", body));
        aps.put("sound", "default");
        if (thread != null) aps.put("thread-id", thread);
        try {
            var req = HttpRequest.newBuilder(URI.create(host + "/3/device/" + token))
                    .timeout(Duration.ofSeconds(10))
                    .header("authorization", "bearer " + providerToken())
                    .header("apns-topic", topic)
                    .header("apns-push-type", "alert")
                    .header("apns-priority", "10")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("aps", aps))))
                    .build();
            var res = http.send(req, HttpResponse.BodyHandlers.ofString());
            return classify(res.statusCode(), res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.FAILED;
        } catch (Exception e) {
            return Result.FAILED;
        }
    }

    static Result classify(int status, String body) {
        if (status == 200) return Result.SENT;
        if (status == 410) return Result.GONE;
        if (status == 400 && body != null && body.contains("BadDeviceToken")) return Result.WRONG_ENVIRONMENT;
        if (status == 400 && body != null && body.contains("DeviceTokenNotForTopic")) return Result.GONE;
        return Result.FAILED;
    }

    private String providerToken() throws Exception {
        if (jwt != null && Instant.now().isBefore(jwtAt.plus(Duration.ofMinutes(40)))) return jwt;
        synchronized (this) {
            if (jwt != null && Instant.now().isBefore(jwtAt.plus(Duration.ofMinutes(40)))) return jwt;
            byte[] der = Base64.getDecoder().decode(apple.privateKeyPem().replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", ""));
            var key = (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(der));
            var now = Instant.now();
            var claims = new JWTClaimsSet.Builder().issuer(apple.teamId()).issueTime(Date.from(now)).build();
            var signed = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(apple.keyId()).build(), claims);
            signed.sign(new ECDSASigner(key));
            jwt = signed.serialize();
            jwtAt = now;
            return jwt;
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
