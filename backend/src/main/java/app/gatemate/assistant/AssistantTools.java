package app.gatemate.assistant;

import app.gatemate.airport.AirportCatalog;
import app.gatemate.common.ApiException;
import app.gatemate.destination.ExploreService;
import app.gatemate.trip.FlightEntity;
import app.gatemate.trip.Repos;
import app.gatemate.trip.TripDtos;
import app.gatemate.trip.TripService;
import com.anthropic.core.JsonValue;
import com.anthropic.models.beta.messages.BetaTool;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.springframework.stereotype.Component;

@Component
public class AssistantTools {
    public record Ctx(UUID userId, Consumer<Map<String, Object>> events) {}

    public static class ToolError extends RuntimeException {
        public ToolError(String message) {
            super(message);
        }
    }

    static final Set<String> EU = Set.of("AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
            "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH");
    private static final DateTimeFormatter LOCAL = DateTimeFormatter.ofPattern("EEE d MMM yyyy, HH:mm", Locale.ENGLISH);

    private final TripService trips;
    private final Repos.Flights flights;
    private final AirportCatalog airports;
    private final ExploreService explore;

    public AssistantTools(TripService trips, Repos.Flights flights, AirportCatalog airports, ExploreService explore) {
        this.trips = trips;
        this.flights = flights;
        this.airports = airports;
        this.explore = explore;
    }

    record Spec(String name, String description, Map<String, Object> props, List<String> required) {}

    public List<BetaTool> definitions() {
        return specs().stream().map(AssistantTools::beta).toList();
    }

    public List<Map<String, Object>> geminiDeclarations() {
        return specs().stream().map(s -> Map.<String, Object>of("name", s.name(), "description", s.description(),
                "parameters", gemini(Map.of("type", "object", "properties", s.props(), "required", s.required())))).toList();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> gemini(Map<String, Object> schema) {
        var out = new LinkedHashMap<String, Object>();
        schema.forEach((k, v) -> {
            switch (k) {
                case "type" -> out.put(k, String.valueOf(v).toUpperCase(Locale.ROOT));
                case "items" -> out.put(k, gemini((Map<String, Object>) v));
                case "properties" -> {
                    var props = new LinkedHashMap<String, Object>();
                    ((Map<String, Object>) v).forEach((n, p) -> props.put(n, gemini((Map<String, Object>) p)));
                    if (!props.isEmpty()) out.put(k, props);
                }
                case "required" -> { if (!((List<?>) v).isEmpty()) out.put(k, v); }
                case "description", "enum" -> out.put(k, v);
                default -> { }
            }
        });
        return out;
    }

    private List<Spec> specs() {
        return List.of(
            tool("get_my_trips", "List the traveller's trips with their flights (times in each airport's local time, gate, terminal, seat, live status), "
                    + "checklist and fellow travellers. Use it for anything about their own travel; never guess flight details.", Map.of(), List.of()),
            tool("get_flight", "Full details of one of the traveller's flights: schedule in local time, boarding time, gate, terminal, seat, live status, "
                    + "fare and baggage allowance, distance and duration.",
                    Map.of("flight_id", str("Flight id from get_my_trips.")), List.of("flight_id")),
            tool("find_airport", "Look up airports by IATA code, city or name. Returns code, name, city, country, time zone and current local time.",
                    Map.of("query", str("IATA code (e.g. OTP), city or airport name.")), List.of("query")),
            tool("get_destination_guide", "Practical facts for the country of an airport (currency, plugs and voltage, emergency numbers, driving side, "
                    + "languages, capital), its top sights and the public holidays in a date range.",
                    Map.of("iata", str("Destination airport IATA code."),
                           "from_date", str("First day of the stay, YYYY-MM-DD (optional; default today)."),
                           "to_date", str("Last day of the stay, YYYY-MM-DD (optional; default 30 days after from_date).")),
                    List.of("iata")),
            tool("convert_currency", "Convert an amount between currencies at today's European Central Bank rate.",
                    Map.of("amount", num("Amount to convert."), "from", str("ISO currency code, e.g. EUR."), "to", str("ISO currency code, e.g. RON.")),
                    List.of("amount", "from", "to")),
            tool("estimate_compensation", "Estimate EU261 compensation for a delayed or cancelled flight from the route distance. "
                    + "Gives the amount band and the conditions; it is an estimate, not legal advice.",
                    Map.of("from", str("Departure airport IATA code."), "to", str("Arrival airport IATA code."),
                           "arrival_delay_hours", num("Delay at arrival in hours (0 if cancelled)."),
                           "cancelled", Map.of("type", "boolean", "description", "Whether the flight was cancelled.")),
                    List.of("from", "to")),
            tool("add_checklist_items", "Add items to one of the traveller's trip checklists. Only use it when the traveller asks you to add, prepare "
                    + "or plan things for a trip. Keep labels short (under 60 characters) and in the traveller's language.",
                    Map.of("trip_id", str("Trip id from get_my_trips."),
                           "items", Map.of("type", "array", "maxItems", 12, "items", Map.of("type", "object",
                                   "properties", Map.of("label", str("What to do or pack."),
                                           "category", Map.of("type", "string", "enum", List.of("documents", "packing", "tasks"))),
                                   "required", List.of("label", "category")))),
                    List.of("trip_id", "items")));
    }

    public Object run(String name, Map<String, Object> in, Ctx ctx) {
        return switch (name) {
            case "get_my_trips" -> myTrips(ctx.userId());
            case "get_flight" -> flight(ctx.userId(), text(in, "flight_id"));
            case "find_airport" -> findAirport(text(in, "query"));
            case "get_destination_guide" -> guide(text(in, "iata"), optText(in, "from_date"), optText(in, "to_date"));
            case "convert_currency" -> convert(number(in, "amount"), text(in, "from"), text(in, "to"));
            case "estimate_compensation" -> compensation(text(in, "from"), text(in, "to"), optNumber(in, "arrival_delay_hours"), Boolean.TRUE.equals(in.get("cancelled")));
            case "add_checklist_items" -> addItems(ctx, text(in, "trip_id"), in.get("items"));
            default -> throw new ToolError("Unknown tool " + name + ".");
        };
    }

    private Object myTrips(UUID me) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (TripDtos.TripDto t : trips.list(me)) {
            var m = new LinkedHashMap<String, Object>();
            m.put("trip_id", t.id());
            m.put("title", t.title());
            m.put("destination", t.destination().city() + " (" + t.destination().code() + "), " + t.destination().country());
            m.put("dates", t.startDate().substring(0, 10) + " → " + t.endDate().substring(0, 10));
            m.put("flights", t.flights().stream().map(this::flightSummary).toList());
            m.put("checklist", t.checklist().stream().map(c -> (c.done() ? "[x] " : "[ ] ") + c.label()).toList());
            m.put("travellers", t.travellers().size());
            m.put("expenses_total", t.expenses().stream().mapToDouble(TripDtos.ExpenseDto::amount).sum());
            out.add(m);
        }
        return Map.of("now_utc", Instant.now().toString(), "trips", out);
    }

