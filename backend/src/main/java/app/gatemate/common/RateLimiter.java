package app.gatemate.common;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import java.time.Duration;
import org.springframework.stereotype.Component;

@Component
public class RateLimiter {
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder().expireAfterAccess(Duration.ofHours(2)).maximumSize(500_000).build();

    public void check(String key, int capacity, Duration per) {
        Bucket b = buckets.get(key + "|" + capacity + "|" + per.toSeconds(),
                k -> Bucket.builder().addLimit(Bandwidth.builder().capacity(capacity).refillGreedy(capacity, per).build()).build());
        var probe = b.tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) throw ApiException.tooMany(Math.max(1, probe.getNanosToWaitForRefill() / 1_000_000_000L));
    }

    public void reset(String key, int capacity, Duration per) {
        buckets.invalidate(key + "|" + capacity + "|" + per.toSeconds());
    }
}
