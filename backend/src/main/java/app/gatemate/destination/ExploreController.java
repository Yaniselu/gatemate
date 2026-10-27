package app.gatemate.destination;

import java.time.Year;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ExploreController {
    private final ExploreService explore;

    public ExploreController(ExploreService explore) {
        this.explore = explore;
    }

    @GetMapping("/destinations/{iata}/sights")
    public List<ExploreService.Sight> sights(@PathVariable String iata) {
        return explore.sights(iata.toUpperCase(Locale.ROOT));
    }

    @GetMapping("/countries/{country}/holidays")
    public List<ExploreService.Holiday> holidays(@PathVariable String country, @RequestParam(required = false) Integer year) {
        return explore.holidays(country.toUpperCase(Locale.ROOT), year == null ? Year.now().getValue() : year);
    }

    @GetMapping("/fx")
    public ExploreService.Rate fx(@RequestParam String from, @RequestParam String to) {
        return explore.rate(from.toUpperCase(Locale.ROOT), to.toUpperCase(Locale.ROOT));
    }
}
