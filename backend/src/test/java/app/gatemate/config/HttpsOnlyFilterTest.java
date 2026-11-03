package app.gatemate.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class HttpsOnlyFilterTest {
    private final HttpsOnlyFilter filter = new HttpsOnlyFilter();

    @Test
    void redirectsPlainHttpGets() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/v1/airports");
        req.addHeader("X-Forwarded-Proto", "http");
        req.addHeader("Host", "api.example.com");
        req.setQueryString("q=otp");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        filter.doFilter(req, res, chain);
        assertEquals(301, res.getStatus());
        assertEquals("https://api.example.com/api/v1/airports?q=otp", res.getHeader("Location"));
        assertNull(chain.getRequest());
    }

    @Test
    void refusesPlainHttpWrites() throws Exception {
        var req = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        req.addHeader("X-Forwarded-Proto", "http");
        req.addHeader("Host", "api.example.com");
        var res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        assertEquals(426, res.getStatus());
    }

    @Test
    void rejectsForgedHost() throws Exception {
        var req = new MockHttpServletRequest("GET", "/");
        req.addHeader("X-Forwarded-Proto", "http");
        req.addHeader("Host", "evil.com/@x");
        var res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        assertEquals(400, res.getStatus());
    }

    @Test
    void passesHttps() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/v1/airports");
        req.addHeader("X-Forwarded-Proto", "https");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        filter.doFilter(req, res, chain);
        assertSame(req, chain.getRequest());
    }
}
