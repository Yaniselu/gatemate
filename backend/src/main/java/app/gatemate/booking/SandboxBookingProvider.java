package app.gatemate.booking;

import app.gatemate.config.GatemateProperties;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class SandboxBookingProvider implements BookingProvider {
    private final boolean enabled;

    public SandboxBookingProvider(GatemateProperties props) {
        this.enabled = props.booking().sandbox();
    }

    @Override
    public boolean supports(String airline) {
        return enabled;
    }

    @Override
    public Optional<Booking> find(String airline, String ref, String lastName) {
        if (!enabled || !ref.matches("[A-Z0-9]{6}")) return Optional.empty();
        int seed = ref.chars().sum();
        Instant dep = Instant.now().truncatedTo(ChronoUnit.HOURS).plus(Duration.ofDays(12 + seed % 20)).plus(Duration.ofHours(seed % 12));
        String[] dest = {"FCO", "LIS", "BCN", "CDG", "ATH"};
        String baggage = "{\"personalItem\":{\"label\":\"Personal item\",\"dimensionsCm\":[40,30,20],\"count\":1,\"included\":true},\"cabinBag\":null,\"checked\":[],\"notes\":[\"Must fit under the seat in front of you.\"],\"source\":\"airline\"}";
        var seg = new Segment(airline, airline, String.valueOf(100 + seed % 899), "OTP", dest[seed % dest.length], dep, dep.plus(Duration.ofMinutes(165)),
                (10 + seed % 20) + String.valueOf("ABCDEF".charAt(seed % 6)), "Basic", baggage);
        return Optional.of(new Booking(null, lastName, List.of(seg)));
    }
}
