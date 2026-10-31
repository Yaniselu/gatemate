package app.gatemate.trip;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public final class Repos {
    private Repos() {}

    public interface Trips extends JpaRepository<TripEntity, UUID> {
        @Query("select t from TripEntity t where t.id in (select m.tripId from TripMemberEntity m where m.userId = :user) order by t.startAt")
        List<TripEntity> findForMember(UUID user);
    }

    public interface Members extends JpaRepository<TripMemberEntity, TripMemberEntity.Key> {
        List<TripMemberEntity> findByTripId(UUID tripId);
        boolean existsByTripIdAndUserId(UUID tripId, UUID userId);
    }

    public interface Flights extends JpaRepository<FlightEntity, UUID> {
        List<FlightEntity> findByTripIdOrderByDepartureAt(UUID tripId);
        Optional<FlightEntity> findByClaimKey(String key);
        List<FlightEntity> findByDepartureAtBetween(java.time.Instant from, java.time.Instant to);
        List<FlightEntity> findByPassengersJsonContaining(String fragment);
    }

    public interface Checklist extends JpaRepository<ChecklistItemEntity, UUID> {
        List<ChecklistItemEntity> findByTripIdOrderByPosition(UUID tripId);
    }

    public interface Expenses extends JpaRepository<ExpenseEntity, UUID> {
        List<ExpenseEntity> findByTripIdOrderByCreatedAt(UUID tripId);
    }
}
