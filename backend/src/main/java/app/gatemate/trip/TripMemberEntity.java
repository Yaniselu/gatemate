package app.gatemate.trip;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "trip_members")
@IdClass(TripMemberEntity.Key.class)
public class TripMemberEntity {
    @Id public UUID tripId;
    @Id public UUID userId;
    public String role;

    public static class Key implements Serializable {
        public UUID tripId;
        public UUID userId;

        public Key() {}

        public Key(UUID tripId, UUID userId) {
            this.tripId = tripId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && java.util.Objects.equals(tripId, k.tripId) && java.util.Objects.equals(userId, k.userId);
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(tripId, userId);
        }
    }
}
