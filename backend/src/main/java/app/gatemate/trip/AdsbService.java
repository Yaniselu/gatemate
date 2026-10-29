package app.gatemate.trip;

import app.gatemate.airport.AirlineCatalog;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Live aircraft position from community ADS-B networks (ADS-B Exchange v2-compatible, free, no key), found by the
 * airline's radio callsign: ICAO code + flight number.
 */
@Service
public class AdsbService {
    private static final Logger log = LoggerFactory.getLogger(AdsbService.class);
    private static final List<String> NETWORKS = List.of("https://opendata.adsb.fi/api/v2/callsign/",
            "https://api.adsb.lol/v2/callsign/");
    private static final Pattern NUMBER = Pattern.compile("^([A-Z0-9]{2})\\s*(\\d{1,4})([A-Z]?)$");

    private final AirlineCatalog airlines;
    private final JsonMapper json;
    private final RestClient http = app.gatemate.common.Http.builder(Duration.ofSeconds(10)).build();
    private volatile boolean reported;

    public AdsbService(AirlineCatalog airlines, JsonMapper json) {
        this.airlines = airlines;
        this.json = json;
    }

    public List<String> callsigns(String flightNumber) {
        Matcher m = NUMBER.matcher(flightNumber == null ? "" : flightNumber.trim().toUpperCase());
        if (!m.matches()) return List.of();
        String num = Integer.parseInt(m.group(2)) + m.group(3);
        var out = new ArrayList<String>();
        airlines.get(m.group(1)).ifPresent(a -> a.icao().forEach(icao -> out.add(icao + num)));
        return out;
    }

    /** The freshest position for this flight, or empty when no receiver hears it. */
    public Optional<JsonNode> find(String flightNumber) {
        for (String cs : callsigns(flightNumber)) {
            for (String base : NETWORKS) {
                try {
                    String text = http.get().uri(base + cs).accept(MediaType.APPLICATION_JSON).retrieve().body(String.class);
                    JsonNode best = null;
                    for (JsonNode ac : json.readTree(text == null ? "{}" : text).path("ac")) {
                        if (!ac.has("lat")) continue;
                        if (best == null || ac.path("seen_pos").asDouble(99) < best.path("seen_pos").asDouble(99)) best = ac;
                    }
                    if (!reported) {
                        reported = true;
                        log.info("ADS-B network {} reachable", base);
                    }
                    if (best != null) return Optional.of(best);
                    break; // the network answered: this callsign isn't flying right now
                } catch (Exception e) {
                    log.debug("ADS-B {} {}: {}", base, cs, e.getMessage());
                }
            }
        }
        return Optional.empty();
    }
}