    private Map<String, Object> flightSummary(TripDtos.FlightDto f) {
        var m = new LinkedHashMap<String, Object>();
        m.put("flight_id", f.id());
        m.put("flight", f.number() + " · " + f.airline());
        m.put("route", f.from().code() + " " + f.from().city() + " → " + f.to().code() + " " + f.to().city());
        m.put("departs_local", local(f.departure(), f.from().timezone()));
        m.put("arrives_local", local(f.arrival(), f.to().timezone()));
        m.put("departure_utc", f.departure());
        m.put("status", f.status());
        if (f.gate() != null) m.put("gate", f.gate());
        if (f.terminal() != null) m.put("terminal", f.terminal());
        if (f.seat() != null) m.put("seat", f.seat());
        return m;
    }

    private Object flight(UUID me, String id) {
        FlightEntity f = flights.findById(uuid(id)).orElseThrow(() -> new ToolError("No flight with this id."));
        if (f.tripId == null) throw new ToolError("No flight with this id.");
        try {
            trips.requireMember(f.tripId, me);
        } catch (ApiException e) {
            throw new ToolError("No flight with this id.");
        }
        var d = trips.flightDto(f);
        var m = new LinkedHashMap<String, Object>(flightSummary(d));
        m.put("boarding_local", local(d.boardingTime(), d.from().timezone()));
        m.put("cabin", d.cabin());
        if (d.fareName() != null) m.put("fare", d.fareName());
        if (d.baggage() != null) m.put("baggage", d.baggage().toString());
        m.put("distance_km", d.distanceKm());
        m.put("duration_minutes", d.durationMinutes());
        m.put("from_airport", d.from().name());
        m.put("to_airport", d.to().name());
        return m;
    }

