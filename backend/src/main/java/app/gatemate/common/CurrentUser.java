package app.gatemate.common;

import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public final class CurrentUser {
    private CurrentUser() {}

    public static UUID id() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt) return UUID.fromString(jwt.getToken().getSubject());
        throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "unauthorized", "Please sign in.");
    }
}
