package app.gatemate.alert;

import app.gatemate.push.PushService;
import app.gatemate.trip.Repos;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Server-side alerts (gate changes, delays) for every traveller on the flight's trip, with a push notification. */
@Service
public class AlertService {
    private final AlertEntity.Repo alerts;
    private final Repos.Members members;
    private final PushService push;

    public AlertService(AlertEntity.Repo alerts, Repos.Members members, PushService push) {
        this.alerts = alerts;
        this.members = members;
        this.push = push;
    }

    public void notifyTrip(UUID tripId, UUID flightId, String kind, String title, String body) {
        for (var m : members.findByTripId(tripId)) {
            var a = new AlertEntity();
            a.userId = m.userId;
            a.flightId = flightId;
            a.kind = kind;
            a.title = title;
            a.body = body;
            alerts.save(a);
            push.send(m.userId, title, body);
        }
    }
}
