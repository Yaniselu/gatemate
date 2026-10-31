package app.gatemate.billing;

import app.gatemate.common.ApiException;
import app.gatemate.common.Http;
import app.gatemate.config.GatemateProperties;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

@Service
public class BillingService {
    private static final Logger log = LoggerFactory.getLogger(BillingService.class);
    private static final Set<String> GRANTS = Set.of("INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE",
            "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT", "CANCELLATION", "BILLING_ISSUE");

    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final GatemateProperties.Billing cfg;
    private final RestClient http = Http.builder().baseUrl("https://api.revenuecat.com").build();

    public BillingService(UserRepository users, JdbcTemplate jdbc, GatemateProperties props) {
        this.users = users;
        this.jdbc = jdbc;
        this.cfg = props.billing();
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @org.springframework.scheduling.annotation.Scheduled(initialDelay = 600_000, fixedDelay = 600_000)
    @Transactional
    public void grantListedPro() {
        if (cfg == null || cfg.proEmails() == null) return;
        for (String raw : cfg.proEmails()) {
            String email = raw == null ? "" : raw.trim().toLowerCase(java.util.Locale.ROOT);
            if (email.isEmpty()) continue;
            users.findByEmail(email).ifPresent(u -> {
                if (u.isPro() && u.proUntil.isAfter(java.time.Instant.now().plus(java.time.Duration.ofDays(3000)))) return;
                u.proUntil = java.time.Instant.parse("2099-12-31T00:00:00Z");
                u.proProduct = "granted";
                users.save(u);
                log.info("billing: Pro granted to a listed account");
            });
        }
    }

    public boolean webhookConfigured() {
        return cfg != null && cfg.webhookSecret() != null && !cfg.webhookSecret().isBlank();
    }

    public String webhookSecret() {
        return cfg.webhookSecret();
    }

    public int freeUpcomingTrips() {
        return cfg == null || cfg.freeUpcomingTrips() <= 0 ? 5 : cfg.freeUpcomingTrips();
    }

    @Transactional
    public void apply(JsonNode event) {
        String id = event.path("id").asString("");
        String type = event.path("type").asString("");
        if (id.isBlank() || type.isBlank()) throw ApiException.badRequest("bad_event", "Malformed event.");
        if (event.path("environment").asString("").equals("SANDBOX")) log.info("billing: sandbox event {} {}", type, id);
        var user = findUser(event);
        int inserted = jdbc.update("INSERT INTO billing_events (id, type, user_id) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM billing_events WHERE id = ?)",
                id, type, user == null ? null : user.id, id);
        if (inserted == 0) return;
        if (user == null) {
            log.warn("billing: event {} for an unknown user", type);
            return;
        }
        long exp = event.path("expiration_at_ms").asLong(0);
        if (GRANTS.contains(type) && exp > 0) {
            user.proUntil = Instant.ofEpochMilli(exp);
            user.proProduct = event.path("new_product_id").asString(event.path("product_id").asString(null));
        } else if (type.equals("EXPIRATION")) {
            user.proUntil = exp > 0 ? Instant.ofEpochMilli(Math.min(exp, System.currentTimeMillis())) : Instant.now();
        } else if (type.equals("TRANSFER")) {
            transfer(event);
            return;
        } else {
            return;
        }
        users.save(user);
    }

    @Transactional
    public UserEntity sync(UUID userId) {
        var user = users.findById(userId).orElseThrow(() -> ApiException.notFound("Account"));
        if (cfg == null || cfg.secretApiKey() == null || cfg.secretApiKey().isBlank()) return user;
        try {
            JsonNode res = http.get().uri("/v1/subscribers/{id}", userId.toString()).header("Authorization", "Bearer " + cfg.secretApiKey())
                    .retrieve().body(JsonNode.class);
            JsonNode ent = res.path("subscriber").path("entitlements").path(cfg.entitlement() == null ? "pro" : cfg.entitlement());
            String expires = ent.path("expires_date").asString(null);
            if (!ent.isMissingNode()) {
                user.proUntil = expires == null ? Instant.parse("2999-01-01T00:00:00Z") : Instant.parse(expires);
                user.proProduct = ent.path("product_identifier").asString(null);
                users.save(user);
            }
        } catch (Exception e) {
            log.warn("billing: RevenueCat sync failed: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "upstream_unavailable", "Couldn’t confirm your subscription right now. It will update shortly.");
        }
        return user;
    }

    private UserEntity findUser(JsonNode event) {
        List<String> ids = new ArrayList<>();
        ids.add(event.path("app_user_id").asString(""));
        ids.add(event.path("original_app_user_id").asString(""));
        for (JsonNode a : event.path("aliases")) ids.add(a.asString(""));
        for (String s : ids) {
            try {
                var u = users.findById(UUID.fromString(s));
                if (u.isPresent()) return u.get();
            } catch (IllegalArgumentException notOurId) {
            }
        }
        return null;
    }

    private void transfer(JsonNode event) {
        Instant until = null;
        String product = null;
        for (JsonNode from : event.path("transferred_from")) {
            var u = parse(from.asString(""));
            if (u != null && u.isPro()) {
                until = u.proUntil;
                product = u.proProduct;
                u.proUntil = Instant.now();
                users.save(u);
            }
        }
        if (until == null) return;
        for (JsonNode to : event.path("transferred_to")) {
            var u = parse(to.asString(""));
            if (u != null) {
                u.proUntil = until;
                u.proProduct = product;
                users.save(u);
            }
        }
    }

    private UserEntity parse(String id) {
        try {
            return users.findById(UUID.fromString(id)).orElse(null);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
