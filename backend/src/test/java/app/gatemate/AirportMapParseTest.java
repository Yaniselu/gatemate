package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;

import app.gatemate.airport.AirportMapService;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class AirportMapParseTest {
    private static final String SAMPLE = """
        [
          {"type":"way","id":1,"tags":{"aeroway":"terminal","ref":"1"},
           "geometry":[{"lat":44.570,"lon":26.080},{"lat":44.570,"lon":26.090},{"lat":44.575,"lon":26.090},{"lat":44.575,"lon":26.080},{"lat":44.570,"lon":26.080}]},
          {"type":"node","id":2,"lat":44.572,"lon":26.085,"tags":{"amenity":"cafe","name":"Starbucks","opening_hours":"24/7","level":"1"}},
          {"type":"way","id":3,"center":{"lat":44.573,"lon":26.086},"tags":{"amenity":"toilets"}},
          {"type":"node","id":4,"lat":44.574,"lon":26.081,"tags":{"aeroway":"gate","ref":"B12"}},
          {"type":"node","id":5,"lat":44.580,"lon":26.100,"tags":{"amenity":"parking"}},
          {"type":"node","id":6,"lat":44.571,"lon":26.082,"tags":{"shop":"duty_free","name":"Dufry"}},
          {"type":"node","id":2,"lat":44.572,"lon":26.085,"tags":{"amenity":"cafe","name":"Starbucks"}}
        ]""";

    @Test
    void placesFacilitiesInTheirTerminal() throws Exception {
        var features = AirportMapService.parse(JsonMapper.builder().build().readTree(SAMPLE));
        assertThat(features).extracting(AirportMapService.MapFeature::ref).containsExactly("Terminal 1", "Starbucks", "Toilets", "B12", "Dufry");
        var cafe = features.get(1);
        assertThat(cafe.poi()).isEqualTo("coffee");
        assertThat(cafe.terminal()).isEqualTo("Terminal 1");
        assertThat(cafe.hours()).isEqualTo("24/7");
        assertThat(cafe.level()).isEqualTo("1");
        assertThat(features.get(3).kind()).isEqualTo("gate");
        assertThat(features.get(4).poi()).isEqualTo("dutyfree");
        assertThat(features.get(0).outline()).hasSize(1);
    }
}
