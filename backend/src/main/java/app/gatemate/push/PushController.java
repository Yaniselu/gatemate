package app.gatemate.push;

import app.gatemate.common.ApiException;
import app.gatemate.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/push-tokens")
public class PushController {
    private final PushTokenEntity.Repo tokens;

    public PushController(PushTokenEntity.Repo tokens) {
        this.tokens = tokens;
    }

    public record Register(@NotBlank @Size(max = 512) String token, @NotBlank @Pattern(regexp = "ios|android") String platform) {}

    @PostMapping
    public ResponseEntity<Void> register(@Valid @RequestBody Register r) {
        var t = tokens.findById(r.token()).orElseGet(PushTokenEntity::new);
        t.token = r.token();
        t.userId = CurrentUser.id();
        t.platform = r.platform();
        t.updatedAt = Instant.now();
        tokens.save(t);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{token}")
    public ResponseEntity<Void> remove(@PathVariable String token) {
        var t = tokens.findById(token).orElseThrow(() -> ApiException.notFound("Token"));
        if (!t.userId.equals(CurrentUser.id())) throw ApiException.notFound("Token");
        tokens.delete(t);
        return ResponseEntity.noContent().build();
    }
}
