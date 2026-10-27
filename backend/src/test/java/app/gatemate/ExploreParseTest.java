package app.gatemate;

import static org.junit.jupiter.api.Assertions.*;

import app.gatemate.destination.ExploreService;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ExploreParseTest {
    @Test
    @SuppressWarnings("unchecked")
    void parsesSparqlBindingsSkippingUnlabelledAndDuplicates() throws Exception {
        String json = """
                {"results":{"bindings":[
                  {"item":{"value":"http://www.wikidata.org/entity/Q48435"},"itemLabel":{"value":"Sagrada Família"},"desc":{"value":"basilica in Barcelona"},
                   "img":{"value":"http://commons.wikimedia.org/wiki/Special:FilePath/SF.jpg"},"loc":{"value":"Point(2.174 41.4036)"},"dist":{"value":"2.13"}},
                  {"item":{"value":"http://www.wikidata.org/entity/Q48435"},"itemLabel":{"value":"Sagrada Família"},"loc":{"value":"Point(2.174 41.4036)"},"dist":{"value":"2.1"}},
                  {"item":{"value":"http://www.wikidata.org/entity/Q999"},"itemLabel":{"value":"Q999"},"loc":{"value":"Point(2 41)"},"dist":{"value":"1"}}
                ]}}""";
        Method parse = ExploreService.class.getDeclaredMethod("parse", tools.jackson.databind.JsonNode.class);
        parse.setAccessible(true);
        var list = (List<ExploreService.Sight>) parse.invoke(null, JsonMapper.builder().build().readTree(json));
        assertEquals(1, list.size());
        var s = list.get(0);
        assertEquals("Q48435", s.id());
        assertEquals(41.4036, s.lat(), 1e-6);
        assertEquals(2.174, s.lon(), 1e-6);
        assertEquals(2.1, s.distanceKm(), 1e-6);
        assertTrue(s.image().startsWith("https://commons.wikimedia.org/") && s.image().endsWith("?width=480"));
    }

    @Test
    void fxRejectsUnsupportedCurrencies() {
        assertFalse(ExploreService.FX.contains("XXX"));
        assertTrue(ExploreService.FX.contains("RON"));
    }
}
