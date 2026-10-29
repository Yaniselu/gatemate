package app.gatemate.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-IP token buckets: a general API limit plus tighter limits on sensitive endpoints
 * (login, registration, password reset, booking lookups). Per-account limits live in the services.
 * Behind a proxy, configure {@code server.forward-headers-strategy=native} so the real client IP is used.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private final Bucket global = Bucket.builder().addLimit(Bandwidth.builder().capacity(600).refillGreedy(600, Duration.ofMinutes(1)).build()).build();
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder().expireAfterAccess(Duration.ofMinutes(30)).maximumSize(200_000).build();

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String ip = req.getRemoteAddr();
        String path = req.getRequestURI();
        String group;
        Bandwidth limit;
        // Server-wide ceilings: even with many (or spoofed) IPs, sign-in endpoints can't be hammered.
        if (path.startsWith("/api/v1/auth/") && !global.tryConsume(1)) {
            tooMany(res, 30);
            return;
        }
        if (path.equals("/api/v1/auth/register")) {
            group = "register";
            limit = Bandwidth.builder().capacity(5).refillGreedy(5, Duration.ofHours(1)).build();
        } else if (path.startsWith("/api/v1/auth/")) {
            group = "auth";
            limit = Bandwidth.builder().capacity(20).refillGreedy(20, Duration.ofMinutes(10)).build();
        } else if (path.startsWith("/api/v1/bookings/")) {
            group = "booking";
            limit = Bandwidth.builder().capacity(10).refillGreedy(10, Duration.ofMinutes(10)).build();
        } else {
            group = "api";
            limit = Bandwidth.builder().capacity(300).refillGreedy(300, Duration.ofMinutes(1)).build();
        }
        Bucket b = buckets.get(group + "|" + ip, k -> Bucket.builder().addLimit(limit).build());
        var probe = b.tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            tooMany(res, Math.max(1, probe.getNanosToWaitForRefill() / 1_000_000_000L));
            return;
        }
        chain.doFilter(req, res);
    }

    private static void tooMany(HttpServletResponse res, long wait) throws IOException {
        res.setStatus(429);
        res.setHeader("Retry-After", String.valueOf(wait));
        res.setContentType("application/json");
        res.getWriter().write("{\"code\":\"rate_limited\",\"message\":\"Too many requests. Please wait a moment.\"}");
    }
}
