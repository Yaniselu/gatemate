package app.gatemate.booking;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.config.GatemateProperties;
import app.gatemate.trip.FlightEntity;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripService;
import app.gatemate.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Receives airline confirmation e-mails forwarded to the user's personal import address (via the mail provider's inbound webhook).
 * A booking is imported only if ALL hold:
 *  - the webhook carries our shared secret;
 *  - the message was forwarded by the account's own verified e-mail address;
 *  - the original sender's domain is a known airline domain and its DKIM signature passed;
 *  - the reservation (schema.org FlightReservation markup) is in the account's legal name.
 */
@RestController
@RequestMapping("/api/v1/inbound/email")
public class InboundEmailController {
    private static final Logger log = LoggerFactory.getLogger(InboundEmailController.class);
    private static final Pattern JSON_LD = Pattern.compile("<script[^>]*application/ld\\+json[^>]*>(.*?)</script>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern TOKEN = Pattern.compile("^trips\\+([a-z0-9]{6,32})@", Pattern.CASE_INSENSITIVE);

    private final GatemateProperties props;
    private final UserRepository users;
    private final Repos.Flights flights;
    private final TripService trips;
    private final AirportCatalog airports;
    private final JsonMapper json;

    public InboundEmailController(GatemateProperties props, UserRepository users, Repos.Flights flights, TripService trips, AirportCatalog airports, JsonMapper json) {
        this.props = props;
        this.users = users;
        this.flights = flights;
        this.trips = trips;
        this.airports = airports;
        this.json = json;
    }

    /** Normalised inbound payload (map the provider's fields to this in its webhook template). */
    public record Inbound(String to, String from, String originalFrom, String dkimDomain, boolean dkimPass, String html) {}

    @PostMapping
    @Transactional
    public ResponseEntity<Void> receive(@RequestHeader(name = "X-Gatemate-Secret", required = false) String secret, @RequestBody Inbound in) {
        String expected = props.booking().inboundSecret();
        if (expected == null || expected.isBlank() || secret == null || !Crypto.constantTimeEquals(expected, secret)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Bad signature.");
        }
        // Always 202 from here on, so senders can't probe which addresses exist.
        try {
            importMail(in);
        } catch (Exception e) {
            log.info("inbound mail rejected: {}", e.getMessage());
        }
        return ResponseEntity.accepted().build();
    }

    void importMail(Inbound in) {
        Matcher t = TOKEN.matcher(in.to() == null ? "" : in.to().trim());
        if (!t.find()) throw new IllegalArgumentException("unknown recipient");
        var user = users.findByImportToken(t.group(1).toLowerCase(Locale.ROOT)).orElseThrow(() -> new IllegalArgumentException("unknown token"));
        if (!user.emailVerified || user.email == null || !user.email.equalsIgnoreCase(address(in.from()))) throw new IllegalArgumentException("not forwarded by owner");
        String domain = in.dkimDomain() == null ? "" : in.dkimDomain().toLowerCase(Locale.ROOT);
        boolean airline = props.booking().airlineEmailDomains() != null
                && props.booking().airlineEmailDomains().stream().anyMatch(d -> domain.equals(d) || domain.endsWith("." + d));
        if (!in.dkimPass() || !airline || !address(in.originalFrom()).endsWith(domain)) throw new IllegalArgumentException("sender not verified");
        if (user.legalFirstName == null || user.legalLastName == null) throw new IllegalArgumentException("legal name missing");

        for (JsonNode r : reservations(in.html())) {
            String name = r.path("underName").path("name").asString("");
            int sp = name.trim().lastIndexOf(' ');
            if (sp < 0) continue;
            if (!NameMatcher.match(name.substring(0, sp), name.substring(sp + 1), user.legalFirstName, user.legalLastName).ok()) continue;
            JsonNode fl = r.path("reservationFor");
            String carrier = fl.path("airline").path("iataCode").asString("");
            String number = fl.path("flightNumber").asString("").replaceFirst("^" + carrier, "");
            var from = airports.get(fl.path("departureAirport").path("iataCode").asString(""));
            var to = airports.get(fl.path("arrivalAirport").path("iataCode").asString(""));
            if (carrier.isBlank() || number.isBlank() || from.isEmpty() || to.isEmpty()) continue;
            Instant dep = OffsetDateTime.parse(fl.path("departureTime").asString()).toInstant();
            Instant arr = fl.hasNonNull("arrivalTime") ? OffsetDateTime.parse(fl.path("arrivalTime").asString()).toInstant() : null;
            String ref = r.path("reservationNumber").asString("");
            String claimKey = String.join("|", ref, carrier + number, dep.toString().substring(0, 10), NameMatcher.normalize(user.legalLastName)).toUpperCase(Locale.ROOT);
            if (flights.findByClaimKey(claimKey).isPresent()) continue;

            var f = new FlightEntity();
            f.airlineCode = carrier;
            f.airlineName = fl.path("airline").path("name").asString(carrier);
            f.flightNumber = carrier + " " + number;
            f.fromIata = from.get().iata();
            f.toIata = to.get().iata();
            f.departureAt = dep;
            f.arrivalAt = arr != null ? arr : dep.plus(Duration.ofMinutes(Math.round(30 + AirportCatalog.distanceKm(from.get(), to.get()) / 800 * 60)));
            f.boardingAt = dep.minus(Duration.ofMinutes(40));
            f.seat = r.path("airplaneSeat").asString(null);
            f.bookingRef = ref;
            f.passengerName = user.legalFirstName + " " + user.legalLastName;
            f.claimKey = claimKey;
            f.verificationJson = "{\"status\":\"verified\",\"method\":\"email\",\"checkedAt\":\"" + Instant.now()
                    + "\",\"checks\":[{\"label\":\"Signed e-mail from " + domain + "\",\"ok\":true},{\"label\":\"Passenger name matches your legal name\",\"ok\":true}]}";
            trips.createWithFlight(user.id, f);
        }
    }

    private List<JsonNode> reservations(String html) {
        var out = new ArrayList<JsonNode>();
        if (html == null) return out;
        Matcher m = JSON_LD.matcher(html);
        while (m.find()) {
            try {
                JsonNode n = json.readTree(m.group(1));
                for (JsonNode x : n.isArray() ? n : List.of(n)) if ("FlightReservation".equals(x.path("@type").asString(""))) out.add(x);
            } catch (Exception ignored) {
                // not JSON-LD we understand
            }
        }
        return out;
    }

    private static String address(String header) {
        if (header == null) return "";
        int lt = header.indexOf('<'), gt = header.indexOf('>');
        return (lt >= 0 && gt > lt ? header.substring(lt + 1, gt) : header).trim().toLowerCase(Locale.ROOT);
    }
}
