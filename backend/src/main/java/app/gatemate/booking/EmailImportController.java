package app.gatemate.booking;

import app.gatemate.common.ApiException;
import app.gatemate.common.CurrentUser;
import app.gatemate.trip.TripDtos;
import app.gatemate.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

/** "Paste your confirmation e-mail": read flights out of the text, show them, then add them. */
@RestController
@RequestMapping("/api/v1/bookings/email")
public class EmailImportController {
    private final EmailImportService service;
    private final UserRepository users;

    public EmailImportController(EmailImportService service, UserRepository users) {
        this.service = service;
        this.users = users;
    }

    public record Pasted(@Size(max = 200_000) String text, @Size(max = 400_000) String html) {}

    @PostMapping("/preview")
    public EmailImportService.Preview preview(@Valid @RequestBody Pasted in) {
        return service.preview(user(), in.html(), require(in));
    }

    @PostMapping("/import")
    public TripDtos.TripDto importPasted(@Valid @RequestBody Pasted in) {
        return service.importInto(user(), in.html(), require(in), null);
    }

    private app.gatemate.user.UserEntity user() {
        return users.findById(CurrentUser.id()).orElseThrow();
    }

    private static String require(Pasted in) {
        String t = in.text() == null ? "" : in.text();
        if (t.isBlank() && (in.html() == null || in.html().isBlank())) throw ApiException.badRequest("empty", "Paste the text of your confirmation e-mail.");
        return t;
    }
}
