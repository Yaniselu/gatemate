package app.gatemate.airport;

import app.gatemate.common.ApiException;
import app.gatemate.config.GatemateProperties;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Everything inside an airport from OpenStreetMap (Overpass): terminals with outlines, gates and facilities.
 * Same query and output as the app's own direct request, used when the phone can't reach Overpass.
 * Cached per airport for a day (Overpass fair use).
 */
@Service
public class AirportMapService {
    private static final Logger log = LoggerFactory.getLogger(AirportMapService.class);

    public record MapFeature(String id, String kind, String ref, double lat, double lon, String poi, String terminal, String level, String hours,
            String brand, String detail, List<List<double[]>> outline) {}

    private static final Map<String, String> AMENITY = new LinkedHashMap<>();
    static {
        put("coffee", "cafe");
        put("food", "restaurant", "fast_food", "food_court", "ice_cream");
        put("bar", "bar", "pub", "biergarten");
        put("pharmacy", "pharmacy");
        put("medical", "clinic", "doctors", "first_aid", "hospital", "dentist");
        put("toilets", "toilets", "shower");
        put("family", "baby_changing", "childcare", "kindergarten");
        put("money", "atm", "bureau_de_change", "bank", "money_transfer", "payment_terminal");
        put("charging", "device_charging_station");
        put("lounge", "lounge");
        put("prayer", "place_of_worship", "prayer_room");
        put("info", "information");
        put("transport", "taxi", "bus_station", "car_rental", "car_sharing", "ferry_terminal");
        put("parking", "parking", "motorcycle_parking", "charging_station");
        put("services", "luggage_locker", "left_luggage", "post_office", "lost_property", "smoking_area", "drinking_water", "water_point", "police",
                "internet_cafe", "telephone", "townhall", "customs", "conference_centre", "coworking_space");
    }

    private static void put(String kind, String... amenities) {
        for (String a : amenities) AMENITY.put(a, kind);
    }

    /** Public Overpass instances, tried in order; overpass-api.de refuses some cloud IP ranges, so it isn't first here. */
    private static final List<String> MIRRORS = List.of("https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter");
    private final RestClient http = app.gatemate.common.Http.builder(Duration.ofSeconds(60)).build();
    private final JsonMapper json;
    private final boolean enabled;

    public AirportMapService(GatemateProperties props, JsonMapper json) {
        this.enabled = props.integrations().publicDataEnabled();
        this.json = json;
    }

    @Cacheable(cacheNames = "airportMaps", key = "#a.iata()")
    public List<MapFeature> features(AirportCatalog.Airport a) {
        if (!enabled) return List.of();
        var inside = parse(query(areaQuery(a), a.iata()));
        if (!inside.isEmpty()) return inside;
        return parse(query(aroundQuery(a), a.iata()));
    }

    private JsonNode query(String q, String iata) {
        String body = "data=" + URLEncoder.encode(q, StandardCharsets.UTF_8);
        for (String mirror : MIRRORS) {
            try {
                // Some mirrors send JSON as application/octet-stream: read text and parse it ourselves.
                String text = http.post().uri(mirror).contentType(MediaType.APPLICATION_FORM_URLENCODED).accept(MediaType.ALL).body(body).retrieve().body(String.class);
                JsonNode res = text == null ? null : json.readTree(text);
                if (res != null && res.has("elements")) return res.path("elements");
                log.warn("Overpass {} returned no elements for {}", mirror, iata);
            } catch (Exception e) {
                log.warn("Overpass {} failed for {}: {}", mirror, iata, e.getMessage());
            }
        }
        // Throwing (instead of returning an empty list) keeps a failure out of the cache and lets the app say "try again".
        throw new ApiException(HttpStatus.BAD_GATEWAY, "upstream_unavailable", "Airport map data is temporarily unavailable.");
    }

