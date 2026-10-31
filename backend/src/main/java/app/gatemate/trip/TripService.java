package app.gatemate.trip;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.chat.ChatService;
import app.gatemate.common.ApiException;
import app.gatemate.common.Messages;
import app.gatemate.common.Text;
import app.gatemate.user.UserEntity;
import app.gatemate.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class TripService {
    private static final String[] GRADIENTS = {
        "linear-gradient(135deg, #22C7D3 0%, #5EC8FF 55%, #FFB36B 100%)", "linear-gradient(135deg, #FFB36B 0%, #FF6B8B 60%, #8B7CF6 100%)",
        "linear-gradient(135deg, #5EC8FF 0%, #8B7CF6 100%)", "linear-gradient(135deg, #2FD18A 0%, #22C7D3 100%)"};

    private final Repos.Trips trips;
    private final Repos.Members members;
    private final Repos.Flights flights;
    private final Repos.Checklist checklist;
    private final Repos.Expenses expenses;
    private final UserRepository users;
    private final AirportCatalog airports;
    private final ChatService chat;
    private final JsonMapper json;
    private final app.gatemate.config.GatemateProperties props;

    private final org.springframework.beans.factory.ObjectProvider<app.gatemate.airport.AirportMapService> maps;

    private final app.gatemate.identity.CompanionEntity.Repo companions;

    public TripService(Repos.Trips trips, Repos.Members members, Repos.Flights flights, Repos.Checklist checklist, Repos.Expenses expenses,
            UserRepository users, AirportCatalog airports, ChatService chat, JsonMapper json, app.gatemate.config.GatemateProperties props,
            org.springframework.beans.factory.ObjectProvider<app.gatemate.airport.AirportMapService> maps,
            app.gatemate.identity.CompanionEntity.Repo companions) {
        this.props = props;
        this.companions = companions;
        this.maps = maps;
        this.trips = trips;
        this.members = members;
        this.flights = flights;
        this.checklist = checklist;
        this.expenses = expenses;
        this.users = users;
        this.airports = airports;
        this.chat = chat;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<TripDtos.TripDto> list(UUID me) {
        return trips.findForMember(me).stream().map(t -> dto(t, me)).toList();
    }

    public void requireMember(UUID tripId, UUID me) {
        if (!members.existsByTripIdAndUserId(tripId, me)) throw ApiException.notFound("Trip");
    }

    @Transactional
    public TripEntity createWithFlight(UUID me, FlightEntity f) {
        requireTripAllowance(me);
        var to = airports.get(f.toIata).orElseThrow(() -> ApiException.badRequest("unknown_airport", "Unknown airport " + f.toIata + "."));
        String lang = users.findById(me).map(u -> u.lang).orElse("en");
        var t = new TripEntity();
        t.ownerId = me;
        t.title = Messages.get(lang, "trip.title", "city", to.city());
        t.destinationIata = to.iata();
        t.startAt = f.departureAt;
        t.endAt = f.arrivalAt;
        trips.save(t);
        var m = new TripMemberEntity();
        m.tripId = t.id;
        m.userId = me;
        m.role = "OWNER";
        members.save(m);
        f.tripId = t.id;
        f.claimedBy = me;
        flights.save(f);
        int pos = 0;
        for (var item : List.of(new String[] {"checklist.documents", "documents"}, new String[] {"checklist.checkin", "tasks"},
                new String[] {"checklist.charger", "packing"}, new String[] {"checklist.liquids", "packing"})) {
            var c = new ChecklistItemEntity();
            c.tripId = t.id;
            c.label = Messages.get(lang, item[0]);
            c.category = item[1];
            c.position = pos++;
            checklist.save(c);
        }
        t.chatId = chat.createForTrip(t, me);
        return trips.save(t);
    }

    private void requireTripAllowance(UUID me) {
        var u = users.findById(me).orElseThrow();
        if (u.isPro()) return;
        int limit = props.billing() == null || props.billing().freeUpcomingTrips() <= 0 ? 3 : props.billing().freeUpcomingTrips();
        Instant now = Instant.now();
        long upcoming = trips.findForMember(me).stream().filter(t -> t.ownerId.equals(me) && t.endAt != null && t.endAt.isAfter(now)).count();
        if (upcoming >= limit) {
            throw new ApiException(org.springframework.http.HttpStatus.PAYMENT_REQUIRED, "pro_required",
                    "Free accounts can have " + limit + " upcoming trips. Upgrade to Gatemate Pro for unlimited trips.");
        }
    }

    @Transactional
    public TripDtos.TripDto addManualFlight(UUID me, TripDtos.NewFlight in) {
        var from = airports.get(in.from()).orElseThrow(() -> ApiException.badRequest("unknown_airport", "Unknown airport " + in.from() + "."));
        var to = airports.get(in.to()).orElseThrow(() -> ApiException.badRequest("unknown_airport", "Unknown airport " + in.to() + "."));
        if (from.iata().equals(to.iata())) throw ApiException.badRequest("same_airport", "Departure and arrival airports must differ.");
        maps.ifAvailable(m -> m.prefetch(from.iata(), to.iata()));
        Instant dep;
        try {
            dep = in.date().endsWith("Z") ? Instant.parse(in.date()) : LocalDateTime.parse(in.date()).atZone(ZoneId.of(from.tz())).toInstant();
        } catch (Exception e) {
            throw ApiException.badRequest("bad_date", "Enter a valid departure date and time.");
        }
        double km = AirportCatalog.distanceKm(from, to);
        int minutes = estimateMinutes(km);
        var f = new FlightEntity();
        f.airlineCode = in.carrier();
        f.airlineName = in.airlineName() == null || in.airlineName().isBlank() ? in.carrier() : Text.clean(in.airlineName(), 40);
        f.flightNumber = in.carrier() + " " + in.flightNumber();
        f.fromIata = from.iata();
        f.toIata = to.iata();
        f.departureAt = dep;
        f.arrivalAt = dep.plus(Duration.ofMinutes(minutes));
        f.boardingAt = dep.minus(Duration.ofMinutes(40));
        f.seat = in.seat();
        f.bookingRef = in.bookingRef();
        var u = users.findById(me).orElseThrow();
        f.passengerName = Text.clean(in.passengerName() != null ? in.passengerName() : u.displayName, 60);
        f.verificationJson = "{\"status\":\"unverified\",\"method\":\"manual\",\"checkedAt\":\"" + Instant.now() + "\",\"checks\":[]}";
        if (in.passengers() != null) for (var p : in.passengers()) addPassengerTo(f, me, p);
        return dto(createWithFlight(me, f), me);
    }

    record Seat(String c, String n, String s) {}

    private List<Seat> passengers(FlightEntity f) {
        if (f.passengersJson == null || f.passengersJson.isBlank()) return new ArrayList<>();
        try {
            return new ArrayList<>(json.readValue(f.passengersJson, new tools.jackson.core.type.TypeReference<List<Seat>>() {}));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private void addPassengerTo(FlightEntity f, UUID me, TripDtos.PassengerIn in) {
        UUID cid;
        try {
            cid = UUID.fromString(in.companionId());
        } catch (Exception e) {
            throw ApiException.notFound("Family member");
        }
        var c = companions.findById(cid).filter(x -> x.ownerId.equals(me)).orElseThrow(() -> ApiException.notFound("Family member"));
        var list = passengers(f);
        list.removeIf(x -> x.c().equals(c.id.toString()));
        if (list.size() >= 12) throw ApiException.badRequest("too_many", "Up to 12 extra passengers per flight.");
        list.add(new Seat(c.id.toString(), c.fullName(), in.seat()));
        f.passengersJson = json.writeValueAsString(list);
    }

    @Transactional
    public TripDtos.FlightDto addPassenger(UUID me, UUID flightId, TripDtos.PassengerIn in) {
        var f = flights.findById(flightId).orElseThrow(() -> ApiException.notFound("Flight"));
        requireMember(f.tripId, me);
        addPassengerTo(f, me, in);
        flights.save(f);
        return flightDto(f);
    }

    @Transactional
    public TripDtos.FlightDto removePassenger(UUID me, UUID flightId, String companionId) {
        var f = flights.findById(flightId).orElseThrow(() -> ApiException.notFound("Flight"));
        requireMember(f.tripId, me);
        var list = passengers(f);
        list.removeIf(x -> x.c().equals(companionId));
        f.passengersJson = list.isEmpty() ? null : json.writeValueAsString(list);
        flights.save(f);
        return flightDto(f);
    }

    private List<TripDtos.PassengerDto> passengerDtos(FlightEntity f) {
        var list = passengers(f);
        if (list.isEmpty()) return List.of();
        var ids = list.stream().map(x -> {
            try {
                return UUID.fromString(x.c());
            } catch (Exception e) {
                return null;
            }
        }).filter(Objects::nonNull).toList();
        var known = new java.util.HashMap<String, app.gatemate.identity.CompanionEntity>();
        companions.findAllById(ids).forEach(c -> known.put(c.id.toString(), c));
        return list.stream().map(x -> {
            var c = known.get(x.c());
            return new TripDtos.PassengerDto(x.c(), c != null ? c.fullName() : x.n(), x.s(), c != null ? c.relation : null, c != null && c.verifiedAt != null);
        }).toList();
    }

    static int estimateMinutes(double km) {
        return (int) Math.round(30 + km / 800 * 60);
    }

    @Transactional
    public void toggleChecklist(UUID me, UUID tripId, UUID itemId, boolean done) {
        requireMember(tripId, me);
        var c = checklist.findById(itemId).filter(x -> x.tripId.equals(tripId)).orElseThrow(() -> ApiException.notFound("Item"));
        c.done = done;
        checklist.save(c);
    }

    @Transactional
    public TripDtos.ChecklistDto addChecklistItem(UUID me, UUID tripId, TripDtos.NewChecklistItem in) {
        requireMember(tripId, me);
        var items = checklist.findByTripIdOrderByPosition(tripId);
        if (items.size() >= 200) throw ApiException.badRequest("too_many", "This checklist is full.");
        var c = new ChecklistItemEntity();
        c.tripId = tripId;
        c.label = Text.maskProfanity(Text.clean(in.label(), 80)).text();
        c.category = in.category() == null ? "packing" : in.category();
        c.position = items.isEmpty() ? 0 : items.get(items.size() - 1).position + 1;
        checklist.save(c);
        return new TripDtos.ChecklistDto(c.id.toString(), c.label, c.done, c.category);
    }

    @Transactional
    public TripDtos.ExpenseDto addExpense(UUID me, UUID tripId, TripDtos.NewExpense in) {
        requireMember(tripId, me);
        Set<UUID> memberIds = new HashSet<>(members.findByTripId(tripId).stream().map(m -> m.userId).toList());
        UUID payer = resolve(in.paidBy(), me);
        List<UUID> split = in.splitWith().stream().map(s -> resolve(s, me)).distinct().toList();
        if (!memberIds.contains(payer) || !memberIds.containsAll(split)) throw ApiException.badRequest("not_member", "Everyone must be on the trip.");
        var e = new ExpenseEntity();
        e.tripId = tripId;
        e.label = Text.clean(in.label(), 60);
        e.amountCents = Math.round(in.amount() * 100);
        e.currency = in.currency();
        e.paidBy = payer;
        e.splitWith = String.join(",", split.stream().map(UUID::toString).toList());
        expenses.save(e);
        return expenseDto(e, me);
    }

    @Transactional
    public void join(UUID tripId, UUID userId) {
        if (members.existsByTripIdAndUserId(tripId, userId)) return;
        var m = new TripMemberEntity();
        m.tripId = tripId;
        m.userId = userId;
        m.role = "MEMBER";
        members.save(m);
        trips.findById(tripId).ifPresent(t -> {
            if (t.chatId != null) chat.join(t.chatId, userId);
        });
    }

    public TripDtos.TripDto dto(TripEntity t, UUID me) {
        var dest = airportDto(t.destinationIata);
        var fl = flights.findByTripIdOrderByDepartureAt(t.id).stream().map(this::flightDto).toList();
        var people = members.findByTripId(t.id).stream()
                .map(m -> users.findById(m.userId).map(u -> traveller(u, me)).orElse(null)).filter(Objects::nonNull).toList();
        var items = checklist.findByTripIdOrderByPosition(t.id).stream().map(c -> new TripDtos.ChecklistDto(c.id.toString(), c.label, c.done, c.category)).toList();
        var ex = expenses.findByTripIdOrderByCreatedAt(t.id).stream().map(e -> expenseDto(e, me)).toList();
        return new TripDtos.TripDto(t.id.toString(), t.title, dest, GRADIENTS[Math.floorMod(t.destinationIata.hashCode(), GRADIENTS.length)], "✈️",
                t.startAt.toString(), t.endAt.toString(), fl, people, items, ex, t.chatId == null ? null : t.chatId.toString());
    }

    public TripDtos.FlightDto flightDto(FlightEntity f) {
        var from = airports.get(f.fromIata);
        var to = airports.get(f.toIata);
        int km = from.isPresent() && to.isPresent() ? (int) Math.round(AirportCatalog.distanceKm(from.get(), to.get())) : 0;
        return new TripDtos.FlightDto(f.id.toString(), f.airlineName, f.airlineCode, f.flightNumber, airportDto(f.fromIata), airportDto(f.toIata),
                f.departs().toString(), f.arrives().toString(), f.boards().toString(), f.gate, f.terminal, f.seat, f.cabin, f.bookingRef == null ? "" : f.bookingRef,
                f.passengerName, f.status, (int) Duration.between(f.departs(), f.arrives()).toMinutes(), km, f.fareName, node(f.baggageJson), node(f.verificationJson),
                f.departureAt.toString(), f.arrivalAt.toString(), f.delayMinutes, passengerDtos(f));
    }

    public TripDtos.AirportDto airportDto(String iata) {
        return airports.get(iata)
                .map(a -> new TripDtos.AirportDto(a.iata(), a.city(), a.name(), airports.countryName(a.country()), a.tz(), null))
                .orElse(new TripDtos.AirportDto(iata, iata, iata + " Airport", "", "UTC", null));
    }

    private TripDtos.ExpenseDto expenseDto(ExpenseEntity e, UUID me) {
        List<String> split = Arrays.stream(e.splitWith.split(",")).filter(s -> !s.isBlank()).map(s -> mine(UUID.fromString(s), me)).toList();
        return new TripDtos.ExpenseDto(e.id.toString(), e.label, e.amountCents / 100.0, e.currency, mine(e.paidBy, me), split, e.createdAt.toString());
    }

    private static TripDtos.Traveller traveller(UserEntity u, UUID me) {
        String initials = Arrays.stream(u.displayName.split("\\s+")).filter(p -> !p.isEmpty()).limit(2).map(p -> p.substring(0, 1).toUpperCase()).reduce("", String::concat);
        return new TripDtos.Traveller(mine(u.id, me), u.id.equals(me) ? "You" : u.displayName, initials, u.avatarColor);
    }

    private static String mine(UUID id, UUID me) {
        return id.equals(me) ? "me" : id.toString();
    }

    private static UUID resolve(String id, UUID me) {
        if ("me".equals(id)) return me;
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("bad_id", "Invalid traveller.");
        }
    }

    private JsonNode node(String s) {
        return s == null ? null : json.readTree(s);
    }
}
