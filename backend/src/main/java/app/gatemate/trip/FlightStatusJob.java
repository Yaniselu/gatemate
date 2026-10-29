package app.gatemate.trip;

import app.gatemate.alert.AlertService;
import app.gatemate.common.Messages;
import app.gatemate.config.GatemateProperties;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/**
 * Refreshes gate, terminal, delay and cancellation for flights departing in the next 24 h from a licensed flight-data
 * provider (AeroDataBox). Without a key nothing is invented: flights keep the airline-provided data.
 */
@Component
public class FlightStatusJob {
    private static final Logger log = LoggerFactory.getLogger(FlightStatusJob.class);
    private static final DateTimeFormatter LOCAL = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mmX", Locale.ROOT);
    private final Repos.Flights flights;
    private final AlertService alerts;
    private final String key;
    private final RestClient http = app.gatemate.common.Http.builder().baseUrl("https://aerodatabox.p.rapidapi.com").build();

    public FlightStatusJob(Repos.Flights flights, AlertService alerts, GatemateProperties props) {
        this.flights = flights;
        this.alerts = alerts;
        this.key = props.integrations().aeroDataBoxKey();
    }

    @Scheduled(fixedDelayString = "${gatemate.integrations.status-interval:PT10M}", initialDelay = 60_000)
    @Transactional
    public void refresh() {
        if (key == null || key.isBlank()) return;
        var now = Instant.now();
        for (var f : flights.findByDepartureAtBetween(now.minus(Duration.ofHours(2)), now.plus(Duration.ofHours(24)))) {
            try {
                update(f);
            } catch (Exception e) {
                log.debug("status {}: {}", f.flightNumber, e.getMessage());
            }
        }
    }

    void update(FlightEntity f) {
        String number = f.flightNumber.replace(" ", "");
        LocalDate day = f.departureAt.atOffset(ZoneOffset.UTC).toLocalDate();
        JsonNode list = http.get().uri("/flights/number/{n}/{d}?withAircraftImage=false&withLocation=false", number, day)
                .header("X-RapidAPI-Key", key).header("X-RapidAPI-Host", "aerodatabox.p.rapidapi.com").retrieve().body(JsonNode.class);
        if (list == null || !list.isArray()) return;
        for (JsonNode s : list) {
            if (!f.fromIata.equals(s.path("departure").path("airport").path("iata").asString(""))) continue;
            JsonNode dep = s.path("departure");
            String gate = dep.path("gate").asString(null);
            String terminal = dep.path("terminal").asString(null);
            String status = s.path("status").asString("");
            Instant revised = parse(dep.path("revisedTime").path("utc").asString(null));

            if (gate != null && !gate.equals(f.gate)) {
                boolean changed = f.gate != null;
                f.gate = gate;
                alerts.notifyTrip(f.tripId, f.id, "gate", l -> Messages.get(l, changed ? "gate.changed" : "gate.assigned", "gate", gate),
                        l -> Messages.get(l, terminal != null ? "gate.bodyTerminal" : "gate.body", "flight", f.flightNumber, "to", f.toIata, "gate", gate, "terminal", terminal));
            }
            if (terminal != null) f.terminal = terminal;
            if ("Canceled".equalsIgnoreCase(status) || "CanceledUncertain".equalsIgnoreCase(status)) {
                if (!"cancelled".equals(f.status)) {
                    f.status = "cancelled";
                    alerts.notifyTrip(f.tripId, f.id, "delay", l -> Messages.get(l, "cancelled.title", "flight", f.flightNumber), l -> Messages.get(l, "cancelled.body"));
                }
            } else if (revised != null && Duration.between(f.departureAt, revised).toMinutes() >= 15) {
                long late = Duration.between(f.departureAt, revised).toMinutes();
                if (!"delayed".equals(f.status)) {
                    String time = revised.atOffset(ZoneOffset.UTC).toLocalTime().toString();
                    alerts.notifyTrip(f.tripId, f.id, "delay", l -> Messages.get(l, "delayed.title", "flight", f.flightNumber, "min", late), l -> Messages.get(l, "delayed.body", "time", time));
                }
                f.status = "delayed";
            } else if ("Boarding".equalsIgnoreCase(status) && !Objects.equals(f.status, "boarding")) {
                f.status = "boarding";
                String atGate = f.gate;
                alerts.notifyTrip(f.tripId, f.id, "boarding", l -> Messages.get(l, "boarding.title", "flight", f.flightNumber),
                        l -> atGate != null ? Messages.get(l, "boarding.bodyGate", "gate", atGate) : Messages.get(l, "boarding.body"));
            } else if ("Departed".equalsIgnoreCase(status)) {
                f.status = "departed";
            }
            flights.save(f);
            return;
        }
    }

    private static Instant parse(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return java.time.OffsetDateTime.parse(s.replace(' ', 'T').replace("Z", "+00:00")).toInstant();
        } catch (Exception e) {
            try {
                return java.time.OffsetDateTime.parse(s, LOCAL).toInstant();
            } catch (Exception ignored) {
                return null;
            }
        }
    }
}