    private Object findAirport(String q) {
        var exact = q.length() == 3 ? airports.get(q.toUpperCase(Locale.ROOT)) : java.util.Optional.<AirportCatalog.Airport>empty();
        List<AirportCatalog.Airport> list = exact.map(List::of).orElseGet(() -> airports.search(q, 5));
        if (list.isEmpty()) throw new ToolError("No airport matches \"" + q + "\".");
        return list.stream().map(a -> {
            var m = new LinkedHashMap<String, Object>();
            m.put("iata", a.iata());
            m.put("name", a.name());
            m.put("city", a.city());
            m.put("country", airports.countryName(a.country()));
            m.put("time_zone", a.tz());
            m.put("local_time_now", LOCAL.format(Instant.now().atZone(zone(a.tz()))));
            return m;
        }).toList();
    }

    private Object guide(String iata, String fromDate, String toDate) {
        var a = airports.get(iata.toUpperCase(Locale.ROOT)).orElseThrow(() -> new ToolError("Unknown airport " + iata + "."));
        var m = new LinkedHashMap<String, Object>();
        m.put("airport", a.name() + " (" + a.iata() + "), " + a.city());
        m.put("local_time_now", LOCAL.format(Instant.now().atZone(zone(a.tz()))));
        airports.country(a.country()).ifPresent(c -> {
            var f = new LinkedHashMap<String, Object>();
            f.put("country", c.name());
            f.put("capital", c.capital());
            f.put("currency", c.currency());
            f.put("languages", c.languages());
            f.put("plugs", c.plugs() == null ? null : "Type " + c.plugs() + (c.volts() == null ? "" : ", " + c.volts() + " V"));
            f.put("drives_on", Boolean.TRUE.equals(c.left()) ? "left" : "right");
            f.put("emergency_numbers", c.sos());
            f.put("dialling_code", c.phone() == null || c.phone().isEmpty() ? null : "+" + c.phone().get(0));
            m.put("country_facts", f);
        });
        try {
            m.put("top_sights", explore.sights(a.iata()).stream().limit(8)
                    .map(s -> s.name() + (s.description() == null || s.description().isBlank() ? "" : " — " + s.description())).toList());
        } catch (RuntimeException e) {
            m.put("top_sights", "unavailable right now");
        }
        LocalDate from = date(fromDate, LocalDate.now(ZoneOffset.UTC));
        LocalDate to = date(toDate, from.plusDays(30));
        if (to.isBefore(from) || to.isAfter(from.plusDays(400))) throw new ToolError("Use a date range of up to a year.");
        try {
            List<String> hols = new ArrayList<>();
            for (int y = from.getYear(); y <= to.getYear(); y++) {
                for (var h : explore.holidays(a.country(), y)) {
                    LocalDate d = LocalDate.parse(h.date());
                    if (!d.isBefore(from) && !d.isAfter(to)) hols.add(h.date() + " " + h.name() + (h.national() ? "" : " (regional)"));
                }
            }
            m.put("public_holidays", hols);
        } catch (RuntimeException e) {
            m.put("public_holidays", "unavailable right now");
        }
        return m;
    }

    private Object convert(double amount, String from, String to) {
        String f = from.toUpperCase(Locale.ROOT), t = to.toUpperCase(Locale.ROOT);
        if (f.equals(t)) return Map.of("amount", amount, "currency", t);
        ExploreService.Rate r;
        try {
            r = explore.rate(f, t);
        } catch (RuntimeException e) {
            throw new ToolError("No exchange rate for " + f + " → " + t + ".");
        }
        if (r == null) throw new ToolError("No exchange rate for " + f + " → " + t + ".");
        return Map.of("amount", amount, "from", f, "to", t, "result", Math.round(amount * r.rate() * 100) / 100.0, "rate", r.rate(), "rate_date", r.date());
    }

