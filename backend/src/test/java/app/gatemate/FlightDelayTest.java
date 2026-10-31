package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;

import app.gatemate.alert.AlertEntity;
import app.gatemate.trip.FlightStatusJob;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripDtos;
import app.gatemate.trip.TripService;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class FlightDelayTest {
    @Autowired TripService trips;
    @Autowired FlightStatusJob job;
    @Autowired Repos.Flights flights;
    @Autowired UserRepository users;
    @Autowired AlertEntity.Repo alerts;

    @Test
    void delayMovesEveryTimeAndTellsTheTraveller() {
        var u = new UserEntity();
        u.email = "delay+" + UUID.randomUUID() + "@example.com";
        u.displayName = "Ana Popescu";
        u.provider = "password";
        u.avatarColor = "#123456";
        u.lang = "ro";
        u.importToken = UUID.randomUUID().toString().replace("-", "");
        users.save(u);
        var trip = trips.addManualFlight(u.id, new TripDtos.NewFlight("W6", "Wizz Air", "3201", LocalDate.now().plusDays(1) + "T09:00:00", "CRA", "BCN", null, null, null, null));
        var f = flights.findById(UUID.fromString(trip.flights().get(0).id())).orElseThrow();
        Instant dep = f.departureAt, arr = f.arrivalAt, board = f.boardingAt;

        job.applyDelay(f, dep.plusSeconds(50 * 60), null);
        flights.save(f);

        var dto = trips.flightDto(f);
        assertThat(dto.status()).isEqualTo("delayed");
        assertThat(dto.delayMinutes()).isEqualTo(50);
        assertThat(Instant.parse(dto.departure())).isEqualTo(dep.plusSeconds(50 * 60));
        assertThat(Instant.parse(dto.arrival())).isEqualTo(arr.plusSeconds(50 * 60));
        assertThat(Instant.parse(dto.boardingTime())).isEqualTo(board.plusSeconds(50 * 60));
        assertThat(Instant.parse(dto.scheduledDeparture())).isEqualTo(dep);
        var sent = alerts.findAll().stream().filter(a -> f.id.equals(a.flightId)).toList();
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).title).contains("întârzie 50 min");
        assertThat(sent.get(0).body).startsWith("Noua plecare:").contains("Îmbarcarea de la");

        job.applyDelay(f, dep.plusSeconds(55 * 60), arr.plusSeconds(40 * 60));
        assertThat(alerts.findAll().stream().filter(a -> f.id.equals(a.flightId)).count()).isEqualTo(1);
        assertThat(f.arrives()).isEqualTo(arr.plusSeconds(40 * 60));

        job.applyDelay(f, dep.plusSeconds(90 * 60), null);
        assertThat(alerts.findAll().stream().filter(a -> f.id.equals(a.flightId)).count()).isEqualTo(2);

        job.applyDelay(f, dep, arr);
        assertThat(f.status).isEqualTo("scheduled");
        assertThat(f.departs()).isEqualTo(dep);
        assertThat(alerts.findAll().stream().filter(a -> f.id.equals(a.flightId)).count()).isEqualTo(3);
    }
}