    private static String selectors(String scope) {
        String amenities = String.join("|", AMENITY.keySet());
        return "nwr[\"aeroway\"=\"gate\"]" + scope + ";nwr[\"amenity\"~\"^(" + amenities + ")$\"]" + scope + ";nwr[\"shop\"]" + scope
                + ";nwr[\"tourism\"~\"^(information|hotel)$\"]" + scope + ";nwr[\"emergency\"=\"defibrillator\"]" + scope + ";nwr[\"public_transport\"=\"station\"]" + scope
                + ";nwr[\"railway\"~\"^(station|halt)$\"]" + scope + ";nwr[\"leisure\"=\"playground\"]" + scope + ";";
    }

    static String areaQuery(AirportCatalog.Airport a) {
        var ids = new ArrayList<String>();
        ids.add("[\"iata\"=\"" + a.iata() + "\"]");
        if (a.icao() != null && !a.icao().isBlank()) ids.add("[\"icao\"=\"" + a.icao() + "\"]");
        var sb = new StringBuilder();
        for (String t : ids) sb.append("way[\"aeroway\"=\"aerodrome\"]").append(t).append(";relation[\"aeroway\"=\"aerodrome\"]").append(t).append(";");
        return "[out:json][timeout:60];(" + sb + ")->.ap;.ap map_to_area->.a;(" + selectors("(area.a)")
                + ");out center tags;(way[\"aeroway\"=\"terminal\"](area.a);relation[\"aeroway\"=\"terminal\"](area.a););out geom tags;";
    }

    static String aroundQuery(AirportCatalog.Airport a) {
        String near = "(around:3000," + a.lat() + "," + a.lon() + ")";
        return "[out:json][timeout:60];(" + selectors(near) + ");out center tags;(way[\"aeroway\"=\"terminal\"]" + near + ";relation[\"aeroway\"=\"terminal\"]" + near
                + ";);out geom tags;";
    }

    public static List<MapFeature> parse(JsonNode elements) {
        var terminals = new ArrayList<MapFeature>();
        var rest = new ArrayList<JsonNode>();
        Set<String> seen = new HashSet<>();
        for (JsonNode e : elements) {
            String key = e.path("type").asString("") + e.path("id").asLong();
            if (!seen.add(key)) continue;
            JsonNode t = e.path("tags");
            if ("terminal".equals(t.path("aeroway").asString(""))) {
                var rings = new ArrayList<List<double[]>>();
                if (e.has("geometry")) rings.add(points(e.path("geometry")));
                for (JsonNode m : e.path("members")) if (!"inner".equals(m.path("role").asString("")) && m.has("geometry")) rings.add(points(m.path("geometry")));
                rings.removeIf(List::isEmpty);
                if (rings.isEmpty()) continue;
                double la = 0, lo = 0;
                int n = 0;
                for (var r : rings) for (double[] p : r) { la += p[0]; lo += p[1]; n++; }
                terminals.add(new MapFeature(key, "terminal", terminalName(t), la / n, lo / n, null, null, null, null, null, null, rings));
            } else rest.add(e);
        }
        var out = new ArrayList<MapFeature>(terminals);
        for (JsonNode e : rest) {
            JsonNode t = e.path("tags");
            boolean hasPoint = e.has("lat") || e.has("center");
            if (!hasPoint) continue;
            double lat = e.has("lat") ? e.path("lat").asDouble() : e.path("center").path("lat").asDouble();
            double lon = e.has("lon") ? e.path("lon").asDouble() : e.path("center").path("lon").asDouble();
            String id = e.path("type").asString("") + e.path("id").asLong();
            String terminal = t.hasNonNull("terminal") ? terminalLabel(t.path("terminal").asString()) : null;
            if (terminal == null) for (var term : terminals) if (term.outline().stream().anyMatch(r -> inside(lat, lon, r))) { terminal = term.ref(); break; }
            String level = blank(t.path("level").asString(""));
            if ("gate".equals(t.path("aeroway").asString(""))) {
                String ref = t.path("ref").asString(t.path("name").asString("")).trim();
                if (!ref.isEmpty()) out.add(new MapFeature(id, "gate", ref, lat, lon, null, terminal, level, null, null, null, null));
                continue;
            }
            String poi = classify(t);
            if (poi == null) continue;
            String name = t.path("name").asString(t.path("brand").asString("")).trim();
            if (name.isEmpty() && (poi.equals("shop") || poi.equals("parking") || poi.equals("hotel"))) continue;
            String detail = blank(t.path("cuisine").asString("").replace('_', ' ').replace(";", ", "));
            if (detail == null) detail = blank(t.path("operator").asString(""));
            out.add(new MapFeature(id, "poi", name.isEmpty() ? fallbackName(poi, t) : name, lat, lon, poi, terminal, level, blank(t.path("opening_hours").asString("")),
                    blank(t.path("brand").asString("")), detail, null));
        }
        return out;
    }

