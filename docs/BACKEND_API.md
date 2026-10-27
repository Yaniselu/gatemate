# Backend API contract (Java / Spring Boot)

Base URL: `https://api.gatemate.app/api/v1` · JSON · `Authorization: Bearer <accessToken>` except `/auth/*`.
Types are defined in `src/app/core/models/index.ts`; the client lives in `src/app/core/services/http-api.ts`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password}` | `Session` |
| POST | `/auth/login` | `{email, password}` | `Session` · 401 · 429 + `Retry-After` |
| POST | `/auth/oauth/{apple\|google}` | `{provider, idToken, nonce, displayName?}` | `Session` |
| POST | `/auth/refresh` | `{refreshToken}` | `Session` (new refresh token) |
| POST | `/auth/logout` | `{refreshToken}` | 204 — revokes all sessions of the user |
| POST | `/auth/password-reset` | `{email}` | 204 always |
| PATCH | `/me` | `{name?, homeAirport?}` | `User` |
| DELETE | `/me` | — | 204 |
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
| GET | `/airports/{code}` | — | `AirportInfo` |

`Session = { user, accessToken, expiresAt (epoch ms), refreshToken }`.
Errors: `{ code, message }` with proper HTTP status. Real-time chat & alerts: WebSocket/STOMP at `/ws` + APNs/FCM push.
