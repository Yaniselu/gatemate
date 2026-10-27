package app.gatemate.booking;

import app.gatemate.common.ApiException;
import java.time.LocalDate;
import java.time.Year;

/** IATA Resolution 792 Bar Coded Boarding Pass — mandatory unique fields (same rules as the app). */
public record Bcbp(String raw, String firstName, String lastName, String bookingRef, String from, String to, String carrier,
        String flightNumber, int julianDate, LocalDate flightDate, String cabinCode, String seat, String sequence) {

    public static Bcbp parse(String input, LocalDate today) {
        String d = input == null ? "" : input.replaceAll("\\r?\\n", "");
        if (d.length() < 60 || d.charAt(0) != 'M') throw ApiException.badRequest("not_a_boarding_pass", "This code is not a boarding pass.");
        String from = f(d, 30, 3), to = f(d, 33, 3);
        int julian;
        try {
            julian = Integer.parseInt(f(d, 44, 3));
        } catch (NumberFormatException e) {
            julian = -1;
        }
        if (!from.matches("[A-Z]{3}") || !to.matches("[A-Z]{3}") || julian < 1 || julian > 366) {
            throw ApiException.badRequest("unreadable_pass", "The boarding pass could not be read.");
        }
        String[] name = f(d, 2, 20).split("/", 2);
        String last = name[0].trim(), first = name.length > 1 ? name[1].trim() : "";
        LocalDate date = Year.of(today.getYear()).atDay(Math.min(julian, Year.of(today.getYear()).length()));
        if (date.isBefore(today.minusDays(60))) date = Year.of(today.getYear() + 1).atDay(Math.min(julian, Year.of(today.getYear() + 1).length()));
        return new Bcbp(d, first, last, f(d, 23, 7), from, to, f(d, 36, 3), f(d, 39, 5).replaceFirst("^0+", ""), julian, date, f(d, 47, 1),
                f(d, 48, 4).replaceFirst("^0+", ""), f(d, 52, 5).replaceFirst("^0+", ""));
    }

    private static String f(String d, int start, int len) {
        return d.substring(start, Math.min(d.length(), start + len)).trim();
    }
}
