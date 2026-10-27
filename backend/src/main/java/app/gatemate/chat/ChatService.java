package app.gatemate.chat;

import app.gatemate.common.ApiException;
import app.gatemate.common.Text;
import app.gatemate.moderation.ModerationEntities;
import app.gatemate.trip.TripDtos;
import app.gatemate.trip.TripEntity;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChatService {
    /** Messages auto-hide after this many reports, pending moderator review (within 24 h). */
    public static final int AUTO_HIDE_REPORTS = 3;
    private static final int MAX_PER_10S = 8;

    private final ChatRepos.Threads threads;
    private final ChatRepos.Members members;
    private final ChatRepos.Messages messages;
    private final ModerationEntities.Blocks blocks;
    private final ModerationEntities.Reports reports;
    private final UserRepository users;
    private final SimpMessagingTemplate broker;

    public ChatService(ChatRepos.Threads threads, ChatRepos.Members members, ChatRepos.Messages messages, ModerationEntities.Blocks blocks,
            ModerationEntities.Reports reports, UserRepository users, SimpMessagingTemplate broker) {
        this.threads = threads;
        this.members = members;
        this.messages = messages;
        this.blocks = blocks;
        this.reports = reports;
        this.users = users;
        this.broker = broker;
    }

    @Transactional
    public UUID createForTrip(TripEntity t, UUID owner) {
        var th = new ChatEntities.Thread();
        th.title = t.title;
        th.emoji = "✈️";
        th.tripId = t.id;
        th.createdBy = owner;
        threads.save(th);
        join(th.id, owner);
        return th.id;
    }

    @Transactional
    public ChatDtos.ThreadDto create(UUID me, ChatDtos.CreateThread in) {
        var th = new ChatEntities.Thread();
        th.title = Text.clean(in.title(), 40);
        th.emoji = Text.clean(in.emoji(), 16);
        th.createdBy = me;
        if (th.title.isBlank()) throw ApiException.badRequest("title_required", "Give your group a name.");
        threads.save(th);
        join(th.id, me);
        return dto(th, me);
    }

    @Transactional
    public void join(UUID threadId, UUID userId) {
        if (members.existsByThreadIdAndUserId(threadId, userId)) return;
        var m = new ChatEntities.Member();
        m.threadId = threadId;
        m.userId = userId;
        m.lastReadAt = Instant.now();
        members.save(m);
    }

    /** Opt-in public lounge for everyone on the same flight and date. */
    @Transactional
    public ChatDtos.ThreadDto joinLounge(UUID me, String flightNumber, String date) {
        String key = (flightNumber.replace(" ", "") + "|" + date).toUpperCase(Locale.ROOT);
        var th = threads.findByLoungeKey(key).orElseGet(() -> {
            var t = new ChatEntities.Thread();
            t.title = flightNumber + " Flight Lounge";
            t.emoji = "✈️";
            t.isPublic = true;
            t.loungeKey = key;
            return threads.save(t);
        });
        join(th.id, me);
        return dto(th, me);
    }

    @Transactional(readOnly = true)
    public List<ChatDtos.ThreadDto> list(UUID me) {
        return threads.findForMember(me).stream().map(t -> dto(t, me))
                .sorted(Comparator.comparing((ChatDtos.ThreadDto d) -> d.lastMessage() == null ? "" : d.lastMessage().createdAt()).reversed()).toList();
    }

    @Transactional
    public List<ChatDtos.MessageDto> messages(UUID me, UUID threadId) {
        var m = member(threadId, me);
        Set<UUID> blocked = blockedBy(me);
        var list = new ArrayList<>(messages.latest(threadId, PageRequest.of(0, 200)));
        Collections.reverse(list);
        m.lastReadAt = Instant.now();
        members.save(m);
        return list.stream().filter(x -> !blocked.contains(x.authorId)).map(x -> dto(x, me)).toList();
    }

    @Transactional
    public ChatDtos.MessageDto send(UUID me, UUID threadId, ChatDtos.SendRequest in) {
        member(threadId, me);
        var existing = messages.findByAuthorIdAndClientId(me, in.clientId());
        if (existing.isPresent()) return dto(existing.get(), me); // idempotent retry
        var user = users.findById(me).orElseThrow();
        if (user.banned) throw ApiException.forbidden();
        if (messages.countSince(me, Instant.now().minus(Duration.ofSeconds(10))) >= MAX_PER_10S) throw ApiException.tooMany(10);
        String clean = Text.clean(in.text(), 1000);
        if (clean.isBlank()) throw ApiException.badRequest("empty", "Message is empty.");
        var masked = Text.maskProfanity(clean);
        var msg = new ChatEntities.Message();
        msg.threadId = threadId;
        msg.authorId = me;
        msg.text = masked.text();
        msg.flagged = masked.flagged();
        msg.clientId = in.clientId();
        messages.save(msg);
        broker.convertAndSend("/topic/chats/" + threadId, dto(msg, null));
        return dto(msg, me);
    }

    @Transactional
    public void report(UUID me, UUID messageId, String reason) {
        var msg = messages.findById(messageId).orElseThrow(() -> ApiException.notFound("Message"));
        member(msg.threadId, me);
        if (msg.authorId.equals(me)) throw ApiException.badRequest("own_message", "You can't report your own message.");
        if (reports.existsByReporterIdAndMessageId(me, messageId)) return;
        var r = new ModerationEntities.Report();
        r.reporterId = me;
        r.messageId = messageId;
        r.reason = Text.clean(reason, 60);
        reports.save(r);
        msg.reportCount++;
        if (msg.reportCount >= AUTO_HIDE_REPORTS) msg.hidden = true;
        messages.save(msg);
    }

    @Transactional
    public void block(UUID me, UUID other) {
        if (me.equals(other)) throw ApiException.badRequest("self_block", "You can't block yourself.");
        if (users.findById(other).isEmpty()) throw ApiException.notFound("User");
        if (blocks.existsByBlockerIdAndBlockedId(me, other)) return;
        var b = new ModerationEntities.Block();
        b.blockerId = me;
        b.blockedId = other;
        blocks.save(b);
    }

    @Transactional
    public void leave(UUID me, UUID threadId) {
        members.findByThreadIdAndUserId(threadId, me).ifPresent(members::delete);
    }

    @Transactional
    public void setMuted(UUID me, UUID threadId, boolean muted) {
        var m = member(threadId, me);
        m.muted = muted;
        members.save(m);
    }

    public boolean isMember(UUID threadId, UUID userId) {
        return members.existsByThreadIdAndUserId(threadId, userId);
    }

    private ChatEntities.Member member(UUID threadId, UUID me) {
        return members.findByThreadIdAndUserId(threadId, me).orElseThrow(() -> ApiException.notFound("Chat"));
    }

    private Set<UUID> blockedBy(UUID me) {
        Set<UUID> s = new HashSet<>();
        blocks.findByBlockerId(me).forEach(b -> s.add(b.blockedId));
        return s;
    }

    private ChatDtos.ThreadDto dto(ChatEntities.Thread t, UUID me) {
        var mem = members.findByThreadId(t.id);
        var people = mem.stream().map(m -> users.findById(m.userId).orElse(null)).filter(Objects::nonNull).map(u -> traveller(u, me)).toList();
        var last = messages.latest(t.id, PageRequest.of(0, 1)).stream().findFirst().map(x -> dto(x, me)).orElse(null);
        var mine = mem.stream().filter(m -> m.userId.equals(me)).findFirst();
        long unread = mine.map(m -> messages.countUnread(t.id, me, m.lastReadAt == null ? Instant.EPOCH : m.lastReadAt)).orElse(0L);
        String subtitle = t.isPublic ? "Public · moderated · " + mem.size() + " passengers" : mem.size() + (mem.size() == 1 ? " traveller" : " travellers");
        return new ChatDtos.ThreadDto(t.id.toString(), t.title, subtitle, t.emoji, t.isPublic ? "linear-gradient(135deg, #5EC8FF, #8B7CF6)" : "linear-gradient(135deg, #22C7D3, #0A6E80)",
                people, last, unread, t.isPublic, mine.map(m -> m.muted).orElse(false));
    }

    private ChatDtos.MessageDto dto(ChatEntities.Message m, UUID me) {
        String name = users.findById(m.authorId).map(u -> u.displayName).orElse("Traveller");
        String author = me != null && m.authorId.equals(me) ? "me" : m.authorId.toString();
        return new ChatDtos.MessageDto(m.id.toString(), m.threadId.toString(), author, name, m.text, m.createdAt.toString(), "sent", m.flagged);
    }

    private static TripDtos.Traveller traveller(UserEntity u, UUID me) {
        String initials = Arrays.stream(u.displayName.split("\\s+")).filter(p -> !p.isEmpty()).limit(2).map(p -> p.substring(0, 1).toUpperCase()).reduce("", String::concat);
        return new TripDtos.Traveller(u.id.equals(me) ? "me" : u.id.toString(), u.id.equals(me) ? "You" : u.displayName, initials, u.avatarColor);
    }
}
