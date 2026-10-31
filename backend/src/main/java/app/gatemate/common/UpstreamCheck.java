package app.gatemate.common;

import app.gatemate.config.GatemateProperties;
import java.time.Duration;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class UpstreamCheck {
    private static final Logger log = LoggerFactory.getLogger(UpstreamCheck.class);
    private static final List<String> TARGETS = List.of(
            "https://opendata.adsb.fi/api/v2/callsign/TEST1", "https://api.adsb.lol/v2/callsign/TEST1",
            "https://overpass.private.coffee/api/status", "https://overpass.kumi.systems/api/status", "https://overpass-api.de/api/status",
            "https://en.wikipedia.org/api/rest_v1/page/summary/Paris", "https://api.open-meteo.com/v1/forecast?latitude=44.4&longitude=26.1&current=temperature_2m");
    private final boolean enabled;
    private final RestClient http = Http.builder(Duration.ofSeconds(10)).build();

    public UpstreamCheck(GatemateProperties props) {
        this.enabled = props.integrations().publicDataEnabled();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void check() {
        if (!enabled) return;
        Thread.ofVirtual().name("upstream-check").start(() -> {
            for (String url : TARGETS) {
                String host = url.replaceFirst("https://([^/]+)/.*", "$1");
                try {
                    var res = http.get().uri(url).accept(MediaType.ALL).retrieve().toBodilessEntity();
                    log.info("Upstream {} reachable ({})", host, res.getStatusCode().value());
                } catch (Exception e) {
                    log.warn("Upstream {} NOT reachable: {}", host, e.getMessage());
                }
            }
        });
    }
}
