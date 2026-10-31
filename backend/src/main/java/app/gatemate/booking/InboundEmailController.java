package app.gatemate.booking;

import app.gatemate.common.ApiException;
import app.gatemate.common.Crypto;
import app.gatemate.config.GatemateProperties;
import app.gatemate.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1/inbound/email")
public class InboundEmailController {
    private static final Logger log = LoggerFactory.getLogger(InboundEmailController.class);
    private static final Pattern TOKEN = Pattern.compile("\\+([a-z0-9]{6,32})@", Pattern.CASE_INSENSITIVE);

    private final GatemateProperties props;
    private final UserRepository users;
    private final EmailImportService imports;

    public InboundEmailController(GatemateProperties props, UserRepository users, EmailImportService imports) {
        this.props = props;
        this.users = users;
        this.imports = imports;
    }

    record Mail(List<String> recipients, String from, boolean senderAuthenticated, String html, String text) {}

    @PostMapping
    public ResponseEntity<Void> receive(@RequestHeader(name = "X-Gatemate-Secret", required = false) String secret,
            @RequestHeader(name = "Authorization", required = false) String authorization, @RequestBody JsonNode body) {
        String expected = props.booking().inboundSecret();
        String given = secret != null ? secret : basicPassword(authorization);
        if (expected == null || expected.isBlank() || given == null || !Crypto.constantTimeEquals(expected, given)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Bad signature.");
        }
        try {
            importMail(normalise(body));
        } catch (Exception e) {
            log.info("inbound mail not imported: {}", e.getMessage());
        }
        return ResponseEntity.accepted().build();
    }

    void importMail(Mail m) {
        String token = null;
        for (String r : m.recipients()) {
            Matcher t = TOKEN.matcher(r);
            if (t.find()) {
                token = t.group(1).toLowerCase(Locale.ROOT);
                break;
            }
        }
        if (token == null) throw new IllegalArgumentException("no import token in recipients");
        var user = users.findByImportToken(token).orElseThrow(() -> new IllegalArgumentException("unknown token"));
        if (user.email == null || !user.email.equalsIgnoreCase(address(m.from()))) throw new IllegalArgumentException("not forwarded from the account's e-mail");
        if (!m.senderAuthenticated()) throw new IllegalArgumentException("sender failed SPF/DKIM");
        imports.importInto(user, m.html(), m.text(), "Forwarded from your account e-mail (" + address(m.from()) + ")");
        log.info("inbound mail imported for user {}", user.id);
    }

    static Mail normalise(JsonNode b) {
        var to = new ArrayList<String>();
        if (b.has("FromFull") || b.has("HtmlBody") || b.has("TextBody")) {
            for (String f : List.of("ToFull", "CcFull", "BccFull")) for (JsonNode r : b.path(f)) to.add(r.path("Email").asString(""));
            to.add(b.path("OriginalRecipient").asString(""));
            String from = b.path("FromFull").path("Email").asString(b.path("From").asString(""));
            boolean auth = false;
            for (JsonNode h : b.path("Headers")) {
                String name = h.path("Name").asString("").toLowerCase(Locale.ROOT), value = h.path("Value").asString("").toLowerCase(Locale.ROOT);
                if (name.equals("received-spf") && value.startsWith("pass")) auth = true;
                if (name.equals("authentication-results") && authPass(value, from)) auth = true;
            }
            return new Mail(to, from, auth, b.path("HtmlBody").asString(null), b.path("TextBody").asString(null));
        }
        if (b.has("envelope")) {
            JsonNode env = b.path("envelope");
            to.add(env.path("to").asString(""));
            for (JsonNode r : env.path("recipients")) to.add(r.asString(""));
            to.add(b.path("headers").path("to").asString(""));
            String from = b.path("headers").path("from").asString(env.path("from").asString(""));
            boolean spf = env.path("spf").path("result").asString("").equalsIgnoreCase("pass")
                    && address(from).endsWith("@" + env.path("spf").path("domain").asString("~").toLowerCase(Locale.ROOT));
            boolean dkim = authPass(b.path("headers").path("authentication_results").asString("").toLowerCase(Locale.ROOT), from);
            return new Mail(to, from, spf || dkim, b.path("html").asString(null), b.path("plain").asString(null));
        }
        to.add(b.path("to").asString(""));
        return new Mail(to, b.path("from").asString(""), b.path("dkimPass").asBoolean(false), b.path("html").asString(null), b.path("text").asString(null));
    }

    static boolean authPass(String results, String from) {
        String a = address(from);
        String domain = a.contains("@") ? a.substring(a.indexOf('@') + 1) : "";
        if (domain.isEmpty()) return false;
        Matcher d = Pattern.compile("dkim=pass[^;]*header\\.(?:d|i)=@?([a-z0-9.-]+)").matcher(results);
        while (d.find()) if (domain.equals(d.group(1)) || domain.endsWith("." + d.group(1))) return true;
        Matcher s = Pattern.compile("spf=pass[^;]*smtp\\.mailfrom=(?:[^@;\\s]*@)?([a-z0-9.-]+)").matcher(results);
        while (s.find()) if (domain.equals(s.group(1))) return true;
        return false;
    }

    private static String basicPassword(String authorization) {
        if (authorization == null || !authorization.regionMatches(true, 0, "Basic ", 0, 6)) return null;
        try {
            String decoded = new String(Base64.getDecoder().decode(authorization.substring(6).trim()), StandardCharsets.UTF_8);
            int colon = decoded.indexOf(':');
            return colon < 0 ? null : decoded.substring(colon + 1);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    static String address(String header) {
        if (header == null) return "";
        int lt = header.indexOf('<'), gt = header.indexOf('>');
        return (lt >= 0 && gt > lt ? header.substring(lt + 1, gt) : header).trim().toLowerCase(Locale.ROOT);
    }
}
