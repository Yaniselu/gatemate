package app.gatemate.booking;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.common.ApiException;
import app.gatemate.trip.FlightEntity;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripDtos;
import app.gatemate.trip.TripService;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class ClaimService {
    private final UserRepository users;
    private final Repos.Flights flights;
    private final TripService trips;
    private final AirportCatalog airports;
    private final List<BookingProvider> providers;
    private final JsonMapper json;

    public ClaimService(UserRepository users, Repos.Flights flights, TripService trips, AirportCatalog airports, List<BookingProvider> providers, JsonMapper json) {
        this.users = users;
        this.flights = flights;
        this.trips = trips;
        this.airports = airports;
        this.providers = providers;
        this.json = json;
    }

    public record LookupResult(String passengerFirstName, String passengerLastName, List<TripDtos.FlightDto> flights) {}

    public LookupResult lookup(UUID me, String airline, String ref, String lastName) {
        var user = legalUser(me);
        var b = find(airline, ref, lastName);
        var m = NameMatcher.match(first(b, user), b.passengerLastName(), user.legalFirstName, user.legalLastName);
        if (!m.lastNameOk()) throw nameMismatch();
        var dtos = b.segments().stream().map(s -> trips.flightDto(fromSegment(s, ref, user))).toList();
        return new LookupResult(first(b, user), b.passengerLastName(), dtos);
    }

    @Transactional
    public TripDtos.TripDto claimBooking(UUID me, String airline, String ref, String lastName) {
        var user = legalUser(me);
        var b = find(airline, ref, lastName);
        var m = NameMatcher.match(first(b, user), b.passengerLastName(), user.legalFirstName, user.legalLastName);
        if (!m.ok()) throw nameMismatch();
        var checks = List.of(check("Booking confirmed with the airline", true), check("Passenger name matches your legal name", true),
                check("Not added by another Gatemate account", true));
        TripDtos.TripDto result = null;
        for (var s : b.segments()) {
            var f = fromSegment(s, ref, user);
            f.claimKey = key(ref, s.carrier() + s.flightNumber(), s.departure().toString().substring(0, 10), b.passengerLastName());
            assertUnclaimed(f.claimKey, me);
            f.verificationJson = verification("airline", checks);
            result = trips.dto(trips.createWithFlight(me, f), me);
        }
        if (result == null) throw ApiException.notFound("Booking");
        return result;
    }

    @Transactional
    public TripDtos.TripDto claimPass(UUID me, String barcode) {
        var user = legalUser(me);
        var p = Bcbp.parse(barcode, LocalDate.now());
        var m = NameMatcher.match(p.firstName(), p.lastName(), user.legalFirstName, user.legalLastName);
        if (!m.ok()) throw nameMismatch();
        var from = airports.get(p.from()).orElseThrow(() -> ApiException.badRequest("unknown_airport", "Unknown airport " + p.from() + "."));
        var to = airports.get(p.to()).orElseThrow(() -> ApiException.badRequest("unknown_airport", "Unknown airport " + p.to() + "."));
        String claimKey = key(p.bookingRef(), p.carrier() + p.flightNumber(), p.flightDate().toString(), p.lastName());
        assertUnclaimed(claimKey, me);

        Instant dep = p.flightDate().atTime(LocalTime.NOON).atZone(ZoneId.of(from.tz())).toInstant();
        var f = new FlightEntity();
        f.airlineCode = p.carrier();
        f.airlineName = p.carrier();
        f.flightNumber = p.carrier() + " " + p.flightNumber();
        f.fromIata = from.iata();
        f.toIata = to.iata();
        f.departureAt = dep;
        f.arrivalAt = dep.plus(Duration.ofMinutes(Math.round(30 + AirportCatalog.distanceKm(from, to) / 800 * 60)));
        f.boardingAt = dep.minus(Duration.ofMinutes(40));
        f.seat = p.seat().isBlank() ? null : p.seat();
        f.bookingRef = p.bookingRef();
        f.passengerName = titleCase(p.firstName() + " " + p.lastName());
        f.claimKey = claimKey;
        f.verificationJson = verification("boarding-pass", List.of(check("Valid IATA boarding pass barcode", true),
                check("Passenger name matches your legal name", true), check("Not added by another Gatemate account", true)));
        return trips.dto(trips.createWithFlight(me, f), me);
    }

    private BookingProvider.Booking find(String airline, String ref, String lastName) {
        String a = airline.toUpperCase(Locale.ROOT);
        var provider = providers.stream().filter(p -> p.supports(a)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_IMPLEMENTED, "provider_unavailable",
                        "Importing bookings from this airline isn't available yet. Scan or upload your boarding pass instead."));
        return provider.find(a, ref.toUpperCase(Locale.ROOT), lastName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "not_found", "We could not find a booking with this reference and last name."));
    }

    private UserEntity legalUser(UUID me) {
        var u = users.findById(me).orElseThrow();
        if (u.legalFirstName == null || u.legalLastName == null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "legal_name_missing", "Add your legal name in your profile first.");
        }
        return u;
    }

    private void assertUnclaimed(String claimKey, UUID me) {
        flights.findByClaimKey(claimKey).ifPresent(f -> {
            throw new ApiException(HttpStatus.CONFLICT, "already_claimed",
                    f.claimedBy.equals(me) ? "You already added this flight." : "This flight is already linked to another account.");
        });
    }

    private FlightEntity fromSegment(BookingProvider.Segment s, String ref, UserEntity u) {
        var f = new FlightEntity();
        f.airlineCode = s.carrier();
        f.airlineName = s.carrierName();
        f.flightNumber = s.carrier() + " " + s.flightNumber();
        f.fromIata = s.from();
        f.toIata = s.to();
        f.departureAt = s.departure();
        f.arrivalAt = s.arrival();
        f.boardingAt = s.departure().minus(Duration.ofMinutes(40));
        f.seat = s.seat();
        f.bookingRef = ref;
        f.fareName = s.fareName();
        f.baggageJson = s.baggageJson();
        f.passengerName = u.legalFirstName + " " + u.legalLastName;
        return f;
    }

    private static String first(BookingProvider.Booking b, UserEntity u) {
        return b.passengerFirstName() != null ? b.passengerFirstName() : u.legalFirstName;
    }

    private String verification(String method, List<Map<String, Object>> checks) {
        return json.writeValueAsString(Map.of("status", "verified", "method", method, "checkedAt", Instant.now().toString(), "checks", new ArrayList<>(checks)));
    }

    private static Map<String, Object> check(String label, boolean ok) {
        return Map.of("label", label, "ok", ok);
    }

    private static String key(String ref, String flight, String date, String last) {
        return String.join("|", ref, flight, date, NameMatcher.normalize(last)).toUpperCase(Locale.ROOT);
    }

    private static ApiException nameMismatch() {
        return new ApiException(HttpStatus.FORBIDDEN, "name_mismatch", "This ticket is in another passenger’s name. Ask them to add it and invite you to the trip.");
    }

    private static String titleCase(String s) {
        var sb = new StringBuilder();
        for (String w : s.toLowerCase(Locale.ROOT).trim().split("\\s+")) if (!w.isEmpty()) sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1)).append(' ');
        return sb.toString().trim();
    }
}
