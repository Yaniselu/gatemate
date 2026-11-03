package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;

import app.gatemate.trip.TripDtos;
import app.gatemate.trip.TripService;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class TripGroupingTest {
    @Autowired TripService trips;
    @Autowired UserRepository users;

    private UUID user() {
        var u = new UserEntity();
        u.email = "group+" + UUID.randomUUID() + "@example.com";
        u.displayName = "Ana Popescu";
        u.provider = "password";
        u.avatarColor = "#123456";
        u.lang = "en";
        u.proUntil = java.time.Instant.now().plusSeconds(86400);
        u.importToken = UUID.randomUUID().toString().replace("-", "");
        return users.save(u).id;
    }

    private TripDtos.TripDto add(UUID me, String number, int inDays, String from, String to) {
        return trips.addManualFlight(me, new TripDtos.NewFlight("W6", "Wizz Air", number, LocalDate.now().plusDays(inDays) + "T09:00:00", from, to, null, null, null, null));
    }

    @Test
    void returnFlightWithinTwoWeeksJoinsTheSameTrip() {
        var me = user();
        var out = add(me, "3201", 10, "OTP", "BCN");
        var back = add(me, "3202", 17, "BCN", "OTP");
        assertThat(back.id()).isEqualTo(out.id());
        assertThat(back.flights()).hasSize(2);
        assertThat(back.destination().code()).isEqualTo("BCN");
    }

    @Test
    void flightsFarApartAreSeparateTrips() {
        var me = user();
        var first = add(me, "3301", 5, "OTP", "LIS");
        var later = add(me, "3302", 40, "OTP", "CDG");
        assertThat(later.id()).isNotEqualTo(first.id());
        assertThat(trips.list(me)).hasSize(2);
    }

    @Test
    void earlierOutboundBecomesTheDestination() {
        var me = user();
        var back = add(me, "3402", 20, "ATH", "OTP");
        var out = add(me, "3401", 13, "OTP", "ATH");
        assertThat(out.id()).isEqualTo(back.id());
        assertThat(out.destination().code()).isEqualTo("ATH");
        assertThat(out.title()).contains("Athens");
    }
}
