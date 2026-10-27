# Security

## Implemented in the app

| Area | Measure |
|---|---|
| Token storage | Refresh token in iOS Keychain / Android Keystore (`whenUnlockedThisDeviceOnly`, no iCloud sync). Access token **memory only**. Web build never persists real tokens. |
| Sessions | 15-min access tokens, single-flight refresh, rotation on every refresh, forced sign-out on refresh failure. |
| Transport | Interceptor blocks `http://` in production; bearer token attached **only** to allow-listed API origins. Android: cleartext disabled, system CAs only, pinning template in `network_security_config.xml`. iOS: ATS on, App-Bound Domains. |
| Social login | Apple & Google ID tokens with a per-request cryptographic nonce (Web Crypto). Backend verifies signature, `iss`, `aud`, `exp`, nonce. |
| Brute force | Client back-off after 3 failed logins (15 s → 5 min) + honours server `429 Retry-After`. |
| Passwords | ≥ 10 chars, upper/lower/digit/symbol, common-password list, must not contain email name. |
| Account enumeration | Password reset answers identically whether or not the account exists. |
| App lock | Optional Face ID / Touch ID / fingerprint; relocks after 30 s in background or N min idle. Biometric confirmation before deleting the account. |
| Screen privacy | Privacy screen in the app switcher (`@capacitor/privacy-screen`). |
| XSS | Angular auto-escaping, no `innerHTML`/`bypassSecurityTrust*`, Ionic `innerHTMLTemplatesEnabled: false`, strict CSP in production (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`). |
| User content | Control/bidi-override characters stripped, 1 000-char cap, profanity masking, payment-card detection warning, link warning in public lounges, local send rate-limit, report & block. |
| Input validation | IATA/flight/seat/PNR patterns, boarding-pass barcode parsed and validated on-device. |
| Data at rest (Android) | `allowBackup=false`, data-extraction rules exclude everything from cloud backup / device transfer. |
| Ticket ownership | Tickets are only added after the passenger name matches the account's legal name (diacritics/titles normalised); one booking can belong to one account; booking lookup rate-limited; generic "not found" message (no enumeration). |
| Profile photos | Re-encoded on device (320 px WebP) which strips EXIF/GPS metadata before upload. |
| Location | "When in use" only, coarse check that you are at the airport; never stored. |
| Invites | Single-use, expiring links; joining requires sign-in. |
| Release builds | No source maps, Capacitor logging off, WebView debugging off. |

## Required on the Java backend (next phase)
- Argon2id password hashing; rate limiting per IP + account; lockout alerts.
- JWT access tokens (RS256/EdDSA, 15 min) + opaque, rotating, revocable refresh tokens with reuse detection.
- Verify Apple/Google ID tokens against their JWKS; check nonce; link accounts by verified email only.
- Authorisation on every endpoint (trip membership, chat membership) — never trust IDs from the client.
- Server-side validation & moderation of chat (the client filter is UX only); audit log for reports.
- App Attest (iOS) / Play Integrity (Android) on sensitive endpoints.
- TLS 1.2+, HSTS, security headers, OWASP ASVS L2 / MASVS checks, dependency scanning.
- GDPR: data export, deletion within 30 days, EU data residency, DPA with processors.
