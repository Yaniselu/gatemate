package app.gatemate.invite;

import app.gatemate.chat.ChatRepos;
import app.gatemate.chat.ChatService;
import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.common.CurrentUser;
import app.gatemate.config.GatemateProperties;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripService;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/invites")
public class InviteController {
    private static final Duration TTL = Duration.ofDays(7);
    private final InviteEntity.Repo invites;
    private final Repos.Trips trips;
    private final TripService tripService;
    private final ChatRepos.Threads threads;
    private final ChatService chat;
    private final GatemateProperties props;

    private final app.gatemate.auth.MailService mail;
    private final app.gatemate.user.UserRepository users;
    private final app.gatemate.common.RateLimiter limiter;

    public InviteController(InviteEntity.Repo invites, Repos.Trips trips, TripService tripService, ChatRepos.Threads threads, ChatService chat,
            GatemateProperties props, app.gatemate.auth.MailService mail, app.gatemate.user.UserRepository users, app.gatemate.common.RateLimiter limiter) {
        this.mail = mail;
        this.users = users;
        this.limiter = limiter;
        this.invites = invites;
        this.trips = trips;
        this.tripService = tripService;
        this.threads = threads;
        this.chat = chat;
        this.props = props;
    }

    public record Create(@NotNull UUID targetId) {}

    @PostMapping
    @Transactional
    public Map<String, String> create(@RequestBody Create in) {
        UUID me = CurrentUser.id();
        var inv = new InviteEntity();
        if (trips.existsById(in.targetId())) {
            tripService.requireMember(in.targetId(), me);
            inv.targetType = "trip";
        } else if (threads.existsById(in.targetId()) && chat.isMember(in.targetId(), me)) {
            inv.targetType = "chat";
        } else {
            throw ApiException.notFound("Trip or chat");
        }
        String token = Crypto.token(16);
        inv.tokenHash = Crypto.sha256(token);
        inv.targetId = in.targetId();
        inv.createdBy = me;
        inv.expiresAt = Instant.now().plus(TTL);
        invites.save(inv);
        String base = props.publicUrl() == null ? "https://gatemate.app" : props.publicUrl();
        return Map.of("url", base + "/invite/" + token);
    }

    public record ByEmail(@NotNull UUID targetId, @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Email @jakarta.validation.constraints.Size(max = 254) String email) {}

    @PostMapping("/email")
    @Transactional
    public Map<String, Object> byEmail(@jakarta.validation.Valid @RequestBody ByEmail in) {
        UUID me = CurrentUser.id();
        limiter.check("invite-mail:" + me, 20, Duration.ofDays(1));
        var trip = trips.findById(in.targetId()).orElseThrow(() -> ApiException.notFound("Trip"));
        tripService.requireMember(trip.id, me);
        String url = create(new Create(trip.id)).get("url");
        var inviter = users.findById(me).orElseThrow();
        String to = in.email().trim().toLowerCase(java.util.Locale.ROOT);
        String lang = users.findByEmail(to).map(u -> u.lang).orElse(inviter.lang);
        boolean sent = mail.enabled();
        if (sent) mail.sendInvite(to, inviter.displayName, trip.title, url, lang);
        return Map.of("sent", sent, "url", url);
    }

    @PostMapping("/{token}/accept")
    @Transactional
    public Map<String, String> accept(@PathVariable String token) {
        UUID me = CurrentUser.id();
        var inv = invites.findByTokenHash(Crypto.sha256(token)).orElseThrow(() -> ApiException.notFound("Invite"));
        if (inv.usedBy != null && !inv.usedBy.equals(me) || inv.expiresAt.isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.GONE, "invite_expired", "This invite has expired. Ask for a new link.");
        }
        if ("trip".equals(inv.targetType)) tripService.join(inv.targetId, me);
        else chat.join(inv.targetId, me);
        inv.usedBy = me;
        inv.usedAt = Instant.now();
        invites.save(inv);
        return Map.of("type", inv.targetType, "id", inv.targetId.toString());
    }
}
