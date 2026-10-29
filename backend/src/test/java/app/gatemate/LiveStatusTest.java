package app.gatemate;

import static org.assertj.core.api.Assertions.assertThat;

import app.gatemate.airport.AirlineCatalog;
import app.gatemate.trip.AdsbService;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LiveStatusTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void flightNumbersBecomeRadioCallsigns() throws Exception {
        var adsb = new AdsbService(new AirlineCatalog(json), json);
        assertThat(adsb.callsigns("W6 3121")).containsExactly("WZZ3121");
        assertThat(adsb.callsigns("RO 0391")).containsExactly("ROT391");
        assertThat(adsb.callsigns("DY 1302")).containsExactly("NOZ1302", "NAX1302");
        assertThat(adsb.callsigns("ZZ 12")).isEmpty();
        assertThat(adsb.callsigns("nonsense")).isEmpty();
    }
}
