package app.gatemate.identity;

import app.gatemate.common.CurrentUser;
import app.gatemate.user.UserDto;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me")
public class IdentityController {
    private final IdentityService identity;

    public IdentityController(IdentityService identity) {
        this.identity = identity;
    }

    @PostMapping("/identity")
    public UserDto verify(@jakarta.validation.Valid @RequestBody IdentityService.Scan scan) {
        return identity.verifySelf(CurrentUser.id(), scan);
    }

    @GetMapping("/companions")
    public List<IdentityService.CompanionDto> companions() {
        return identity.list(CurrentUser.id());
    }

    @PostMapping("/companions")
    public IdentityService.CompanionDto add(@jakarta.validation.Valid @RequestBody IdentityService.NewCompanion in) {
        return identity.add(CurrentUser.id(), in);
    }

    @PatchMapping("/companions/{id}")
    public IdentityService.CompanionDto update(@PathVariable UUID id, @jakarta.validation.Valid @RequestBody IdentityService.NewCompanion in) {
        return identity.update(CurrentUser.id(), id, in);
    }

    @PostMapping("/companions/{id}/identity")
    public IdentityService.CompanionDto verifyCompanion(@PathVariable UUID id, @jakarta.validation.Valid @RequestBody IdentityService.Scan scan) {
        return identity.verifyCompanion(CurrentUser.id(), id, scan);
    }

    @DeleteMapping("/companions/{id}")
    public ResponseEntity<Void> remove(@PathVariable UUID id) {
        identity.remove(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }
}
