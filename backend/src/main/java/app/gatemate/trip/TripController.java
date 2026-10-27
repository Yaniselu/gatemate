package app.gatemate.trip;

import app.gatemate.common.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class TripController {
    private final TripService trips;
    private final Repos.Flights flights;

    public TripController(TripService trips, Repos.Flights flights) {
        this.trips = trips;
        this.flights = flights;
    }

    @GetMapping("/trips")
    public List<TripDtos.TripDto> list() {
        return trips.list(CurrentUser.id());
    }

    /** Manually entered flights are stored as unverified. */
    @PostMapping("/flights")
    public TripDtos.TripDto add(@Valid @RequestBody TripDtos.NewFlight in) {
        return trips.addManualFlight(CurrentUser.id(), in);
    }

    @GetMapping("/flights/{id}/status")
    public TripDtos.FlightDto status(@PathVariable UUID id) {
        var f = flights.findById(id).orElseThrow(() -> app.gatemate.common.ApiException.notFound("Flight"));
        trips.requireMember(f.tripId, CurrentUser.id());
        return trips.flightDto(f);
    }

    @PatchMapping("/trips/{tripId}/checklist/{itemId}")
    public ResponseEntity<Void> checklist(@PathVariable UUID tripId, @PathVariable UUID itemId, @RequestBody TripDtos.ChecklistPatch p) {
        trips.toggleChecklist(CurrentUser.id(), tripId, itemId, p.done());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/trips/{tripId}/expenses")
    public TripDtos.ExpenseDto expense(@PathVariable UUID tripId, @Valid @RequestBody TripDtos.NewExpense in) {
        return trips.addExpense(CurrentUser.id(), tripId, in);
    }
}
