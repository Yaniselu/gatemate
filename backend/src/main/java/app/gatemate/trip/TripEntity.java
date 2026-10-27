package app.gatemate.trip;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "trips")
public class TripEntity {
    @Id public UUID id = UUID.randomUUID();
    public UUID ownerId;
    public String title;
    public String destinationIata;
    public Instant startAt;
    public Instant endAt;
    public UUID chatId;
    public Instant createdAt = Instant.now();
}
