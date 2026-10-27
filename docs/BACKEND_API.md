# Backend API contract (Java / Spring Boot)

Base URL: `https://api.gatemate.app/api/v1` · JSON · `Authorization: Bearer <accessToken>` except `/auth/*`, `/airports/*`, `/destinations/*`.
Implementation: [`backend/`](../backend/README.md) (Spring Boot 4, Java 21). Tests: `cd backend && mvn test`.
Types are defined in `src/app/core/models/index.ts`; the client lives in `src/app/core/services/http-api.ts`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password}` | `Session` |
| POST | `/auth/login` | `{email, password}` | `Session` · 401 · 429 + `Retry-After` |
| POST | `/auth/oauth/{apple\|google}` | `{provider, idToken, nonce, displayName?, authorizationCode?}` | `Session` |
| POST | `/auth/password-reset/confirm` | `{token, password}` | 204 — revokes all sessions |
| POST | `/auth/refresh` | `{refreshToken}` | `Session` (new refresh token) |
| POST | `/auth/logout` | `{refreshToken}` | 204 — revokes all sessions of the user |
| POST | `/auth/password-reset` | `{email}` | 204 always |
| GET | `/me` | — | `User` |
| PATCH | `/me` | `ProfilePatch` (avatar: data URL ≤300 KB) | `User` |
| DELETE | `/me` | — | 204 — revokes Sign in with Apple, deletes all personal data |
| GET | `/me/export` | — | JSON file |
| GET | `/me/stats` | — | `TravelStats` |
| GET | `/trips` | — | `Trip[]` |
| POST | `/flights` | `NewFlightInput` | `Trip` |
| GET | `/flights/{id}/status` | — | `Flight` |
| PATCH | `/trips/{id}/checklist/{itemId}` | `{done}` | 204 |
| POST | `/trips/{id}/expenses` | `{label, amount, currency, paidBy, splitWith}` | `Expense` |
| GET | `/alerts` · POST `/alerts/read` | `{ids}` | `FlightAlert[]` · 204 |
| GET | `/chats` | — | `ChatThread[]` |
| GET/POST | `/chats/{id}/messages` | `{text, clientId}` | `ChatMessage[]` / `ChatMessage` |
| DELETE | `/chats/{id}/membership` | — | 204 |
| POST | `/moderation/reports` | `{messageId, reason}` | 204 |
| POST | `/moderation/blocks` | `{userId}` | 204 |
| GET | `/airports?q=` · `/airports/{code}` | — | airport search / record (5,300+ airports) |
| GET | `/airports/{code}/map` | — | gates, terminals, facilities (OpenStreetMap) |
| GET | `/destinations/{code}?home=EUR` | — | `DestinationInfo` (summary, photo, weather, FX, country facts) |
| POST | `/bookings/lookup` | `{airline, bookingRef, lastName}` | `BookingLookupResult` · 404 same message for wrong ref or name · 429 |
| POST | `/flights/claim` | `{method:'pass', barcode}` or `{method:'booking', airline, bookingRef, lastName, flightIds}` | `Trip` · 403 `name_mismatch` · 409 `already_claimed` · 422 `legal_name_missing` |
| GET | `/me/import-email` | — | `{address}` personal forwarding address |
| POST | `/invites` | `{targetId}` | `{url}` single-use, 7-day link |
| POST | `/invites/{token}/accept` | — | `{type: 'trip'\|'chat', id}` · 410 expired |
| POST | `/push-tokens` | `{token, platform}` | 204 |
| POST | `/chats/lounges` · PATCH `/chats/{id}/membership` | `{muted}` | lounges · 204 |
| GET | `/admin/reports` · POST `/admin/reports/{id}/resolve` | `{action: dismiss\|hide\|ban}` | ROLE_ADMIN |
| POST | `/inbound/email` | mail-provider webhook, `X-Gatemate-Secret` | 202 |
| POST | `/chats` | `{title, emoji, tripId?}` | `ChatThread` |
| POST | `/feedback` | `{topic, message, rating?, contactEmail?}` | 202 |

`Session = { user, accessToken, expiresAt (epoch ms), refreshToken }`.
Errors: `{ code, message }` with proper HTTP status. Real-time chat & alerts: WebSocket/STOMP at `/ws` + APNs/FCM push.

## Ticket ownership rules (server-side, mandatory)
1. Compare the passenger name (ticket/booking) with the account's **legal** first/last name after normalising (diacritics, titles, BCBP 20-char truncation).
2. `booking`: confirm reference + last name with the airline/aggregator (NDC/GDS partner). Never store airline account passwords.
3. `pass`: parse IATA BCBP; when the airline signature block is present, verify it with the airline's published key.
4. Email import: accept only mail sent **from the account's verified email**, with a valid **DKIM** signature from the airline's domain.
5. A (PNR, flight, date, passenger) tuple can be claimed by **one** account; others join via trip invites.
6. Rate-limit lookups (5 / 10 min per account and per IP) — booking references are guessable.
