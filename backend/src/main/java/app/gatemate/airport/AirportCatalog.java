package app.gatemate.airport;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
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
public class AirportCatalog {
    public record Airport(String iata, String icao, String name, String city, String country, double lat, double lon, String tz, String size) {}

    public record CountryFacts(String name, String capital, List<String> currency, List<String> languages, List<Integer> phone,
            String plugs, Integer volts, Boolean left, Map<String, String> sos) {}

    private final Map<String, Airport> byCode = new HashMap<>();
    private final List<Airport> all = new ArrayList<>();
    private final Map<String, CountryFacts> countries = new HashMap<>();

    public AirportCatalog(JsonMapper json) throws Exception {
        try (InputStream in = new ClassPathResource("data/airports.json").getInputStream()) {
            for (JsonNode a : json.readTree(in).get("airports")) {
                var ap = new Airport(a.get(0).asString(), a.get(1).asString(), a.get(2).asString(), a.get(3).asString(), a.get(4).asString(),
                        a.get(5).asDouble(), a.get(6).asDouble(), a.get(7).asString(), a.get(8).asString());
                all.add(ap);
                byCode.put(ap.iata(), ap);
            }
        }
        try (InputStream in = new ClassPathResource("data/countries.json").getInputStream()) {
            var root = json.readTree(in);
            for (var e : root.properties()) {
                countries.put(e.getKey(), json.treeToValue(e.getValue(), CountryFacts.class));
            }
        }
    }

    public Optional<Airport> get(String iata) {
        return iata == null ? Optional.empty() : Optional.ofNullable(byCode.get(iata.toUpperCase(Locale.ROOT)));
    }

    public List<Airport> large() {
        return all.stream().filter(a -> "L".equals(a.size())).toList();
    }

    public Optional<CountryFacts> country(String code) {
        return Optional.ofNullable(countries.get(code));
    }

    public String countryName(String code) {
        return country(code).map(CountryFacts::name).orElse(code);
    }

    public List<Airport> search(String q, int limit) {
        String f = fold(q);
        if (f.isBlank()) return all.stream().filter(a -> a.size().equals("L")).limit(limit).toList();
        return all.stream()
                .map(a -> Map.entry(a, score(a, f)))
                .filter(e -> e.getValue() < 99)
                .sorted(Comparator.comparingDouble(e -> e.getValue() + ("L".equals(e.getKey().size()) ? 0 : "M".equals(e.getKey().size()) ? 0.3 : 0.6)))
                .limit(limit)
                .map(Map.Entry::getKey)
                .toList();
    }

    private double score(Airport a, String q) {
        if (a.iata().equalsIgnoreCase(q)) return 0;
        if (a.icao().equalsIgnoreCase(q)) return 1;
        if (fold(a.city()).startsWith(q)) return 2;
        if (fold(a.name()).contains(q)) return 3;
        if (fold(countryName(a.country())).startsWith(q)) return 4;
        return 99;
    }

    public static double distanceKm(Airport a, Airport b) {
        double r = Math.PI / 180;
        double h = Math.pow(Math.sin((b.lat() - a.lat()) * r / 2), 2) + Math.cos(a.lat() * r) * Math.cos(b.lat() * r) * Math.pow(Math.sin((b.lon() - a.lon()) * r / 2), 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    private static String fold(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }
}
