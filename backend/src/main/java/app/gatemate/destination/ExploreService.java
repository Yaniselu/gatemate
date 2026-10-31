package app.gatemate.destination;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.common.ApiException;
import app.gatemate.config.GatemateProperties;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

@Service
public class ExploreService {
    private static final Logger log = LoggerFactory.getLogger(ExploreService.class);
    private static final Pattern POINT = Pattern.compile("Point\\(([-\\d.]+) ([-\\d.]+)\\)");
    private static final Pattern QID = Pattern.compile("^Q\\d+$");
    public static final List<String> FX = List.of("EUR", "USD", "GBP", "RON", "CHF", "PLN", "CZK", "HUF", "BGN", "DKK", "SEK", "NOK", "ISK", "TRY", "JPY",
            "CNY", "KRW", "HKD", "SGD", "THB", "MYR", "IDR", "PHP", "INR", "ILS", "AUD", "NZD", "CAD", "MXN", "BRL", "ZAR");

    public record Sight(String id, String name, String description, String image, double lat, double lon, double distanceKm, String wikipedia) {}

    public record Holiday(String date, String localName, String name, boolean national) {}

    public record Rate(String base, String currency, double rate, String date) {}

    private final AirportCatalog airports;
    private final DestinationService destinations;
    private final boolean enabled;
    private final RestClient http = app.gatemate.common.Http.builder(java.time.Duration.ofSeconds(30)).build();

    public ExploreService(AirportCatalog airports, DestinationService destinations, GatemateProperties props) {
        this.airports = airports;
        this.destinations = destinations;
        this.enabled = props.integrations().publicDataEnabled();
    }

    @Cacheable(cacheNames = "sights", key = "#iata")
    public List<Sight> sights(String iata) {
        var a = airports.get(iata).orElseThrow(() -> ApiException.notFound("Airport"));
        if (!enabled) return List.of();
        double lat = a.lat(), lon = a.lon();
        Object summary = destinations.get(a.iata(), "EUR").get("summary");
        if (summary instanceof Map<?, ?> m && m.get("coords") instanceof Map<?, ?> c) {
            lat = ((Number) c.get("lat")).doubleValue();
            lon = ((Number) c.get("lon")).doubleValue();
        }
        try {
            JsonNode res = http.get().uri(java.net.URI.create("https://query.wikidata.org/sparql?format=json&query=" + URLEncoder.encode(sightsQuery(lat, lon, 8), StandardCharsets.UTF_8)))
                    .header("Accept", "application/sparql-results+json").retrieve().body(JsonNode.class);
            return parse(res);
        } catch (Exception e) {
            log.warn("Wikidata sights failed for {}: {}", iata, e.getMessage());
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "upstream_unavailable", "Sights are temporarily unavailable.");
        }
    }

    static String sightsQuery(double lat, double lon, int radiusKm) {
        return String.format(Locale.ROOT, """
                SELECT ?item ?itemLabel ?desc ?img ?loc ?dist ?links ?article WHERE {
                  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(%.5f %.5f)"^^geo:wktLiteral ; wikibase:radius "%d" ; wikibase:distance ?dist . }
                  VALUES ?type { wd:Q570116 wd:Q33506 wd:Q16970 wd:Q839954 wd:Q4989906 wd:Q23413 wd:Q12280 wd:Q22698 wd:Q2977 wd:Q44539 wd:Q174782 wd:Q1107656 wd:Q16560 wd:Q32815 wd:Q207694 wd:Q1076486 wd:Q40080 wd:Q11303 wd:Q483453 wd:Q57821 }
                  ?item wdt:P31/wdt:P279? ?type .
                  ?item wikibase:sitelinks ?links .
                  FILTER(?links >= 8)
                  OPTIONAL { ?item wdt:P18 ?img . }
                  OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
                  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
                  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" . }
                } ORDER BY DESC(?links) LIMIT 60""", lon, lat, radiusKm);
    }

    static List<Sight> parse(JsonNode res) {
        var out = new ArrayList<Sight>();
        var seen = new HashSet<String>();
        for (JsonNode b : res.path("results").path("bindings")) {
            String uri = b.path("item").path("value").asString("");
            String id = uri.substring(uri.lastIndexOf('/') + 1);
            String name = b.path("itemLabel").path("value").asString("");
            Matcher m = POINT.matcher(b.path("loc").path("value").asString(""));
            if (id.isBlank() || name.isBlank() || QID.matcher(name).matches() || !m.find() || !seen.add(id)) continue;
            String img = b.path("img").path("value").asString(null);
            out.add(new Sight(id, name, b.path("desc").path("value").asString(null), img == null ? null : img.replaceFirst("^http:", "https:") + "?width=480",
                    Double.parseDouble(m.group(2)), Double.parseDouble(m.group(1)), Math.round(b.path("dist").path("value").asDouble(0) * 10) / 10.0,
                    b.path("article").path("value").asString(null)));
            if (out.size() >= 24) break;
        }
        return out;
    }

    @Cacheable(cacheNames = "holidays", key = "#country + '|' + #year")
    public List<Holiday> holidays(String country, int year) {
        if (!country.matches("[A-Z]{2}") || year < 2000 || year > 2100) throw ApiException.badRequest("bad_request", "Invalid country or year.");
        if (!enabled) return List.of();
        try {
            JsonNode res = http.get().uri("https://date.nager.at/api/v3/PublicHolidays/{y}/{c}", year, country).retrieve().body(JsonNode.class);
            var out = new ArrayList<Holiday>();
            if (res != null) for (JsonNode h : res) {
                out.add(new Holiday(h.path("date").asString(), h.path("localName").asString(""), h.path("name").asString(""), h.path("global").asBoolean(true)));
            }
            return out;
        } catch (org.springframework.web.client.HttpClientErrorException.NotFound e) {
            return List.of();
        } catch (Exception e) {
            log.warn("Holidays failed for {} {}: {}", country, year, e.getMessage());
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "upstream_unavailable", "Holiday calendar is temporarily unavailable.");
        }
    }

    @Cacheable(cacheNames = "fx", key = "#from + '|' + #to")
    public Rate rate(String from, String to) {
        if (!FX.contains(from) || !FX.contains(to)) throw ApiException.badRequest("bad_currency", "Unsupported currency.");
        if (from.equals(to)) return new Rate(from, to, 1, LocalDate.now().toString());
        try {
            JsonNode j = http.get().uri("https://api.frankfurter.app/latest?from={b}&to={c}", from, to).retrieve().body(JsonNode.class);
            return new Rate(from, to, j.path("rates").path(to).asDouble(), j.path("date").asString(""));
        } catch (Exception e) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "upstream_unavailable", "Exchange rates are temporarily unavailable.");
        }
    }
}
