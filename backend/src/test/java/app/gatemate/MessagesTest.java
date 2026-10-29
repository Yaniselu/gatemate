package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;

import app.gatemate.common.Messages;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class MessagesTest {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\w+}");

    @Test
    void everyLanguageHasEveryTextWithTheSamePlaceholders() {
        for (String lang : Messages.LANGUAGES) {
            assertThat(Messages.keys(lang)).as(lang).isEqualTo(Messages.keys("en"));
            for (String key : Messages.keys("en")) {
                assertThat(placeholders(Messages.get(lang, key))).as(lang + " " + key).isEqualTo(placeholders(Messages.get("en", key)));
            }
        }
    }

    @Test
    void fillsValuesAndFallsBackToEnglish() {
        assertThat(Messages.get("ro", "gate.assigned", "gate", "B12")).isEqualTo("Poarta B12 a fost alocată");
        assertThat(Messages.get("xx", "gate.assigned", "gate", "B12")).isEqualTo("Gate B12 assigned");
        assertThat(Messages.lang(null)).isEqualTo("en");
    }

    private static java.util.Set<String> placeholders(String s) {
        return PLACEHOLDER.matcher(s).results().map(r -> r.group()).collect(Collectors.toSet());
    }
}
