package app.gatemate.identity;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public final class Mrz {
    public record Document(String type, String country, String lastName, String firstName, String number, String nationality, LocalDate birth,
            String sex, LocalDate expiry) {}

    private Mrz() {}

    public static Optional<Document> parse(List<String> raw) {
        var lines = new ArrayList<String>();
        for (String l : raw) {
            if (l == null) continue;
            String s = l.toUpperCase(Locale.ROOT).replaceAll("\\s+", "").replace('«', '<');
            if (s.length() >= 28) lines.add(s);
        }
        for (int i = 0; i + 1 < lines.size(); i++) {
            String a = lines.get(i), b = lines.get(i + 1);
            if (a.length() >= 43 && b.length() >= 43) {
                var d = td3(fit(a, 44), fit(b, 44));
                if (d.isPresent()) return d;
            }
            if (i + 2 < lines.size() && a.length() >= 29 && b.length() >= 29) {
                var d = td1(fit(a, 30), fit(b, 30), fit(lines.get(i + 2), 30));
                if (d.isPresent()) return d;
            }
            if (a.length() >= 35 && b.length() >= 35) {
                var d = td2(fit(a, 36), fit(b, 36));
                if (d.isPresent()) return d;
            }
        }
        return Optional.empty();
    }

    static Optional<Document> td3(String l1, String l2) {
        if (l1.charAt(0) != 'P') return Optional.empty();
        String number = l2.substring(0, 9), birth = l2.substring(13, 19), expiry = l2.substring(21, 27), optional = l2.substring(28, 42);
        if (!ok(number, l2.charAt(9)) || !ok(birth, l2.charAt(19)) || !ok(expiry, l2.charAt(27))) return Optional.empty();
        if (l2.charAt(42) != '<' && !ok(optional, l2.charAt(42))) return Optional.empty();
        String composite = l2.substring(0, 10) + l2.substring(13, 20) + l2.substring(21, 43);
        if (!ok(composite, l2.charAt(43))) return Optional.empty();
        String[] names = names(l1.substring(5));
        return build("P", l1.substring(2, 5), names, number, l2.substring(10, 13), birth, l2.charAt(20), expiry);
    }

    static Optional<Document> td1(String l1, String l2, String l3) {
        char t = l1.charAt(0);
        if (t != 'I' && t != 'A' && t != 'C') return Optional.empty();
        String number = l1.substring(5, 14), birth = l2.substring(0, 6), expiry = l2.substring(8, 14);
        if (!ok(number, l1.charAt(14)) || !ok(birth, l2.charAt(6)) || !ok(expiry, l2.charAt(14))) return Optional.empty();
        String composite = l1.substring(5, 30) + l2.substring(0, 7) + l2.substring(8, 15) + l2.substring(18, 29);
        if (!ok(composite, l2.charAt(29))) return Optional.empty();
        return build("I", l1.substring(2, 5), names(l3), number, l2.substring(15, 18), birth, l2.charAt(7), expiry);
    }

    static Optional<Document> td2(String l1, String l2) {
        char t = l1.charAt(0);
        if (t != 'I' && t != 'A' && t != 'C' && t != 'P') return Optional.empty();
        String number = l2.substring(0, 9), birth = l2.substring(13, 19), expiry = l2.substring(21, 27);
        if (!ok(number, l2.charAt(9)) || !ok(birth, l2.charAt(19)) || !ok(expiry, l2.charAt(27))) return Optional.empty();
        String composite = l2.substring(0, 10) + l2.substring(13, 20) + l2.substring(21, 35);
        if (!ok(composite, l2.charAt(35))) return Optional.empty();
        return build(String.valueOf(t), l1.substring(2, 5), names(l1.substring(5)), number, l2.substring(10, 13), birth, l2.charAt(20), expiry);
    }

    private static Optional<Document> build(String type, String country, String[] names, String number, String nat, String birth, char sex, String expiry) {
        if (names[0].isBlank()) return Optional.empty();
        LocalDate b = date(birth, false), e = date(expiry, true);
        if (b == null || e == null) return Optional.empty();
        return Optional.of(new Document(type, clean(country), names[0], names[1], number.replace("<", ""), clean(nat), b,
                sex == 'M' || sex == 'F' ? String.valueOf(sex) : "X", e));
    }

    private static String[] names(String field) {
        String f = field.replaceAll("<+$", "");
        int split = f.indexOf("<<");
        String last = split < 0 ? f : f.substring(0, split);
        String first = split < 0 ? "" : f.substring(split + 2);
        return new String[] {words(last), words(first)};
    }

    private static String words(String s) {
        var parts = s.replace('<', ' ').trim().split("\\s+");
        var out = new StringBuilder();
        for (String p : parts) {
            if (p.isEmpty() || !p.chars().allMatch(Character::isLetter)) continue;
            if (!out.isEmpty()) out.append(' ');
            out.append(p.charAt(0)).append(p.substring(1).toLowerCase(Locale.ROOT));
        }
        return out.toString();
    }

    private static String clean(String s) {
        return s.replace("<", "");
    }

    private static LocalDate date(String yymmdd, boolean future) {
        if (!yymmdd.matches("\\d{6}")) return null;
        int yy = Integer.parseInt(yymmdd.substring(0, 2)), mm = Integer.parseInt(yymmdd.substring(2, 4)), dd = Integer.parseInt(yymmdd.substring(4, 6));
        int now = LocalDate.now().getYear() % 100;
        int year = future ? 2000 + yy : (yy > now ? 1900 + yy : 2000 + yy);
        try {
            return LocalDate.of(year, mm, dd);
        } catch (Exception e) {
            return null;
        }
    }

    private static String fit(String s, int len) {
        if (s.length() > len) return s.substring(0, len);
        return s + "<".repeat(len - s.length());
    }

    static boolean ok(String field, char check) {
        return Character.isDigit(check) || check == '<' ? digit(field) == (check == '<' ? 0 : check - '0') : false;
    }

    public static int digit(String s) {
        int[] w = {7, 3, 1};
        int sum = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int v = c == '<' ? 0 : Character.isDigit(c) ? c - '0' : Character.isLetter(c) ? c - 'A' + 10 : -1000;
            sum += v * w[i % 3];
        }
        return Math.floorMod(sum, 10);
    }
}
