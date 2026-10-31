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
        String tf = firstOnTicket(ticketFirst), lf = normalize(legalFirst).replace(" ", "");
        boolean last = !tl.isEmpty() && !ll.isEmpty() && (tl.equals(ll) || (tl.length() >= 8 && ll.startsWith(tl)));
        boolean first = !tf.isEmpty() && !lf.isEmpty() && (tf.equals(lf) || lf.startsWith(tf) || tf.startsWith(lf));
        if (last && first) return new Result(true, true, true);
        if (anyOrder(ticketFirst, ticketLast, legalFirst, legalLast)) return new Result(true, true, true);
        return new Result(false, last, first);
    }

    public static int quality(String ticketFirst, String ticketLast, String legalFirst, String legalLast) {
        if (legalFirst == null || legalLast == null) return 0;
        String tl = normalize(ticketLast).replace(" ", ""), ll = normalize(legalLast).replace(" ", "");
        String tf = firstOnTicket(ticketFirst), lf = normalize(legalFirst).replace(" ", "");
        if (!tl.isEmpty() && tl.equals(ll) && !tf.isEmpty() && tf.equals(lf)) return 3 + lf.length();
        return match(ticketFirst, ticketLast, legalFirst, legalLast).ok() ? 1 + Math.min(lf.length(), tf.length()) / 100 : 0;
    }

    public static String displayFirst(String first) {
        String f = (first == null ? "" : first).trim().toUpperCase(Locale.ROOT);
        String cut = f.replaceAll("\\s*(MRS|MSTR|MISS|MR|MS|DR|CHD|INF)$", "").trim();
        return cut.length() >= 2 ? cut : f;
    }

    public static String firstOnTicket(String first) {
        String f = normalize(first == null ? "" : first).replace(" ", "");
        String cut = f.replaceAll("(MRS|MSTR|MISS|MR|MS|DR|CHD|INF)$", "");
        return cut.length() >= 2 ? cut : f;
    }

    private static boolean anyOrder(String ticketFirst, String ticketLast, String legalFirst, String legalLast) {
        var legal = new java.util.ArrayList<>(java.util.Arrays.asList(normalize((legalFirst == null ? "" : legalFirst) + " " + (legalLast == null ? "" : legalLast)).split("[ /]+")));
        legal.removeIf(String::isEmpty);
        var lastWords = normalize(ticketLast == null ? "" : ticketLast).split("[ /]+");
        if (legal.size() < 2 || lastWords.length == 0 || lastWords[0].isEmpty()) return false;
        for (String w : lastWords) {
            if (!legal.remove(w)) return false;
        }
        String rest = String.join("", legal), tf = normalize(ticketFirst == null ? "" : ticketFirst).replace(" ", "");
        return !rest.isEmpty() && !tf.isEmpty() && (tf.equals(rest) || tf.startsWith(rest) || rest.startsWith(tf));
    }
}