    private Object compensation(String fromIata, String toIata, Double delayHours, boolean cancelled) {
        var a = airports.get(fromIata.toUpperCase(Locale.ROOT)).orElseThrow(() -> new ToolError("Unknown airport " + fromIata + "."));
        var b = airports.get(toIata.toUpperCase(Locale.ROOT)).orElseThrow(() -> new ToolError("Unknown airport " + toIata + "."));
        double km = AirportCatalog.distanceKm(a, b);
        boolean intraEu = EU.contains(a.country()) && EU.contains(b.country());
        int amount = km <= 1500 ? 250 : (km <= 3500 || intraEu) ? 400 : 600;
        double delay = delayHours == null ? 0 : delayHours;
        boolean qualifies = cancelled || delay >= 3;
        boolean halved = !cancelled && amount == 600 && delay < 4;
        var m = new LinkedHashMap<String, Object>();
        m.put("distance_km", Math.round(km));
        m.put("departs_from_eu", EU.contains(a.country()));
        m.put("arrives_in_eu", EU.contains(b.country()));
        m.put("covered_if", "the flight departs from the EU/EEA/Switzerland (any airline), or arrives there on an EU/EEA airline");
        m.put("qualifies_by_delay", qualifies);
        m.put("compensation_eur", qualifies ? (halved ? amount / 2 : amount) : 0);
        m.put("full_band_eur", amount);
        m.put("not_owed_when", "extraordinary circumstances (e.g. weather, air-traffic-control strikes, security risks), or the passenger was told of a "
                + "cancellation at least 14 days ahead");
        m.put("also_owed", "meals and refreshments during long delays, hotel and transfers if an overnight stay is needed; a refund or rerouting if cancelled");
        return m;
    }

    private Object addItems(Ctx ctx, String tripId, Object raw) {
        UUID id = uuid(tripId);
        if (!(raw instanceof List<?> list) || list.isEmpty()) throw new ToolError("Give at least one item.");
        if (list.size() > 12) throw new ToolError("Add at most 12 items at a time.");
        List<String> added = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> item) || !(item.get("label") instanceof String label) || label.isBlank()) throw new ToolError("Each item needs a label.");
            String cat = item.get("category") instanceof String c && Set.of("documents", "packing", "tasks").contains(c) ? c : "packing";
            try {
                added.add(trips.addChecklistItem(ctx.userId(), id, new TripDtos.NewChecklistItem(label.length() > 80 ? label.substring(0, 80) : label, cat)).label());
            } catch (ApiException e) {
                if (added.isEmpty()) throw new ToolError(e.getMessage());
                break;
            }
        }
        ctx.events().accept(Map.of("type", "action", "kind", "checklist", "tripId", tripId, "added", added));
        return Map.of("added", added);
    }

    private static Spec tool(String name, String description, Map<String, Object> props, List<String> required) {
        return new Spec(name, description, props, required);
    }

    private static BetaTool beta(Spec s) {
        String name = s.name(), description = s.description();
        var schema = BetaTool.InputSchema.builder().properties(JsonValue.from(s.props())).required(s.required())
                .putAdditionalProperty("additionalProperties", JsonValue.from(false)).build();
        return BetaTool.builder().name(name).description(description).inputSchema(schema).eagerInputStreaming(true).build();
    }

    private static Map<String, Object> str(String description) {
        return Map.of("type", "string", "description", description);
    }

    private static Map<String, Object> num(String description) {
        return Map.of("type", "number", "description", description);
    }

    private static String text(Map<String, Object> in, String key) {
        if (in.get(key) instanceof String s && !s.isBlank() && s.length() <= 200) return s.trim();
        throw new ToolError("Missing or invalid \"" + key + "\".");
    }

    private static String optText(Map<String, Object> in, String key) {
        return in.get(key) instanceof String s && !s.isBlank() ? s.trim() : null;
    }

    private static double number(Map<String, Object> in, String key) {
        Double d = optNumber(in, key);
        if (d == null || d.isNaN() || d.isInfinite()) throw new ToolError("Missing or invalid \"" + key + "\".");
        return d;
    }

    private static Double optNumber(Map<String, Object> in, String key) {
        return in.get(key) instanceof Number n ? n.doubleValue() : null;
    }

    private static UUID uuid(String s) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            throw new ToolError("Invalid id \"" + s + "\".");
        }
    }

    private static LocalDate date(String s, LocalDate fallback) {
        if (s == null) return fallback;
        try {
            return LocalDate.parse(s);
        } catch (RuntimeException e) {
            throw new ToolError("Dates must be YYYY-MM-DD.");
        }
    }

    private static ZoneId zone(String tz) {
        try {
            return ZoneId.of(tz);
        } catch (RuntimeException e) {
            return ZoneOffset.UTC;
        }
    }

    private static String local(String iso, String tz) {
        try {
            return LOCAL.format(Instant.parse(iso).atZone(zone(tz)));
        } catch (RuntimeException e) {
            return iso;
        }
    }
}
