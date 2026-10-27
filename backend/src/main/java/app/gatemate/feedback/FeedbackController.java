package app.gatemate.feedback;

import app.gatemate.common.Text;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/feedback")
public class FeedbackController {
    private final FeedbackEntity.Repo repo;

    public FeedbackController(FeedbackEntity.Repo repo) {
        this.repo = repo;
    }

    public record Input(@NotBlank @Size(max = 40) String topic, @NotBlank @Size(max = 1000) String message, @Min(1) @Max(5) Integer rating,
            @Email @Size(max = 254) String contactEmail) {}

    @PostMapping
    public ResponseEntity<Void> send(@Valid @RequestBody Input in, @AuthenticationPrincipal Jwt jwt) {
        var f = new FeedbackEntity();
        f.userId = UUID.fromString(jwt.getSubject());
        f.topic = Text.clean(in.topic(), 40);
        f.message = Text.clean(in.message(), 1000);
        f.rating = in.rating();
        f.contactEmail = in.contactEmail();
        repo.save(f);
        return ResponseEntity.accepted().build();
    }
}
