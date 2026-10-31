package app.gatemate.booking;

import app.gatemate.common.ApiException;
import java.time.LocalDate;
import java.time.Year;

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
        LocalDate date = flightDate(d, julian, today);
        return new Bcbp(d, first, last, f(d, 23, 7), from, to, f(d, 36, 3), f(d, 39, 5).replaceFirst("^0+", ""), julian, date, f(d, 47, 1),
                f(d, 48, 4).replaceFirst("^0+", ""), f(d, 52, 5).replaceFirst("^0+", ""));
    }

    static LocalDate flightDate(String d, int julian, LocalDate today) {
        LocalDate issued = issueDate(d, today);
        if (issued != null) {
            LocalDate same = at(issued.getYear(), julian);
            return same.isBefore(issued.minusDays(1)) ? at(issued.getYear() + 1, julian) : same;
        }
        LocalDate best = null;
        for (int y = today.getYear() - 1; y <= today.getYear() + 1; y++) {
            LocalDate c = at(y, julian);
            if (best == null || Math.abs(c.toEpochDay() - today.toEpochDay()) < Math.abs(best.toEpochDay() - today.toEpochDay())) best = c;
        }
        return best;
    }

    private static LocalDate issueDate(String d, LocalDate today) {
        if (d.length() < 71 || d.charAt(60) != '>') return null;
        String field = d.substring(67, 71);
        if (!field.matches("\\d{4}")) return null;
        int digit = field.charAt(0) - '0', julian = Integer.parseInt(field.substring(1));
        if (julian < 1 || julian > 366) return null;
        int year = today.getYear() - Math.floorMod(today.getYear() % 10 - digit, 10);
        return at(year, julian);
    }

    private static LocalDate at(int year, int julian) {
        return Year.of(year).atDay(Math.min(julian, Year.of(year).length()));
    }

    private static String f(String d, int start, int len) {
        return d.substring(start, Math.min(d.length(), start + len)).trim();
    }
}
