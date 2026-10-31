package app.gatemate.common;

import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

public final class Http {
    public static final String USER_AGENT = "Gatemate/1.0 (support@gatemate.app)";

    private Http() {}

    public static RestClient.Builder builder(Duration readTimeout) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(8));
        factory.setReadTimeout(readTimeout);
        return RestClient.builder().requestFactory(factory).defaultHeader("User-Agent", USER_AGENT).defaultHeader("Accept", "application/json");
    }

    public static RestClient.Builder builder() {
        return builder(Duration.ofSeconds(15));
    }
}
