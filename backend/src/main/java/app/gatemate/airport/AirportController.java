package app.gatemate.airport;

import app.gatemate.common.ApiException;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/airports")
public class AirportController {
    private final AirportCatalog catalog;
    private final AirportMapService maps;

    public AirportController(AirportCatalog catalog, AirportMapService maps) {
        this.catalog = catalog;
        this.maps = maps;
    }

    @GetMapping
    public List<AirportCatalog.Airport> search(@RequestParam(defaultValue = "") String q) {
        return catalog.search(q.length() > 60 ? q.substring(0, 60) : q, 40);
    }

    @GetMapping("/{iata}")
    public AirportCatalog.Airport get(@PathVariable String iata) {
        return catalog.get(iata).orElseThrow(() -> ApiException.notFound("Airport"));
    }

    @GetMapping("/{iata}/map")
    public ResponseEntity<List<AirportMapService.MapFeature>> map(@PathVariable String iata) {
        var f = maps.features(catalog.get(iata).orElseThrow(() -> ApiException.notFound("Airport")));
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(12)).cachePrivate()).body(f);
    }
}
