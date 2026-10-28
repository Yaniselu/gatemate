package app.gatemate.billing;

import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.common.CurrentUser;
import app.gatemate.user.UserDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1")
public class BillingController {
    private final BillingService billing;

    public BillingController(BillingService billing) {
        this.billing = billing;
    }

    /** RevenueCat webhook. Authenticated with the shared secret set as the webhook's Authorization header. */
    @PostMapping("/billing/revenuecat")
    public ResponseEntity<Void> webhook(@RequestHeader(name = "Authorization", required = false) String auth, @RequestBody JsonNode body) {
        if (!billing.webhookConfigured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "billing_disabled", "Billing is not configured.");
        String expected = billing.webhookSecret();
        String given = auth == null ? "" : auth.startsWith("Bearer ") ? auth.substring(7) : auth;
        if (!Crypto.constantTimeEquals(expected, given)) throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Bad signature.");
        billing.apply(body.path("event"));
        return ResponseEntity.ok().build();
    }

    /** Called by the app right after a purchase or restore; the answer comes from RevenueCat, never from the app. */
    @PostMapping("/me/pro/sync")
    public UserDto sync() {
        return UserDto.of(billing.sync(CurrentUser.id()));
    }
}
