package app.gatemate.auth;

import app.gatemate.common.ApiException;
import java.util.Set;

/** Same rules as the app: length, mixed case, digit, symbol, not common, not containing the e-mail name. */
public final class PasswordPolicy {
    private static final Set<String> COMMON = Set.of("password", "password1", "password123", "123456789", "1234567890", "qwertyuiop",
            "iloveyou1", "admin12345", "welcome123", "letmein123", "football1", "gatemate1", "gatemate123");

    private PasswordPolicy() {}

    public static void check(String pw, String email) {
        boolean ok = pw.length() >= 10 && pw.length() <= 128 && pw.matches(".*[a-z].*") && pw.matches(".*[A-Z].*") && pw.matches(".*\\d.*")
                && pw.matches(".*[^A-Za-z0-9].*") && !COMMON.contains(pw.toLowerCase());
        String local = email == null ? "" : email.split("@")[0].toLowerCase();
        if (ok && local.length() >= 3 && pw.toLowerCase().contains(local)) ok = false;
        if (!ok) throw ApiException.badRequest("weak_password", "Use at least 10 characters with upper and lower case letters, a number and a symbol.");
    }
}
