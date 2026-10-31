package app.gatemate;

import static org.junit.jupiter.api.Assertions.*;

import app.gatemate.booking.Bcbp;
import app.gatemate.booking.NameMatcher;
import app.gatemate.common.ApiException;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class BcbpAndNameTest {
    static String pass(String name, String pnr, String from, String to, String carrier, String flight, int julian, String seat) {
        return "M1" + pad(name, 20) + "E" + pad(pnr, 7) + from + to + pad(carrier, 3) + String.format("%05d", Integer.parseInt(flight)).replace(' ', '0')
                + String.format("%03d", julian) + "Y" + pad(seat, 4) + "00045" + "1" + "00";
    }

    static String pad(String s, int n) {
        return String.format("%-" + n + "s", s);
    }

    @Test
    void parsesMandatoryFields() {
        var p = Bcbp.parse(pass("POPESCU/ANA MARIA", "ABC123", "OTP", "LTN", "W6", "3301", 120, "012A"), LocalDate.of(2026, 3, 1));
        assertEquals("POPESCU", p.lastName());
        assertEquals("ANA MARIA", p.firstName());
        assertEquals("ABC123", p.bookingRef());
        assertEquals("OTP", p.from());
        assertEquals("LTN", p.to());
        assertEquals("W6", p.carrier());
        assertEquals("3301", p.flightNumber());
        assertEquals("12A", p.seat());
        assertEquals(LocalDate.of(2026, 4, 30), p.flightDate());
    }

    @Test
    void rollsJulianDateIntoNextYear() {
        var p = Bcbp.parse(pass("DOE/JOHN", "XYZ789", "LHR", "JFK", "BA", "117", 5, "001A"), LocalDate.of(2026, 12, 20));
        assertEquals(LocalDate.of(2027, 1, 5), p.flightDate());
    }

    @Test
    void rejectsGarbage() {
        assertThrows(ApiException.class, () -> Bcbp.parse("hello", LocalDate.now()));
        assertThrows(ApiException.class, () -> Bcbp.parse("X" + "1".repeat(70), LocalDate.now()));
    }

    @Test
    void nameMatchingIsDiacriticAndTitleTolerant() {
        assertTrue(NameMatcher.match("ANA MARIA MRS", "POPESCU", "Ana-Maria", "Popescu").ok());
        assertTrue(NameMatcher.match("STEFAN", "IONESCU", "Ștefan", "Ionescu").ok());
        assertTrue(NameMatcher.match("A", "CONSTANTINESC", "Alexandra", "Constantinescu").ok());
        assertFalse(NameMatcher.match("JOHN", "DOE", "Ana", "Popescu").ok());
        assertFalse(NameMatcher.match("ANA", "POP", "Ana", "Popescu").ok());
    }
}
