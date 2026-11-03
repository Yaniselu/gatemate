package app.gatemate.booking;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.common.ApiException;
import app.gatemate.trip.FlightEntity;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripDtos;
import app.gatemate.trip.TripEntity;
import app.gatemate.trip.TripService;
import app.gatemate.user.UserEntity;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class EmailImportService {
    public record Preview(List<TripDtos.FlightDto> flights, String bookingRef, boolean nameFound) {}

    private final EmailBookingParser parser;
    private final AirportCatalog airports;
    private final Repos.Flights flights;
    private final TripService tripService;
    private final JsonMapper json;

    public EmailImportService(EmailBookingParser parser, AirportCatalog airports, Repos.Flights flights, TripService tripService, JsonMapper json) {
        this.parser = parser;
        this.airports = airports;
        this.flights = flights;
        this.tripService = tripService;
        this.json = json;
    }

    public Preview preview(UserEntity u, String html, String text) {
        var r = read(html, text);
        var dtos = r.flights().stream().map(p -> tripService.flightDto(entity(p, u, r.bookingRef(), List.of()))).toList();
        return new Preview(dtos, r.bookingRef(), EmailBookingParser.mentionsName(r.text(), u.legalFirstName, u.legalLastName));
    }

    @Transactional
    public TripDtos.TripDto importInto(UserEntity u, String html, String text, String channelCheck) {
        var r = read(html, text);
        boolean nameOk = EmailBookingParser.mentionsName(r.text(), u.legalFirstName, u.legalLastName);
        var checks = new ArrayList<Map<String, Object>>();
        checks.add(check("Flights read from the airline’s confirmation e-mail", true));
        if (channelCheck != null) checks.add(check(channelCheck, true));
        checks.add(check(nameOk ? "Your legal name appears on the booking" : "Your legal name wasn’t found in the e-mail", nameOk));
        checks.add(check("Not added by another Gatemate account", true));
        String status = channelCheck != null && nameOk ? "verified" : nameOk ? "pending" : "unverified";

        TripEntity trip = null;
        for (var p : r.flights()) {
            var f = entity(p, u, r.bookingRef(), checks);
            f.verificationJson = json.writeValueAsString(Map.of("status", status, "method", "email", "checkedAt", Instant.now().toString(), "checks", checks));
            f.claimKey = String.join("|", r.bookingRef() == null ? "EMAIL" : r.bookingRef(), p.carrier() + p.number(),
                    p.departure().atOffset(ZoneOffset.UTC).toLocalDate().toString(), NameMatcher.normalize(u.legalLastName == null ? u.displayName : u.legalLastName))
                    .toUpperCase(Locale.ROOT);
            var existing = flights.findByClaimKey(f.claimKey);
            if (existing.isPresent()) {
                if (existing.get().claimedBy.equals(u.id)) continue;
                throw new ApiException(HttpStatus.CONFLICT, "already_claimed", "A flight in this e-mail is already linked to another account.");
            }
            if (trip == null) {
                trip = tripService.createWithFlight(u.id, f);
            } else {
                tripService.joinTrip(trip, f, u.id);
            }
        }
        if (trip == null) throw new ApiException(HttpStatus.CONFLICT, "already_added", "You already added the flights in this e-mail.");
        return tripService.dto(trip, u.id);
    }

    private EmailBookingParser.Result read(String html, String text) {
        var r = parser.parse(html, text, LocalDate.now());
        if (r.flights().isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "no_flights",
                    "We couldn’t find a flight in this e-mail. Make sure it includes the flight number, the airports and the date.");
        }
        if (r.flights().size() > 12) throw ApiException.badRequest("too_many", "That’s more flights than one booking usually has.");
        return r;
    }

    private FlightEntity entity(EmailBookingParser.Parsed p, UserEntity u, String ref, List<Map<String, Object>> checks) {
        var from = airports.get(p.from()).orElseThrow();
        var to = airports.get(p.to()).orElseThrow();
        var f = new FlightEntity();
        f.id = UUID.randomUUID();
        f.airlineCode = p.carrier();
        f.airlineName = p.carrierName();
        f.flightNumber = p.carrier() + " " + p.number();
        f.fromIata = from.iata();
        f.toIata = to.iata();
        f.departureAt = p.departure();
        f.arrivalAt = p.arrival() != null ? p.arrival()
                : p.departure().plus(Duration.ofMinutes(Math.round(30 + AirportCatalog.distanceKm(from, to) / 800 * 60)));
        f.boardingAt = p.departure().minus(Duration.ofMinutes(40));
        f.seat = p.seat();
        f.bookingRef = p.bookingRef() != null ? p.bookingRef() : ref;
        f.passengerName = u.legalFirstName != null && u.legalLastName != null ? u.legalFirstName + " " + u.legalLastName : u.displayName;
        f.verificationJson = json.writeValueAsString(Map.of("status", "pending", "method", "email", "checkedAt", Instant.now().toString(), "checks", checks));
        return f;
    }

    private static Map<String, Object> check(String label, boolean ok) {
        var m = new LinkedHashMap<String, Object>();
        m.put("label", label);
        m.put("ok", ok);
        return m;
    }
}
