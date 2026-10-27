package app.gatemate.user;

import app.gatemate.common.CurrentUser;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {
    private final MeService me;

    public MeController(MeService me) {
        this.me = me;
    }

    @GetMapping
    public UserDto get() {
        return UserDto.of(me.get(CurrentUser.id()));
    }

    @PatchMapping
    public UserDto update(@RequestBody MeService.Patch patch) {
        return me.update(CurrentUser.id(), patch);
    }

    @DeleteMapping
    public ResponseEntity<Void> delete() {
        me.delete(CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> export() {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"gatemate-data.json\"")
                .contentType(MediaType.APPLICATION_JSON).body(me.export(CurrentUser.id()));
    }

    @GetMapping("/stats")
    public MeService.Stats stats() {
        return me.stats(CurrentUser.id());
    }

    @GetMapping("/import-email")
    public Map<String, String> importEmail() {
        return Map.of("address", me.importEmail(CurrentUser.id()));
    }
}
