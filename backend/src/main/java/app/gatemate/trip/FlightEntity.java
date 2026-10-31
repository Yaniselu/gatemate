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
    public String passengersJson;
    public String barcodeEnc;
    public boolean ownerFlying = true;
    public String aircraftType;
    public String aircraftReg;
    public int delayMinutes;
    public int arrivalDelayMinutes;
    public Instant createdAt = Instant.now();

    public Instant departs() {
        return departureAt.plusSeconds(delayMinutes * 60L);
    }

    public Instant arrives() {
        return arrivalAt.plusSeconds(arrivalDelayMinutes * 60L);
    }

    public Instant boards() {
        return boardingAt.plusSeconds(delayMinutes * 60L);
    }
}
