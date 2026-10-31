package app.gatemate.booking;

import app.gatemate.airport.AirportCatalog;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class EmailBookingParser {
    public record Parsed(String carrier, String carrierName, String number, String from, String to, Instant departure, Instant arrival,
            boolean timeKnown, String bookingRef, String seat) {}

    public record Result(List<Parsed> flights, String bookingRef, String text) {}

    private static final Pattern JSON_LD = Pattern.compile("<script[^>]*application/ld\\+json[^>]*>(.*?)</script>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern PNR = Pattern.compile(
            "(?i)(?:booking|reservation|confirmation|reference)\\s*(?:reference|ref\\.?|code|number|no\\.?|#)?|\\bPNR\\b|record locator|cod(?:ul)?\\s*(?:de\\s*)?(?:rezervare|confirmare)|numărul rezervării|rezervare");
    private static final Pattern PNR_VALUE = Pattern.compile("^[\\s:#\\-–]*([A-Z0-9]{6})\\b");
    private static final Pattern FLIGHT = Pattern.compile("(?<![A-Za-z0-9])([A-Z]{2}|[A-Z][0-9]|[0-9][A-Z])\\s?(\\d{1,4})(?![0-9:/])");
    private static final Pattern CODE_PAREN = Pattern.compile("\\(([A-Z]{3})\\)");
    private static final Pattern CODE_PAIR = Pattern.compile("(?<![A-Za-z])([A-Z]{3})\\s*(?:-|–|—|→|->|>|✈|to|spre)\\s*([A-Z]{3})(?![A-Za-z])");
    private static final Pattern TIME = Pattern.compile("(?<![\\d:])([01]?\\d|2[0-3])[:.h]([0-5]\\d)(?:\\s*([AaPp])\\.?[Mm]\\.?)?(?![\\d:])");
    private static final Map<String, Integer> MONTHS = new LinkedHashMap<>();
    static {
        String[][] m = {{"jan", "ian"}, {"feb"}, {"mar"}, {"apr"}, {"may", "mai"}, {"jun", "iun"}, {"jul", "iul"}, {"aug"}, {"sep"}, {"oct"}, {"nov", "noi"}, {"dec"}};
        for (int i = 0; i < m.length; i++) for (String k : m[i]) MONTHS.put(k, i + 1);
    }
    private static final String MONTH_RE = "(jan|ian|feb|mar|apr|may|mai|jun|iun|jul|iul|aug|sep|oct|nov|noi|dec)[a-zăâîșțé]*\\.?";
    private static final Pattern DATE_ISO = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");
    private static final Pattern DATE_NUM = Pattern.compile("(?<!\\d)(\\d{1,2})[./](\\d{1,2})[./](\\d{4})(?!\\d)");
    private static final Pattern DATE_DMY = Pattern.compile("(?i)(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s+" + MONTH_RE + "(?:\\s+(\\d{4}))?");
    private static final Pattern DATE_MDY = Pattern.compile("(?i)\\b" + MONTH_RE + "\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})");
    private static final Pattern SEAT = Pattern.compile("(?i)\\b(?:seat|loc)\\s*[:\\-]?\\s*(\\d{1,2}[A-K])\\b");

    private static final java.util.Set<String> NOT_AIRLINES = java.util.Set.of("ON", "AT", "TO", "IN", "OF", "NO", "BY", "OR", "AN", "IS", "IT", "UP", "AM", "PM",
            "MR", "MS", "DR", "GB", "KG", "CM", "EU", "ID", "OK", "TV", "PC", "UK", "US", "RE", "FW", "DE", "LA", "LE", "EL", "IL", "LT", "ST", "ND", "RD", "TH");
    private static final Pattern FLIGHT_WORD = Pattern.compile("(?i)(flight|flug|vol|vuelo|volo|zbor(?:ul)?|cursa)\\s*(?:no\\.?|nr\\.?|number|#)?\\s*[:\\-]?\\s*$");

    private final AirportCatalog airports;
    private final app.gatemate.airport.AirlineCatalog airlines;
    private final JsonMapper json;

    public EmailBookingParser(AirportCatalog airports, app.gatemate.airport.AirlineCatalog airlines, JsonMapper json) {
        this.airports = airports;
        this.airlines = airlines;
        this.json = json;
    }

    public Result parse(String html, String plain, LocalDate today) {
        var out = new ArrayList<Parsed>();
        if (html != null) out.addAll(fromJsonLd(html));
        String text = (plain != null && !plain.isBlank() ? plain : "") + "\n" + (html != null ? toText(html) : "");
        String ref = bookingRef(text);
        if (out.isEmpty()) out.addAll(fromText(text, ref, today));
        return new Result(dedupe(out), ref, text);
    }

    private List<Parsed> fromJsonLd(String html) {
        var out = new ArrayList<Parsed>();
        Matcher m = JSON_LD.matcher(html);
        while (m.find()) {
            try {
                JsonNode n = json.readTree(m.group(1).replace("&quot;", "\""));
                for (JsonNode r : n.isArray() ? n : List.of(n)) {
                    if (!"FlightReservation".equals(r.path("@type").asString(""))) continue;
                    JsonNode fl = r.path("reservationFor");
                    String carrier = fl.path("airline").path("iataCode").asString("").toUpperCase(Locale.ROOT);
                    String number = fl.path("flightNumber").asString("").replaceFirst("^" + Pattern.quote(carrier), "").trim();
                    String from = fl.path("departureAirport").path("iataCode").asString("");
                    String to = fl.path("arrivalAirport").path("iataCode").asString("");
                    if (carrier.isBlank() || number.isBlank() || airports.get(from).isEmpty() || airports.get(to).isEmpty()) continue;
                    Instant dep = instant(fl.path("departureTime").asString(""), from);
                    if (dep == null) continue;
                    Instant arr = instant(fl.path("arrivalTime").asString(""), to);
                    out.add(new Parsed(carrier, fl.path("airline").path("name").asString(carrier), number, from.toUpperCase(Locale.ROOT), to.toUpperCase(Locale.ROOT),
                            dep, arr, true, blank(r.path("reservationNumber").asString("")), blank(r.path("airplaneSeat").asString(""))));
                }
            } catch (Exception ignored) {
            }
        }
        return out;
    }

    private Instant instant(String s, String iata) {
        if (s == null || s.isBlank()) return null;
        try {
            return OffsetDateTime.parse(s).toInstant();
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(s.length() > 19 ? s.substring(0, 19) : s).atZone(zone(iata)).toInstant();
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private List<Parsed> fromText(String text, String ref, LocalDate today) {
        var out = new ArrayList<Parsed>();
        var flights = new ArrayList<int[]>();
        Matcher f = FLIGHT.matcher(text);
        while (f.find()) {
            String before = text.substring(Math.max(0, f.start() - 12), f.start()).toLowerCase(Locale.ROOT);
            if (before.matches(".*(terminal|gate|poarta|seat|loc|row|rând|pas)\\s*[:#]?\\s*$")) continue;
            String code = f.group(1);
            boolean labelled = FLIGHT_WORD.matcher(text.substring(Math.max(0, f.start() - 24), f.start())).find();
            if (!airlines.known(code) && (NOT_AIRLINES.contains(code) || !labelled)) continue;
            flights.add(new int[] {f.start(), f.end()});
        }
        for (int i = 0; i < flights.size(); i++) {
            int start = flights.get(i)[0], end = flights.get(i)[1];
            int next = i + 1 < flights.size() ? flights.get(i + 1)[0] : text.length();
            Matcher fm = FLIGHT.matcher(text.substring(start, end));
            if (!fm.find()) continue;
            String carrier = fm.group(1), number = fm.group(2);
            String after = text.substring(end, Math.min(next, end + 700));
            String before = text.substring(Math.max(0, start - 350), start);
            String[] route = route(after);
            if (route == null) route = route(before);
            if (route == null) continue;
            LocalDate date = date(after, today);
            if (date == null) date = date(before, today);
            if (date == null) continue;
            List<LocalTime> times = times(after);
            if (times.isEmpty()) times = times(before);
            boolean known = !times.isEmpty();
            var from = airports.get(route[0]).orElseThrow();
            var to = airports.get(route[1]).orElseThrow();
            LocalTime depT = known ? times.get(0) : LocalTime.NOON;
            Instant dep = date.atTime(depT).atZone(zone(from.iata())).toInstant();
            Instant arr = null;
            if (times.size() > 1) {
                LocalDateTime a = date.atTime(times.get(1));
                if (!times.get(1).isAfter(depT)) a = a.plusDays(1);
                arr = a.atZone(zone(to.iata())).toInstant();
                long h = Duration.between(dep, arr).toHours();
                if (h < 0 || h > 20) arr = null;
            }
            Matcher seat = SEAT.matcher(after);
            String carrierName = airlines.get(carrier).map(app.gatemate.airport.AirlineCatalog.Airline::name).orElse(carrier);
            out.add(new Parsed(carrier, carrierName, number, from.iata(), to.iata(), dep, arr, known, ref, seat.find() ? seat.group(1).toUpperCase(Locale.ROOT) : null));
        }
        return out;
    }

    private String[] route(String s) {
        Matcher p = CODE_PAIR.matcher(s);
        while (p.find()) if (valid(p.group(1)) && valid(p.group(2)) && !p.group(1).equals(p.group(2))) return new String[] {p.group(1), p.group(2)};
        Matcher c = CODE_PAREN.matcher(s);
        String first = null;
        while (c.find()) {
            if (!valid(c.group(1))) continue;
            if (first == null) first = c.group(1);
            else if (!first.equals(c.group(1))) return new String[] {first, c.group(1)};
        }
        return null;
    }

    private boolean valid(String iata) {
        return airports.get(iata).isPresent();
    }

    static LocalDate date(String s, LocalDate today) {
        LocalDate best = null;
        int pos = Integer.MAX_VALUE;
        Matcher m = DATE_ISO.matcher(s);
        if (m.find() && m.start() < pos) {
            LocalDate d = safe(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
            if (d != null) { best = d; pos = m.start(); }
        }
        m = DATE_NUM.matcher(s);
        if (m.find() && m.start() < pos) {
            LocalDate d = safe(Integer.parseInt(m.group(3)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)));
            if (d != null) { best = d; pos = m.start(); }
        }
        m = DATE_DMY.matcher(s);
        if (m.find() && m.start() < pos) {
            int month = MONTHS.get(m.group(2).toLowerCase(Locale.ROOT).substring(0, 3));
            int day = Integer.parseInt(m.group(1));
            LocalDate d = m.group(3) != null ? safe(Integer.parseInt(m.group(3)), month, day) : upcoming(today, month, day);
            if (d != null) { best = d; pos = m.start(); }
        }
        m = DATE_MDY.matcher(s);
        if (m.find() && m.start() < pos) {
            LocalDate d = safe(Integer.parseInt(m.group(3)), MONTHS.get(m.group(1).toLowerCase(Locale.ROOT).substring(0, 3)), Integer.parseInt(m.group(2)));
            if (d != null) best = d;
        }
        return best;
    }

    static List<LocalTime> times(String s) {
        var out = new ArrayList<LocalTime>();
        Matcher m = TIME.matcher(s);
        while (m.find() && out.size() < 2) {
            int h = Integer.parseInt(m.group(1)), min = Integer.parseInt(m.group(2));
            if (m.group(3) != null) {
                boolean pm = m.group(3).equalsIgnoreCase("p");
                if (h == 12) h = pm ? 12 : 0;
                else if (pm) h += 12;
            }
            out.add(LocalTime.of(h % 24, min));
        }
        return out;
    }

    static String bookingRef(String text) {
        Matcher m = PNR.matcher(text);
        while (m.find()) {
            Matcher v = PNR_VALUE.matcher(text.substring(m.end(), Math.min(text.length(), m.end() + 30)));
            if (v.find() && v.group(1).matches(".*[A-Z].*")) return v.group(1);
        }
        return null;
    }

    public static boolean mentionsName(String text, String legalFirst, String legalLast) {
        if (text == null || legalFirst == null || legalLast == null) return false;
        String t = " " + NameMatcher.normalize(text).replaceAll("[^A-Z]+", " ") + " ";
        String last = NameMatcher.normalize(legalLast).replaceAll("[^A-Z]+", " ").trim();
        String first = NameMatcher.normalize(legalFirst).replaceAll("[^A-Z]+", " ").trim().split(" ")[0];
        return !last.isEmpty() && !first.isEmpty() && t.contains(" " + last + " ") && t.contains(" " + first + " ");
    }

    public static String toText(String html) {
        String s = html.replaceAll("(?is)<(script|style|head)[^>]*>.*?</\\1>", " ")
                .replaceAll("(?i)<br\\s*/?>|</(p|div|tr|li|h\\d|table)>", "\n")
                .replaceAll("(?i)</t[dh]>", "  ")
                .replaceAll("<[^>]+>", " ");
        s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
                .replace("&rarr;", "→").replace("&ndash;", "–").replace("&mdash;", "—");
        Matcher m = Pattern.compile("&#(\\d{2,5});").matcher(s);
        var sb = new StringBuilder();
        while (m.find()) m.appendReplacement(sb, Matcher.quoteReplacement(new String(Character.toChars(Integer.parseInt(m.group(1))))));
        m.appendTail(sb);
        return sb.toString().replaceAll("[ \\t\\x0B\\f\\r]+", " ").replaceAll("\\n\\s*\\n+", "\n");
    }

    private static List<Parsed> dedupe(List<Parsed> in) {
        var seen = new LinkedHashMap<String, Parsed>();
        for (Parsed p : in) seen.putIfAbsent(p.carrier() + p.number() + "|" + p.departure().toString().substring(0, 10) + "|" + p.from(), p);
        return new ArrayList<>(seen.values());
    }

    private ZoneId zone(String iata) {
        return airports.get(iata).map(a -> {
            try {
                return ZoneId.of(a.tz());
            } catch (Exception e) {
                return ZoneId.of("UTC");
            }
        }).orElse(ZoneId.of("UTC"));
    }

    private static LocalDate safe(int y, int m, int d) {
        try {
            return LocalDate.of(y, m, d);
        } catch (Exception e) {
            return null;
        }
    }

    private static LocalDate upcoming(LocalDate today, int month, int day) {
        LocalDate d = safe(today.getYear(), month, day);
        if (d != null && d.isBefore(today.minusDays(2))) d = safe(today.getYear() + 1, month, day);
        return d;
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
