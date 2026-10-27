package app.gatemate.booking;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Looks up a booking with the airline (directly or through an NDC/GDS aggregator).
 * Implementations must only return a booking when the reference AND last name match on the airline side.
 */
public interface BookingProvider {
    record Segment(String carrier, String carrierName, String flightNumber, String from, String to, Instant departure, Instant arrival,
            String seat, String fareName, String baggageJson) {}

    record Booking(String passengerFirstName, String passengerLastName, List<Segment> segments) {}

    boolean supports(String airline);

    Optional<Booking> find(String airline, String bookingRef, String lastName);
}
