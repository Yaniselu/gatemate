package app.gatemate.identity;

import app.gatemate.common.ApiException;
import app.gatemate.common.RateLimiter;
import app.gatemate.common.Text;
import app.gatemate.config.GatemateProperties;
import app.gatemate.user.UserDto;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityService {
    public static final Set<String> RELATIONS = Set.of("partner", "child", "parent", "sibling", "relative", "friend");
    private static final int MAX_COMPANIONS = 12;

    public record CompanionDto(String id, String firstName, String lastName, String relation, boolean verified, String docCountry, String docExpiry) {}

    public record NewCompanion(@jakarta.validation.constraints.Size(max = 40) String firstName, @jakarta.validation.constraints.Size(max = 40) String lastName,
            @jakarta.validation.constraints.Size(max = 20) String relation) {}

    public record Scan(@jakarta.validation.constraints.Size(max = 12) List<@jakarta.validation.constraints.Size(max = 120) String> lines) {}

    private final UserRepository users;
    private final CompanionEntity.Repo companions;
    private final RateLimiter limiter;
    private final byte[] pepper;

    public IdentityService(UserRepository users, CompanionEntity.Repo companions, RateLimiter limiter, GatemateProperties props) {
        this.users = users;
        this.companions = companions;
        this.limiter = limiter;
        String key = props.security() == null ? null : props.security().tokenEncryptionKey();
        this.pepper = ("gatemate-identity|" + (key == null ? "dev" : key)).getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public UserDto verifySelf(UUID me, Scan scan) {
        limiter.check("identity:" + me, 6, Duration.ofHours(1));
        var doc = read(scan);
        String hash = hash(doc);
        var u = users.findById(me).orElseThrow(() -> ApiException.notFound("Account"));
        users.findByIdentityDocHash(hash).filter(other -> !other.id.equals(me)).ifPresent(other -> {
            throw new ApiException(HttpStatus.CONFLICT, "document_in_use", "This document already verifies another Gatemate account.");
        });
        u.legalFirstName = doc.firstName().isBlank() ? null : doc.firstName();
        u.legalLastName = doc.lastName();
        u.identityVerifiedAt = Instant.now();
        u.identityDocType = doc.type();
        u.identityCountry = doc.country();
        u.identityExpiry = doc.expiry();
        u.identityDocHash = hash;
        users.save(u);
        return UserDto.of(u);
    }

    public List<CompanionDto> list(UUID me) {
        return companions.findByOwnerIdOrderByCreatedAt(me).stream().map(IdentityService::dto).toList();
    }

    @Transactional
    public CompanionDto add(UUID me, NewCompanion in) {
        if (companions.findByOwnerIdOrderByCreatedAt(me).size() >= MAX_COMPANIONS)
            throw ApiException.badRequest("too_many", "You can save up to " + MAX_COMPANIONS + " family members.");
        var c = new CompanionEntity();
        c.ownerId = me;
        c.firstName = name(in.firstName());
        c.lastName = name(in.lastName());
        c.relation = in.relation() != null && RELATIONS.contains(in.relation()) ? in.relation() : "relative";
        companions.save(c);
        return dto(c);
    }

    @Transactional
    public CompanionDto update(UUID me, UUID id, NewCompanion in) {
        var c = owned(me, id);
        if (c.verifiedAt != null && (in.firstName() != null || in.lastName() != null))
            throw new ApiException(HttpStatus.CONFLICT, "identity_required", "Scan their passport again to change a verified name.");
        if (in.firstName() != null) c.firstName = name(in.firstName());
        if (in.lastName() != null) c.lastName = name(in.lastName());
        if (in.relation() != null && RELATIONS.contains(in.relation())) c.relation = in.relation();
        companions.save(c);
        return dto(c);
    }

    @Transactional
    public CompanionDto verifyCompanion(UUID me, UUID id, Scan scan) {
        limiter.check("identity:" + me, 6, Duration.ofHours(1));
        var c = owned(me, id);
        var doc = read(scan);
        c.firstName = doc.firstName().isBlank() ? c.firstName : doc.firstName();
        c.lastName = doc.lastName();
        c.verifiedAt = Instant.now();
        c.docCountry = doc.country();
        c.docExpiry = doc.expiry();
        c.docHash = hash(doc);
        companions.save(c);
        return dto(c);
    }

    @Transactional
    public void remove(UUID me, UUID id) {
        companions.delete(owned(me, id));
    }

    public CompanionEntity owned(UUID me, UUID id) {
        return companions.findById(id).filter(c -> c.ownerId.equals(me)).orElseThrow(() -> ApiException.notFound("Family member"));
    }

    public static void guardNameChange(UserEntity u, String first, String last) {
        boolean changes = differs(u.legalFirstName, first) || differs(u.legalLastName, last);
        if (!changes) return;
        if (u.identityVerifiedAt != null || (u.legalFirstName != null && differs(u.legalFirstName, first)) || (u.legalLastName != null && differs(u.legalLastName, last)))
            throw new ApiException(HttpStatus.CONFLICT, "identity_required", "To change the name on your tickets, scan your passport or ID card.");
    }

    private static boolean differs(String current, String next) {
        if (next == null) return false;
        String a = current == null ? "" : Text.fold(current), b = Text.fold(next);
        return !b.isBlank() && !a.equals(b);
    }

    private static Mrz.Document read(Scan scan) {
        if (scan == null || scan.lines() == null || scan.lines().isEmpty() || scan.lines().size() > 12)
            throw ApiException.badRequest("mrz_unreadable", "We couldn't read the document. Try again with the whole photo page in view.");
        var doc = Mrz.parse(scan.lines().stream().map(l -> l == null ? "" : l.length() > 60 ? l.substring(0, 60) : l).toList())
                .orElseThrow(() -> ApiException.badRequest("mrz_unreadable", "We couldn't read the document. Try again with the whole photo page in view."));
        if (doc.expiry().isBefore(LocalDate.now())) throw ApiException.badRequest("document_expired", "This document has expired.");
        return doc;
    }

    private String hash(Mrz.Document d) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((d.country() + "|" + d.type() + "|" + d.number()).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String name(String s) {
        String v = s == null ? "" : s.trim().replaceAll("\\s+", " ");
        if (v.isEmpty() || v.length() > 60 || !v.matches("^[\\p{L}][\\p{L}\\p{M}' -]*$"))
            throw ApiException.badRequest("bad_legal_name", "Use the name exactly as on their passport (letters only).");
        return v;
    }

    private static CompanionDto dto(CompanionEntity c) {
        return new CompanionDto(c.id.toString(), c.firstName, c.lastName, c.relation, c.verifiedAt != null, c.docCountry,
                c.docExpiry == null ? null : c.docExpiry.toString());
    }
}
