package app.gatemate.trip;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.alert.AlertService;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

/**
 * Turns live ADS-B positions into "departed" and "landed" for flights in the air, with an alert to everyone on the
 * trip. Works without any paid data provider; gates and delays come from FlightStatusJob when a key is configured.
 */
@Component
public class LiveStatusJob {
    private static final Logger log = LoggerFactory.getLogger(LiveStatusJob.class);
    private final Repos.Flights flights;
    private final AdsbService adsb;
    private final AlertService alerts;
    private final AirportCatalog airports;

    public LiveStatusJob(Repos.Flights flights, AdsbService adsb, AlertService alerts, AirportCatalog airports) {
        this.flights = flights;
        this.adsb = adsb;
        this.alerts = alerts;
        this.airports = airports;
    }

    @Scheduled(fixedDelayString = "${gatemate.integrations.live-interval:PT3M}", initialDelay = 90_000)
    @Transactional
    public void refresh() {
        var now = Instant.now();
        for (var f : flights.findByDepartureAtBetween(now.minus(Duration.ofHours(20)), now.plus(Duration.ofMinutes(30)))) {
            if ("landed".equals(f.status) || "cancelled".equals(f.status) || f.arrivalAt.plus(Duration.ofHours(3)).isBefore(now)) continue;
            try {
                update(f, adsb.find(f.flightNumber).orElse(null), now);
            } catch (Exception e) {
                log.debug("live {}: {}", f.flightNumber, e.getMessage());
            }
        }
    }

    void update(FlightEntity f, JsonNode ac, Instant now) {
        String city = airports.get(f.toIata).map(AirportCatalog.Airport::city).orElse(f.toIata);
        boolean wasFlying = "departed".equals(f.status);
        if (ac != null) {
            boolean ground = "ground".equals(ac.path("alt_baro").asString("")) || ac.path("alt_baro").asDouble(0) < 300;
            double knots = ac.path("gs").asDouble(0);
            if (!ground && knots > 120 && !wasFlying) {
                f.status = "departed";
                flights.save(f);
                alerts.notifyTrip(f.tripId, f.id, "info", f.flightNumber + " has taken off ✈️", "On its way to " + city + ". Follow it live in Gatemate.");
                return;
            }
            if (wasFlying && ground && knots < 60 && nearDestination(f, ac)) {
                land(f, city, "Welcome to " + city + "!");
            }
            return;
        }
        // No signal long after the scheduled arrival: it has landed (receivers often lose planes on the ground).
        if (wasFlying && now.isAfter(f.arrivalAt.plus(Duration.ofMinutes(45)))) land(f, city, "Arrived in " + city + ".");
    }

    private void land(FlightEntity f, String city, String body) {
        f.status = "landed";
        flights.save(f);
        alerts.notifyTrip(f.tripId, f.id, "baggage", f.flightNumber + " has landed in " + city, body + " Follow the signs to baggage reclaim.");
    }

    private boolean nearDestination(FlightEntity f, JsonNode ac) {
        return airports.get(f.toIata).map(a -> {
            double r = Math.PI / 180, lat = ac.path("lat").asDouble(), lon = ac.path("lon").asDouble();
            double x = (lon - a.lon()) * r * Math.cos((lat + a.lat()) / 2 * r), y = (lat - a.lat()) * r;
            return Math.sqrt(x * x + y * y) * 6371 < 15;
        }).orElse(false);
    }
}
