package app.gatemate.destination;

import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/destinations")
public class DestinationController {
    private final DestinationService service;

    public DestinationController(DestinationService service) {
        this.service = service;
    }

    @GetMapping("/{iata}")
    public Map<String, Object> get(@PathVariable String iata, @RequestParam(defaultValue = "EUR") String home) {
        return service.get(iata.toUpperCase(), home.toUpperCase());
    }
}
