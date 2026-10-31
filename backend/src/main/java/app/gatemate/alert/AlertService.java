package app.gatemate.alert;

import app.gatemate.push.PushService;
import app.gatemate.trip.Repos;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class AlertService {
    private final AlertEntity.Repo alerts;
    private final Repos.Members members;
    private final PushService push;
    private final UserRepository users;

    public AlertService(AlertEntity.Repo alerts, Repos.Members members, PushService push, UserRepository users) {
        this.alerts = alerts;
        this.members = members;
        this.push = push;
        this.users = users;
    }

    public void notifyTrip(UUID tripId, UUID flightId, String kind, Function<String, String> titleIn, Function<String, String> bodyIn) {
        var list = members.findByTripId(tripId);
        Map<UUID, String> langs = users.findAllById(list.stream().map(m -> m.userId).toList()).stream()
                .collect(Collectors.toMap(u -> u.id, (UserEntity u) -> u.lang == null ? "en" : u.lang));
        for (var m : list) {
            String lang = langs.getOrDefault(m.userId, "en");
            String title = titleIn.apply(lang), body = bodyIn.apply(lang);
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
