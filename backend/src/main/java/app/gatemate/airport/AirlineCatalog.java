package app.gatemate.airport;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class AirlineCatalog {
    public record Airline(String iata, List<String> icao, String name) {}

    private final Map<String, Airline> byIata = new HashMap<>();

    public AirlineCatalog(JsonMapper json) throws Exception {
        try (InputStream in = new ClassPathResource("data/airlines.json").getInputStream()) {
            for (JsonNode r : json.readTree(in)) {
                var icao = new ArrayList<String>();
                for (JsonNode c : r.get(1)) icao.add(c.asString());
                byIata.put(r.get(0).asString(), new Airline(r.get(0).asString(), List.copyOf(icao), r.get(2).asString()));
            }
        }
    }

    public Optional<Airline> get(String iata) {
        return iata == null ? Optional.empty() : Optional.ofNullable(byIata.get(iata.toUpperCase(Locale.ROOT)));
    }

    public boolean known(String iata) {
        return get(iata).isPresent();
    }
}
