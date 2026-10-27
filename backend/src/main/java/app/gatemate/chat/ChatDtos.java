package app.gatemate.chat;

import app.gatemate.trip.TripDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class ChatDtos {
    private ChatDtos() {}

    public record MessageDto(String id, String threadId, String authorId, String authorName, String text, String createdAt, String status, boolean flagged) {}

    public record ThreadDto(String id, String title, String subtitle, String emoji, String gradient, List<TripDtos.Traveller> members,
            MessageDto lastMessage, long unread, boolean isPublic, boolean muted) {}

    public record SendRequest(@NotBlank @Size(max = 1000) String text, @NotBlank @Size(max = 64) String clientId) {}

    public record CreateThread(@NotBlank @Size(max = 40) String title, @NotBlank @Size(max = 16) String emoji, String tripId) {}

    public record ReportRequest(@NotBlank String messageId, @NotBlank @Size(max = 60) String reason) {}

    public record BlockRequest(@NotBlank String userId) {}
}
