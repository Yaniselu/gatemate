package app.gatemate.trip;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "flights")
public class FlightEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID tripId;
    public UUID claimedBy;
    public String airlineCode;
    public String airlineName;
    public String flightNumber;
    public String fromIata;
    public String toIata;
    public Instant departureAt;
    public Instant arrivalAt;
    public Instant boardingAt;
    public String gate;
    public String terminal;
    public String seat;
    public String cabin = "Economy";
    public String bookingRef;
    public String passengerName;
    public String status = "scheduled";
    public String fareName;
    public String baggageJson;
    public String verificationJson;
    public String claimKey;
    public Instant createdAt = Instant.now();
}
