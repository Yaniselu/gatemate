package app.gatemate.destination;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.common.ApiException;
import app.gatemate.config.GatemateProperties;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/**
 * Aggregates the destination guide server-side so the app makes a single request and third-party keys stay off the device:
 * Wikipedia summary, Unsplash photo (licensed, with photographer credit) or Wikimedia fallback, Open-Meteo weather and ECB rates.
 * Each part is optional: a failing source is simply left out.
 */
@Service
public class DestinationService {
    private static final Logger log = LoggerFactory.getLogger(DestinationService.class);
    private static final String UA = "Gatemate/1.0 (support@gatemate.app)";
    private final AirportCatalog airports;
    private final GatemateProperties.Integrations cfg;
    private final RestClient http = RestClient.builder().defaultHeader("User-Agent", UA).build();

    public DestinationService(AirportCatalog airports, GatemateProperties props) {
        this.airports = airports;
        this.cfg = props.integrations();
    }

    @Cacheable(cacheNames = "destinations", key = "#iata + '|' + #home")
    public Map<String, Object> get(String iata, String home) {
        var a = airports.get(iata).orElseThrow(() -> ApiException.notFound("Airport"));
        var country = airports.country(a.country());
        var out = new LinkedHashMap<String, Object>();
        out.put("airport", Map.of("iata", a.iata(), "icao", a.icao(), "name", a.name(), "city", a.city(), "country", a.country(), "lat", a.lat(), "lon", a.lon(),
                "tz", a.tz(), "size", a.size()));
        country.ifPresent(c -> out.put("country", c));
        if (!cfg.publicDataEnabled()) return out;

        var wiki = CompletableFuture.supplyAsync(() -> wiki(a, country.map(AirportCatalog.CountryFacts::name).orElse(null)));
        var weather = CompletableFuture.supplyAsync(() -> weather(a));
        var fx = CompletableFuture.supplyAsync(() -> fx(home, country.map(c -> c.currency().isEmpty() ? null : c.currency().get(0)).orElse(null)));
        var unsplash = CompletableFuture.supplyAsync(() -> unsplash(a.city(), country.map(AirportCatalog.CountryFacts::name).orElse("")));

        Map<String, Object> w = wiki.join();
        if (w != null) {
            out.put("summary", w.get("summary"));
            if (w.get("photo") != null) out.put("photo", w.get("photo"));
        }
        var u = unsplash.join();
        if (u != null) out.put("photo", u);
        var we = weather.join();
        if (we != null) out.put("weather", we);
        var r = fx.join();
        if (r != null) out.put("fx", r);
        return out;
    }

    private Map<String, Object> wiki(AirportCatalog.Airport a, String countryName) {
        var titles = new ArrayList<String>(List.of(a.city()));
        if (countryName != null) titles.add(a.city() + ", " + countryName);
        for (String t : titles) {
            try {
                JsonNode j = http.get().uri(java.net.URI.create("https://en.wikipedia.org/api/rest_v1/page/summary/" + URLEncoder.encode(t.replace(' ', '_'), StandardCharsets.UTF_8).replace("+", "%20")))
                        .retrieve().body(JsonNode.class);
                if (j == null || "disambiguation".equals(j.path("type").asString("")) || j.path("extract").asString("").isBlank()) continue;
                String page = j.path("content_urls").path("mobile").path("page").asString(j.path("content_urls").path("desktop").path("page").asString(""));
                var summary = new LinkedHashMap<String, Object>();
                summary.put("title", j.path("title").asString(""));
                if (j.hasNonNull("description")) summary.put("description", j.get("description").asString());
                summary.put("extract", j.path("extract").asString(""));
                summary.put("pageUrl", page);
                JsonNode co = j.path("coordinates");
                if (co.has("lat") && co.has("lon")) summary.put("coords", Map.of("lat", co.get("lat").asDouble(), "lon", co.get("lon").asDouble()));
                var res = new LinkedHashMap<String, Object>();
                res.put("summary", summary);
                JsonNode orig = j.path("originalimage");
                String img = orig.path("width").asInt(0) > 0 && orig.path("width").asInt() <= 1280 ? orig.path("source").asString(null)
                        : j.path("thumbnail").path("source").asString("").replaceFirst("/\\d+px-", "/1280px-");
                if (img != null && !img.isBlank()) res.put("photo", Map.of("url", img, "credit", "Photo: Wikipedia / Wikimedia Commons", "link", page));
                return res;
            } catch (Exception e) {
                log.debug("wiki {}: {}", t, e.getMessage());
            }
        }
        return null;
    }

    private Map<String, Object> unsplash(String city, String country) {
        if (cfg.unsplashAccessKey() == null || cfg.unsplashAccessKey().isBlank()) return null;
        try {
            JsonNode j = http.get().uri("https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&content_filter=high&query={q}", city + " " + country)
                    .header("Authorization", "Client-ID " + cfg.unsplashAccessKey()).header("Accept-Version", "v1").retrieve().body(JsonNode.class);
            JsonNode p = j.path("results").path(0);
            if (p.isMissingNode()) return null;
            String utm = "?utm_source=gatemate&utm_medium=referral";
            // Unsplash API guidelines: hotlink the image, credit the photographer and ping the download endpoint.
            String dl = p.path("links").path("download_location").asString("");
            if (!dl.isBlank()) CompletableFuture.runAsync(() -> {
                try {
                    http.get().uri(dl).header("Authorization", "Client-ID " + cfg.unsplashAccessKey()).retrieve().toBodilessEntity();
                } catch (Exception ignored) {
                    // best effort
                }
            });
            return Map.of("url", p.path("urls").path("regular").asString(), "credit", "Photo: " + p.path("user").path("name").asString("") + " on Unsplash",
                    "link", p.path("user").path("links").path("html").asString("https://unsplash.com") + utm);
        } catch (Exception e) {
            log.debug("unsplash {}: {}", city, e.getMessage());
            return null;
        }
    }

    private Map<String, Object> weather(AirportCatalog.Airport a) {
        try {
            JsonNode j = http.get().uri("https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m"
                    + "&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone={tz}", a.lat(), a.lon(), a.tz()).retrieve().body(JsonNode.class);
            var days = new ArrayList<Map<String, Object>>();
            JsonNode d = j.path("daily");
            for (int i = 0; i < d.path("time").size(); i++) {
                days.add(Map.of("date", d.path("time").get(i).asString(), "code", d.path("weather_code").get(i).asInt(),
                        "max", Math.round(d.path("temperature_2m_max").get(i).asDouble()), "min", Math.round(d.path("temperature_2m_min").get(i).asDouble())));
            }
            JsonNode c = j.path("current");
            return Map.of("temp", Math.round(c.path("temperature_2m").asDouble()), "code", c.path("weather_code").asInt(), "wind",
                    Math.round(c.path("wind_speed_10m").asDouble()), "days", days);
        } catch (Exception e) {
            log.debug("weather {}: {}", a.iata(), e.getMessage());
            return null;
        }
    }

    private Map<String, Object> fx(String base, String currency) {
        if (currency == null || base == null || !base.matches("[A-Z]{3}") || currency.equals(base)) return null;
        try {
            JsonNode j = http.get().uri("https://api.frankfurter.app/latest?from={b}&to={c}", base, currency).retrieve().body(JsonNode.class);
            JsonNode rate = j.path("rates").path(currency);
            return rate.isMissingNode() ? null : Map.of("base", base, "currency", currency, "rate", rate.asDouble(), "date", j.path("date").asString(""));
        } catch (Exception e) {
            return null;
        }
    }
}
