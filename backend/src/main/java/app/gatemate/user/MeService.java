package app.gatemate.user;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.auth.AppleClient;
import app.gatemate.auth.RefreshTokenRepository;
import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.common.Messages;
import app.gatemate.common.Text;
import app.gatemate.common.TokenCipher;
import app.gatemate.config.GatemateProperties;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripService;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeService {
    private static final Logger log = LoggerFactory.getLogger(MeService.class);
    /** Avatars are re-encoded on the device (EXIF stripped) and capped at ~300 KB. */
    private static final Pattern AVATAR = Pattern.compile("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$");
    private static final int AVATAR_MAX = 400_000;
    private static final Pattern LEGAL_NAME = Pattern.compile("^[\\p{L}][\\p{L} '\\-]{0,39}$");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9 ()\\-]{6,20}$");

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final Repos.Trips trips;
    private final Repos.Members members;
    private final Repos.Flights flights;
    private final TripService tripService;
    private final AirportCatalog airports;
    private final AppleClient apple;
    private final TokenCipher cipher;
    private final GatemateProperties props;

    public MeService(UserRepository users, RefreshTokenRepository refreshTokens, Repos.Trips trips, Repos.Members members, Repos.Flights flights,
            TripService tripService, AirportCatalog airports, AppleClient apple, TokenCipher cipher, GatemateProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.trips = trips;
        this.members = members;
        this.flights = flights;
        this.tripService = tripService;
        this.airports = airports;
        this.apple = apple;
        this.cipher = cipher;
        this.props = props;
    }

    public record Patch(String name, String homeAirport, String legalFirstName, String legalLastName, String phone, String seatPreference, String bio,
            String avatarUrl, String lang) {}

    public record Stats(int flights, int distanceKm, int countries, int hoursInAir, List<Object> badges) {}

    public UserEntity get(UUID me) {
        return users.findById(me).orElseThrow(() -> ApiException.notFound("Account"));
    }

    @Transactional
    public UserDto update(UUID me, Patch p) {
        var u = get(me);
        if (p.name() != null) {
            String n = Text.clean(p.name(), 40);
            if (n.isBlank()) throw ApiException.badRequest("bad_name", "Enter your name.");
            u.displayName = Text.maskProfanity(n).text();
        }
        if (p.homeAirport() != null) {
            String code = p.homeAirport().toUpperCase(Locale.ROOT);
            if (!code.isEmpty() && airports.get(code).isEmpty()) throw ApiException.badRequest("unknown_airport", "Unknown airport.");
            u.homeAirport = code.isEmpty() ? null : code;
        }
        if (p.legalFirstName() != null) u.legalFirstName = legal(p.legalFirstName());
        if (p.legalLastName() != null) u.legalLastName = legal(p.legalLastName());
        if (p.phone() != null) {
            String ph = p.phone().trim();
            if (!ph.isEmpty() && !PHONE.matcher(ph).matches()) throw ApiException.badRequest("bad_phone", "Enter a valid phone number.");
            u.phone = ph.isEmpty() ? null : ph;
        }
        if (p.seatPreference() != null) {
            if (!Set.of("window", "aisle", "any", "").contains(p.seatPreference())) throw ApiException.badRequest("bad_seat", "Unknown seat preference.");
            u.seatPreference = p.seatPreference().isEmpty() ? null : p.seatPreference();
        }
        if (p.lang() != null) {
            if (!Messages.LANGUAGES.contains(p.lang())) throw ApiException.badRequest("bad_lang", "Unsupported language.");
            u.lang = p.lang();
        }
        if (p.bio() != null) u.bio = Text.maskProfanity(Text.clean(p.bio(), 160)).text();
        if (p.avatarUrl() != null) {
            String a = p.avatarUrl();
            if (!a.isEmpty() && (a.length() > AVATAR_MAX || !AVATAR.matcher(a).matches())) {
                throw ApiException.badRequest("bad_avatar", "Use a JPEG, PNG or WebP photo under 300 KB.");
            }
            u.avatarUrl = a.isEmpty() ? null : a;
        }
        return UserDto.of(users.save(u));
    }

    private static String legal(String s) {
        String v = s.trim().replaceAll("\\s+", " ");
        if (v.isEmpty()) return null;
        if (!LEGAL_NAME.matcher(v).matches()) throw ApiException.badRequest("bad_legal_name", "Use the name exactly as on your passport (letters only).");
        return v;
    }

    /** Computed from completed flights the user actually took. */
    @Transactional(readOnly = true)
    public Stats stats(UUID me) {
        var now = Instant.now();
        int count = 0, minutes = 0;
        double km = 0;
        Set<String> countries = new HashSet<>();
        for (var t : trips.findForMember(me)) {
            for (var f : flights.findByTripIdOrderByDepartureAt(t.id)) {
                if (!f.claimedBy.equals(me) || f.arrives().isAfter(now) || "cancelled".equals(f.status)) continue;
                count++;
                minutes += (int) java.time.Duration.between(f.departureAt, f.arrivalAt).toMinutes();
                var a = airports.get(f.fromIata);
                var b = airports.get(f.toIata);
                if (a.isPresent() && b.isPresent()) {
                    km += AirportCatalog.distanceKm(a.get(), b.get());
                    countries.add(a.get().country());
                    countries.add(b.get().country());
                }
            }
        }
        return new Stats(count, (int) Math.round(km), countries.size(), Math.round(minutes / 60f), List.of());
    }

    /** Personal forwarding address for airline confirmation e-mails. Rotates on request. */
    @Transactional
    public String importEmail(UUID me) {
        var u = get(me);
        if (u.importToken == null) {
            u.importToken = Crypto.token(9).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "x");
            users.save(u);
        }
        String template = props.booking().importAddress();
        if (template != null && template.contains("{token}")) return template.replace("{token}", u.importToken);
        String domain = props.booking().importDomain();
        if (domain == null || domain.isBlank()) {
            throw new ApiException(HttpStatus.NOT_IMPLEMENTED, "import_unavailable", "Forwarding isn't switched on yet. Paste the e-mail instead.");
        }
        return "trips+" + u.importToken + "@" + domain;
    }

    /** GDPR Art. 15/20 data export. */
    @Transactional(readOnly = true)
    public Map<String, Object> export(UUID me) {
        var u = get(me);
        var out = new LinkedHashMap<String, Object>();
        out.put("exportedAt", Instant.now().toString());
        out.put("account", UserDto.of(u));
        out.put("trips", tripService.list(me));
        return out;
    }

    /**
     * In-app account deletion (App Store 5.1.1(v), Google Play account deletion policy).
     * Revokes Sign in with Apple, hands owned group trips to another member, then deletes the user — the database cascades the rest.
     */
    @Transactional
    public void delete(UUID me) {
        var u = get(me);
        if (u.appleRefreshToken != null) {
            try {
                apple.revoke(cipher.decrypt(u.appleRefreshToken));
            } catch (Exception e) {
                // Deletion must never be blocked by Apple being unreachable; the token expires on its own.
                log.warn("Apple revoke failed for a deleted account: {}", e.getMessage());
            }
        }
        for (var t : trips.findForMember(me)) {
            if (!t.ownerId.equals(me)) continue;
            var heir = members.findByTripId(t.id).stream().filter(m -> !m.userId.equals(me)).findFirst();
            if (heir.isPresent()) {
                t.ownerId = heir.get().userId;
                trips.save(t);
            }
        }
        refreshTokens.revokeAllForUser(me, Instant.now());
        users.delete(u);
    }
}
