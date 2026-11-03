package app.gatemate.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class HttpsOnlyFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String proto = req.getHeader("X-Forwarded-Proto");
        if (proto != null && proto.equalsIgnoreCase("http")) {
            String host = req.getHeader("Host");
            if (host == null || !host.matches("[A-Za-z0-9.-]+(:\\d+)?")) {
                res.sendError(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }
            if ("GET".equals(req.getMethod()) || "HEAD".equals(req.getMethod())) {
                String q = req.getQueryString();
                res.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
                res.setHeader("Location", "https://" + host + req.getRequestURI() + (q == null ? "" : "?" + q));
            } else {
                res.sendError(426, "HTTPS required");
            }
            return;
        }
        chain.doFilter(req, res);
    }
}
