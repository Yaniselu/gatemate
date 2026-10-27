package app.gatemate.chat;

import app.gatemate.common.ApiException;
import app.gatemate.common.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ChatController {
    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    @GetMapping("/chats")
    public List<ChatDtos.ThreadDto> list() {
        return chat.list(CurrentUser.id());
    }

    @PostMapping("/chats")
    public ChatDtos.ThreadDto create(@Valid @RequestBody ChatDtos.CreateThread in) {
        return chat.create(CurrentUser.id(), in);
    }

    @PostMapping("/chats/lounges")
    public ChatDtos.ThreadDto lounge(@RequestBody Map<String, String> in) {
        String fn = in.getOrDefault("flightNumber", "");
        String date = in.getOrDefault("date", "");
        if (!fn.matches("[A-Z0-9]{2,3} ?\\d{1,4}[A-Z]?") || !date.matches("\\d{4}-\\d{2}-\\d{2}")) throw ApiException.badRequest("bad_flight", "Invalid flight.");
        return chat.joinLounge(CurrentUser.id(), fn, date);
    }

    @GetMapping("/chats/{id}/messages")
    public List<ChatDtos.MessageDto> messages(@PathVariable UUID id) {
        return chat.messages(CurrentUser.id(), id);
    }

    @PostMapping("/chats/{id}/messages")
    public ChatDtos.MessageDto send(@PathVariable UUID id, @Valid @RequestBody ChatDtos.SendRequest in) {
        return chat.send(CurrentUser.id(), id, in);
    }

    @DeleteMapping("/chats/{id}/membership")
    public ResponseEntity<Void> leave(@PathVariable UUID id) {
        chat.leave(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/chats/{id}/membership")
    public ResponseEntity<Void> mute(@PathVariable UUID id, @RequestBody Map<String, Boolean> in) {
        chat.setMuted(CurrentUser.id(), id, Boolean.TRUE.equals(in.get("muted")));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/moderation/reports")
    public ResponseEntity<Void> report(@Valid @RequestBody ChatDtos.ReportRequest in) {
        chat.report(CurrentUser.id(), parse(in.messageId()), in.reason());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/moderation/blocks")
    public ResponseEntity<Void> block(@Valid @RequestBody ChatDtos.BlockRequest in) {
        chat.block(CurrentUser.id(), parse(in.userId()));
        return ResponseEntity.noContent().build();
    }

    private static UUID parse(String s) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("bad_id", "Invalid id.");
        }
    }
}