    static String classify(JsonNode t) {
        String amenity = t.path("amenity").asString(""), shop = t.path("shop").asString(""), name = t.path("name").asString("").toLowerCase();
        if (amenity.equals("lounge") || (name.matches(".*\\blounge\\b.*") && shop.isEmpty())) return "lounge";
        if (amenity.equals("cafe") || t.path("cuisine").asString("").contains("coffee")) return "coffee";
        if (AMENITY.containsKey(amenity)) return AMENITY.get(amenity);
        if (shop.equals("duty_free") || t.path("duty_free").asString("").equals("yes")) return "dutyfree";
        if (shop.equals("chemist")) return "pharmacy";
        if (shop.equals("coffee")) return "coffee";
        if (shop.equals("bakery") || shop.equals("pastry") || shop.equals("confectionery")) return "food";
        if (!shop.isEmpty()) return "shop";
        if (t.path("emergency").asString("").equals("defibrillator")) return "medical";
        String tourism = t.path("tourism").asString("");
        if (tourism.equals("information")) return "info";
        if (tourism.equals("hotel")) return "hotel";
        if (t.path("leisure").asString("").equals("playground")) return "family";
        if (t.path("public_transport").asString("").equals("station") || t.path("railway").asString("").matches("station|halt")) return "transport";
        return null;
    }

    private static String fallbackName(String poi, JsonNode t) {
        return switch (t.path("amenity").asString("")) {
            case "atm" -> "ATM";
            case "bureau_de_change" -> "Currency exchange";
            case "baby_changing" -> "Baby changing";
            case "luggage_locker", "left_luggage" -> "Left luggage";
            case "smoking_area" -> "Smoking area";
            case "drinking_water", "water_point" -> "Drinking water";
            case "post_office" -> "Post office";
            case "lost_property" -> "Lost & found";
            case "taxi" -> "Taxi rank";
            case "car_rental" -> "Car rental";
            case "charging_station" -> "EV charging";
            case "first_aid" -> "First aid";
            default -> switch (poi) {
                case "coffee" -> "Café";
                case "food" -> "Restaurant";
                case "bar" -> "Bar";
                case "pharmacy" -> "Pharmacy";
                case "toilets" -> "Toilets";
                case "money" -> "Money";
                case "charging" -> "Phone charging";
                case "lounge" -> "Lounge";
                case "prayer" -> "Prayer room";
                case "info" -> "Information";
                case "medical" -> t.path("emergency").asString("").equals("defibrillator") ? "Defibrillator (AED)" : "Medical";
                case "transport" -> "Station";
                case "family" -> "Family room";
                default -> "Service";
            };
        };
    }

    private static List<double[]> points(JsonNode geometry) {
        var out = new ArrayList<double[]>();
        for (JsonNode p : geometry) out.add(new double[] {p.path("lat").asDouble(), p.path("lon").asDouble()});
        return out;
    }

    private static String terminalName(JsonNode t) {
        String name = t.path("name").asString("");
        if (!name.isBlank()) return name;
        String ref = t.path("ref").asString("");
        return ref.isBlank() ? "Terminal" : terminalLabel(ref);
    }

    private static String terminalLabel(String ref) {
        String r = ref.trim();
        return r.matches("(?i)t?\\d+[a-z]?") ? "Terminal " + r.replaceFirst("(?i)^t", "") : r;
    }

    private static boolean inside(double lat, double lon, List<double[]> ring) {
        boolean hit = false;
        for (int i = 0, j = ring.size() - 1; i < ring.size(); j = i++) {
            double yi = ring.get(i)[0], xi = ring.get(i)[1], yj = ring.get(j)[0], xj = ring.get(j)[1];
            if ((yi > lat) != (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
        }
        return hit;
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
