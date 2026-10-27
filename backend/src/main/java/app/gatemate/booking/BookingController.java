package app.gatemate.booking;

import app.gatemate.common.ApiException;
import app.gatemate.common.CurrentUser;
import app.gatemate.trip.TripDtos;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class BookingController {
    private final ClaimService claims;

    public BookingController(ClaimService claims) {
        this.claims = claims;
    }

    public record LookupRequest(@NotBlank @Pattern(regexp = "[A-Z0-9]{2,3}") String airline, @NotBlank @Pattern(regexp = "[A-Z0-9]{6}") String bookingRef,
            @NotBlank @Size(max = 40) String lastName) {}

    public record ClaimRequest(@NotBlank @Pattern(regexp = "pass|booking") String method, @Size(max = 2000) String barcode, String airline, String bookingRef,
            @Size(max = 40) String lastName, List<String> flightIds) {}

    @PostMapping("/bookings/lookup")
    public ClaimService.LookupResult lookup(@Valid @RequestBody LookupRequest r) {
        return claims.lookup(CurrentUser.id(), r.airline(), r.bookingRef(), r.lastName());
    }

    @PostMapping("/flights/claim")
    public TripDtos.TripDto claim(@Valid @RequestBody ClaimRequest r) {
        if ("pass".equals(r.method())) {
            if (r.barcode() == null) throw ApiException.badRequest("barcode_required", "Missing boarding pass.");
            return claims.claimPass(CurrentUser.id(), r.barcode());
        }
        if (r.airline() == null || r.bookingRef() == null || r.lastName() == null) throw ApiException.badRequest("booking_required", "Missing booking details.");
        return claims.claimBooking(CurrentUser.id(), r.airline(), r.bookingRef(), r.lastName());
    }
}
