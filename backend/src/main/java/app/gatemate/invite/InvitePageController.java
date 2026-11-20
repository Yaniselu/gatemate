package app.gatemate.invite;

import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InvitePageController {
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{16,64}");
    static final String APP_STORE = "https://apps.apple.com/app/id6836782223";

    @GetMapping(value = "/invite/{token}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> page(@PathVariable String token) {
        if (!TOKEN.matcher(token).matches()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Not found");
        String deep = "gatemate://invite/" + token;
        String html = """
            <!doctype html>
            <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>You're invited · Gatemate</title>
            <style>
            :root { color-scheme: light dark; --ink: #0b1b2b; --soft: #4b5b6e; --bg: #f6f8fb; --card: #fff; --accent: #0a8796; }
            @media (prefers-color-scheme: dark) { :root { --ink: #e9eff7; --soft: #a3b1c2; --bg: #070b14; --card: #111a2b; --accent: #22c7d3; } }
            body { margin: 0; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--bg); }
            main { max-width: 440px; margin: 0 auto; padding: 48px 20px; text-align: center; }
            .card { background: var(--card); border-radius: 22px; padding: 28px 22px; }
            h1 { font-size: 24px; margin: 0 0 8px; } p { color: var(--soft); margin: 0 0 22px; }
            a.btn { display: block; padding: 15px; border-radius: 14px; font-weight: 700; text-decoration: none; margin-top: 12px; }
            a.primary { background: var(--accent); color: #fff; } a.ghost { color: var(--accent); border: 1.5px solid var(--accent); }
            small { display: block; margin-top: 22px; color: var(--soft); }
            </style></head>
            <body><main><div class="card">
            <h1>You're invited to a trip on Gatemate</h1>
            <p>Open the invitation in the Gatemate app to join the trip and its group chat.</p>
            <a class="btn primary" href="%s">Open in Gatemate</a>
            <a class="btn ghost" href="%s">Get Gatemate on the App Store</a>
            <small>Already installed the app? Tap “Open in Gatemate” again after signing in.</small>
            </div></main></body></html>
            """.formatted(deep, APP_STORE);
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(html);
    }
}
