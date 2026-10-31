package app.gatemate.destination;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class WeatherCodeTest {

    @Test
    void mapsMetNoSymbolsToWmoCodes() {
        assertEquals(0, DestinationService.wmo("clearsky_day"));
        assertEquals(1, DestinationService.wmo("fair_night"));
        assertEquals(2, DestinationService.wmo("partlycloudy_polartwilight"));
        assertEquals(3, DestinationService.wmo("cloudy"));
        assertEquals(45, DestinationService.wmo("fog"));
        assertEquals(51, DestinationService.wmo("lightrain"));
        assertEquals(61, DestinationService.wmo("rain"));
        assertEquals(65, DestinationService.wmo("heavyrain"));
        assertEquals(80, DestinationService.wmo("rainshowers_day"));
        assertEquals(71, DestinationService.wmo("snow"));
        assertEquals(85, DestinationService.wmo("lightsnowshowers_night"));
        assertEquals(95, DestinationService.wmo("heavyrainandthunder"));
    }
}
