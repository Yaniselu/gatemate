package app.gatemate.common;

import java.text.Normalizer;
import java.util.List;
import java.util.regex.Pattern;

public final class Text {
    private static final Pattern CONTROL = Pattern.compile("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u202A-\\u202E\\u2066-\\u2069]");
    private static final List<String> BLOCKED = List.of("fuck", "shit", "bitch", "cunt", "nigger", "faggot", "retard", "whore");
    private static final Pattern BLOCKED_RE = Pattern.compile("\\b(" + String.join("|", BLOCKED) + ")\\w*", Pattern.CASE_INSENSITIVE);

    private Text() {}

    public static String clean(String in, int max) {
        if (in == null) return "";
        String s = CONTROL.matcher(in).replaceAll("").replaceAll("\\n{3,}", "\n\n").strip();
        return s.length() > max ? s.substring(0, max) : s;
    }

    public record Masked(String text, boolean flagged) {}

    public static Masked maskProfanity(String text) {
        var m = BLOCKED_RE.matcher(text);
        var sb = new StringBuilder();
        boolean flagged = false;
        while (m.find()) {
            flagged = true;
            String w = m.group();
            m.appendReplacement(sb, w.charAt(0) + "•".repeat(w.length() - 1));
        }
        m.appendTail(sb);
        return new Masked(sb.toString(), flagged);
    }

    public static String fold(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
