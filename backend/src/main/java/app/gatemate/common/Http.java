package app.gatemate.common;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Outbound HTTP for third-party APIs. HTTP/1.1 on purpose: several public data services drop HTTP/2 connections from
 * the JDK client mid-request ("I/O error … null"). Short timeouts so a slow provider never blocks the app.
 */
public final class Http {
    public static final String USER_AGENT = "Gatemate/1.0 (support@gatemate.app)";
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private Http() {}

    public static RestClient.Builder builder(Duration readTimeout) {
        var factory = new JdkClientHttpRequestFactory(CLIENT);
        factory.setReadTimeout(readTimeout);
        return RestClient.builder().requestFactory(factory).defaultHeader("User-Agent", USER_AGENT);
    }

    public static RestClient.Builder builder() {
        return builder(Duration.ofSeconds(15));
    }
}
