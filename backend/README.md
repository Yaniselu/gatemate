# Gatemate API

Spring Boot 4 · Java 21 · PostgreSQL · Flyway.

```bash
# Dev (in-memory H2, sandbox bookings, ephemeral keys)
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Tests
mvn test

# Production-like
cp .env.example .env   # fill in secrets
docker compose up --build
```

Point the app at it with `apiUrl` in `src/environments/environment.prod.ts` and `useMocks: false`.

## What makes it store-safe

| Requirement | Where |
|---|---|
| Sign in with Apple offered next to Google (App Store 4.8) | `auth/AuthController` `/auth/oauth/apple` |
| In-app account deletion + Apple token revocation (5.1.1(v), Play account deletion policy) | `DELETE /me` → `MeService.delete` |
| Data export (GDPR) | `GET /me/export` |
| UGC: report, block, filter, admin queue, auto-hide (App Store 1.2, Play UGC policy) | `chat/*`, `admin/AdminController` |
| No fake data: bookings only from real providers; missing providers return `501` | `booking/ClaimService` |
| Ticket ownership: legal-name match + one account per ticket (`claim_key`) | `booking/ClaimService` |
| Secrets only from the environment | `application.yml`, `.env.example` |

## Security

- RS256 access tokens (15 min), opaque rotating refresh tokens (hashed, family revocation on reuse).
- Argon2id passwords, progressive lockout, constant-time login, per-IP rate limits (`RateLimitFilter`).
- Apple/Google ID tokens verified against JWKS with issuer, audience, expiry and nonce.
- Every trip/chat query checks membership; non-members get `404`, not `403`.
- WebSocket: JWT on STOMP CONNECT, members-only SUBSCRIBE, client SEND disabled.
- Third-party tokens encrypted at rest (AES-256-GCM).
- Security headers, strict CORS, no error details or stack traces in responses.

## Integrations (all optional, keys via env)

| Feature | Provider | Without a key |
|---|---|---|
| Airline booking import | Airline/NDC aggregator (implement `BookingProvider`) | `501`, app suggests scanning the boarding pass |
| Live gate/delay | AeroDataBox | No status updates (no invented data) |
| City photos | Unsplash (with credit) | Wikipedia/Wikimedia photo |
| Weather / FX / city summary / airport map | Open-Meteo, ECB (Frankfurter), Wikipedia, OpenStreetMap | — |
| Push | APNs / FCM (`PushService`) | Alerts stored in-app; device reminders still work |
| E-mail | Any SMTP/API (`MailService`) | Logged only |
