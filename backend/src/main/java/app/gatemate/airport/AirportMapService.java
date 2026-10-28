package app.gatemate.airport;

import app.gatemate.config.GatemateProperties;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** Proxies the OpenStreetMap Overpass API (fair use: one query per airport per day via cache). */
@Service
public class AirportMapService {
    private static final Logger log = LoggerFactory.getLogger(AirportMapService.class);
    private static final Map<String, String> AMENITY = Map.of("cafe", "food", "restaurant", "food", "fast_food", "food", "bar", "food",
            "pharmacy", "pharmacy", "toilets", "toilets", "atm", "money", "bureau_de_change", "money", "charging_station", "charging");

    public record MapFeature(String kind, String ref, double lat, double lon, String poi) {}

    /** Public Overpass instances, tried in order (the main one is often busy). */
    private static final List<String> MIRRORS = List.of("https://overpass-api.de", "https://overpass.kumi.systems", "https://overpass.private.coffee");
    private final RestClient http = app.gatemate.common.Http.builder(java.time.Duration.ofSeconds(30)).build();
    private final boolean enabled;

    public AirportMapService(GatemateProperties props) {
        this.enabled = props.integrations().publicDataEnabled();
    }

    @Cacheable(cacheNames = "airportMaps", key = "#a.iata()")
    public List<MapFeature> features(AirportCatalog.Airport a) {
        if (!enabled) return List.of();
        String near = "(around:4000," + a.lat() + "," + a.lon() + ")";
        String q = "[out:json][timeout:25];(node[\"aeroway\"=\"gate\"]" + near + ";way[\"aeroway\"=\"terminal\"]" + near
                + ";node[\"amenity\"~\"^(cafe|restaurant|fast_food|bar|pharmacy|toilets|atm|bureau_de_change|charging_station)$\"]" + near
                + ";node[\"shop\"][\"name\"]" + near + ";node[\"tourism\"=\"information\"]" + near + ";);out center tags 400;";
        JsonNode res = null;
        for (String mirror : MIRRORS) {
            try {
                res = http.post().uri(mirror + "/api/interpreter").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body("data=" + java.net.URLEncoder.encode(q, java.nio.charset.StandardCharsets.UTF_8)).retrieve().body(JsonNode.class);
                if (res != null && res.has("elements")) break;
            } catch (Exception e) {
                log.warn("Overpass {} failed for {}: {}", mirror, a.iata(), e.getMessage());
            }
        }
        // Throwing (instead of returning an empty list) keeps a failure out of the cache and lets the app say "try again".
        if (res == null || !res.has("elements")) {
            throw new app.gatemate.common.ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "upstream_unavailable", "Airport map data is temporarily unavailable.");
        }
        try {
            var out = new ArrayList<MapFeature>();
            for (JsonNode e : res.path("elements")) {
                JsonNode t = e.path("tags");
                double lat = e.has("lat") ? e.get("lat").asDouble() : e.path("center").path("lat").asDouble();
                double lon = e.has("lon") ? e.get("lon").asDouble() : e.path("center").path("lon").asDouble();
                String aeroway = t.path("aeroway").asString("");
                if (aeroway.equals("gate")) {
                    String ref = t.path("ref").asString(t.path("name").asString(""));
                    if (!ref.isBlank()) out.add(new MapFeature("gate", ref, lat, lon, null));
                } else if (aeroway.equals("terminal")) {
                    out.add(new MapFeature("terminal", t.path("name").asString(t.path("ref").asString("Terminal")), lat, lon, null));
                } else {
                    String poi = AMENITY.getOrDefault(t.path("amenity").asString(""), t.path("tourism").asString("").equals("information") ? "info" : "shop");
                    String name = t.path("name").asString("");
                    if (!name.isBlank() || !poi.equals("shop")) out.add(new MapFeature("poi", name.isBlank() ? defaultName(poi) : name, lat, lon, poi));
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("Overpass query failed for {}: {}", a.iata(), e.getMessage());
            return List.of();
        }
    }

    private static String defaultName(String poi) {
        return switch (poi) {
            case "food" -> "Café";
            case "pharmacy" -> "Pharmacy";
            case "toilets" -> "Toilets";
            case "money" -> "ATM";
            case "charging" -> "Charging";
            case "info" -> "Information";
            default -> "Shop";
        };
    }
}
