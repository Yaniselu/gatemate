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
    private final AdsbService adsb;

    public TripController(TripService trips, Repos.Flights flights, AdsbService adsb) {
        this.trips = trips;
        this.flights = flights;
        this.adsb = adsb;
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

    /** Live position (ADS-B) for a flight on one of your trips; 204 when no receiver hears it. */
    @GetMapping("/flights/{id}/live")
    public ResponseEntity<tools.jackson.databind.JsonNode> live(@PathVariable UUID id) {
        var f = flights.findById(id).orElseThrow(() -> app.gatemate.common.ApiException.notFound("Flight"));
        trips.requireMember(f.tripId, CurrentUser.id());
        return adsb.find(f.flightNumber).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PatchMapping("/trips/{tripId}/checklist/{itemId}")
    public ResponseEntity<Void> checklist(@PathVariable UUID tripId, @PathVariable UUID itemId, @RequestBody TripDtos.ChecklistPatch p) {
        trips.toggleChecklist(CurrentUser.id(), tripId, itemId, p.done());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/trips/{tripId}/checklist")
    public TripDtos.ChecklistDto addChecklist(@PathVariable UUID tripId, @Valid @RequestBody TripDtos.NewChecklistItem in) {
        return trips.addChecklistItem(CurrentUser.id(), tripId, in);
    }

    @PostMapping("/trips/{tripId}/expenses")
    public TripDtos.ExpenseDto expense(@PathVariable UUID tripId, @Valid @RequestBody TripDtos.NewExpense in) {
        return trips.addExpense(CurrentUser.id(), tripId, in);
    }
}
