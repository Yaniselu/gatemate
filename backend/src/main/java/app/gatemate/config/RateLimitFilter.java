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

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private final Bucket global = Bucket.builder().addLimit(Bandwidth.builder().capacity(600).refillGreedy(600, Duration.ofMinutes(1)).build()).build();
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder().expireAfterAccess(Duration.ofMinutes(30)).maximumSize(200_000).build();
    private static final java.util.Set<String> PROVED = java.util.Set.of("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/password-reset", "/api/v1/auth/password-reset/confirm");
    private static final long MAX_BODY = 1_048_576;
    private final ProofOfWork pow;

    public RateLimitFilter(ProofOfWork pow) {
        this.pow = pow;
    }

    static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] hops = xff.split(",");
            String last = hops[hops.length - 1].trim();
            if (!last.isEmpty() && last.length() <= 45) return last;
        }
        return req.getRemoteAddr();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String ip = clientIp(req);
        String path = req.getRequestURI();
        if (req.getContentLengthLong() > MAX_BODY) {
            res.setStatus(413);
            res.setContentType("application/json");
            res.getWriter().write("{\"code\":\"too_large\",\"message\":\"Request too large.\"}");
            return;
        }
        String group;
        Bandwidth limit;
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
        if ("POST".equals(req.getMethod()) && PROVED.contains(path) && !pow.verify(req.getHeader("X-Proof"))) {
            res.setStatus(403);
            res.setContentType("application/json");
            res.getWriter().write("{\"code\":\"proof_required\",\"message\":\"Please try again.\"}");
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
