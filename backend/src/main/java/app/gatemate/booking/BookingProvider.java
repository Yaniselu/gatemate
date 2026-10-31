package app.gatemate.booking;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface BookingProvider {
    record Segment(String carrier, String carrierName, String flightNumber, String from, String to, Instant departure, Instant arrival,
            String seat, String fareName, String baggageJson) {}

    record Booking(String passengerFirstName, String passengerLastName, List<Segment> segments) {}

    boolean supports(String airline);

    Optional<Booking> find(String airline, String bookingRef, String lastName);
}
