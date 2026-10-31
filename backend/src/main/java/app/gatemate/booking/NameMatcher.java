package app.gatemate.booking;

import app.gatemate.common.Text;
import java.util.Locale;

public final class NameMatcher {
    private NameMatcher() {}

    public record Result(boolean ok, boolean lastNameOk, boolean firstNameOk) {}

    public static String normalize(String s) {
        return Text.fold(s).toUpperCase(Locale.ROOT).replaceAll("[^A-Z /]", " ")
                .replaceAll("\\b(MR|MRS|MS|MISS|MSTR|DR|PROF|CHD|INF)\\b", " ").replaceAll("\\s+", " ").trim();
    }

    public static Result match(String ticketFirst, String ticketLast, String legalFirst, String legalLast) {
        String tl = normalize(ticketLast).replace(" ", ""), ll = normalize(legalLast).replace(" ", "");
        String tf = normalize(ticketFirst).replace(" ", ""), lf = normalize(legalFirst).replace(" ", "");
        boolean last = !tl.isEmpty() && !ll.isEmpty() && (tl.equals(ll) || (tl.length() >= 8 && ll.startsWith(tl)));
        boolean first = !tf.isEmpty() && !lf.isEmpty() && (tf.equals(lf) || lf.startsWith(tf) || tf.startsWith(lf));
        return new Result(last && first, last, first);
    }
}
