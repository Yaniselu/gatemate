import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync('src/app/pages/legal/legal-content.ts', 'utf8');
const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
const { LEGAL_DOCS } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const out = 'backend/src/main/resources/static/legal';
mkdirSync(out, { recursive: true });

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Gatemate</title>
<style>
:root { color-scheme: light dark; --ink: #0b1b2b; --soft: #4b5b6e; --bg: #f6f8fb; --card: #fff; --accent: #0a8796; }
@media (prefers-color-scheme: dark) { :root { --ink: #e9eff7; --soft: #a3b1c2; --bg: #070b14; --card: #111a2b; --accent: #22c7d3; } }
body { margin: 0; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--bg); }
main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
.card { background: var(--card); border-radius: 18px; padding: 24px; }
h1 { margin: 0 0 4px; font-size: 28px; } h2 { margin: 28px 0 8px; font-size: 18px; }
.meta { color: var(--soft); font-size: 14px; margin: 0 0 18px; } a { color: var(--accent); }
nav { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 18px; font-size: 14px; }
</style>
</head>
<body><main>
<nav><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Use</a><a href="guidelines.html">Community Guidelines</a><a href="delete-account.html">Delete your account</a></nav>
<div class="card">
${body}
</div>
</main></body></html>
`;

for (const [key, doc] of Object.entries(LEGAL_DOCS)) {
  const body = [`<h1>${esc(doc.title)}</h1>`, `<p class="meta">Gatemate · Velosyntech · Last updated ${esc(doc.updated)}</p>`, `<p>${esc(doc.intro)}</p>`,
    ...doc.sections.flatMap((s) => [`<h2>${esc(s.heading)}</h2>`, ...s.body.map((p) => `<p>${esc(p)}</p>`)]),
    `<p class="meta">Questions: <a href="mailto:contact@velosyntech.com">contact@velosyntech.com</a></p>`].join('\n');
  writeFileSync(`${out}/${key}.html`, page(doc.title, body));
}

writeFileSync(`${out}/delete-account.html`, page('Delete your Gatemate account', `<h1>Delete your Gatemate account</h1>
<p class="meta">Gatemate · Velosyntech</p>
<h2>From the app (immediate)</h2>
<p>Open Gatemate → Profile → Security &amp; privacy → Delete account, then confirm. Your account is deleted straight away.</p>
<h2>Without the app</h2>
<p>Email <a href="mailto:contact@velosyntech.com?subject=Delete%20my%20Gatemate%20account">contact@velosyntech.com</a> from the address you signed up with and ask us to delete your account. We confirm and delete it within 30 days.</p>
<h2>What is deleted</h2>
<p>Your profile, trips, flights, boarding passes, family members, alerts, chat messages and device tokens. A trip you share with other people stays with them, without you. If you signed in with Apple, we also revoke Gatemate’s access to your Apple ID.</p>
<h2>What we keep</h2>
<p>Nothing that identifies you, except records we are legally required to keep (for example payment records handled by Apple or Google), for the period the law requires.</p>`));
console.log('legal pages written');
