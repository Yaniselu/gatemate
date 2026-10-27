# Gatemate ✈️

Your calm co-pilot from curb to gate — boarding alerts, boarding passes, trip chats and an airport guide.

**Stack:** Ionic 8 · Angular 20 (standalone, signals) · Capacitor 8 · Java 21 / Spring Boot 4 backend (`backend/`) · PostgreSQL.

🇷🇴 Ghid pas cu pas (backend, bază de date, telefon): [`docs/RULARE.md`](docs/RULARE.md)

## Run it

```bash
npm install
npm start                 # http://localhost:4200 — runs on mock data, no backend needed
npm run start:api         # against the real backend on :8080 (also reachable from a phone on the same Wi-Fi)
npm run build:preview     # static web preview (hash routing, mock data) in www/
npm run build:prod        # production build against the real API
npx cap sync              # copy the web build into the iOS/Android projects
npx cap open ios          # Xcode (macOS)
npx cap open android      # Android Studio
```

Any email + a password of 8+ characters signs you in while `useMocks` is on.

## Structure

```
src/app/
  core/
    models/          domain types (Trip, Flight, ChatThread…)
    services/        api.ts (backend contract), mock-api.ts, http-api.ts, auth, stores
    security/        secure storage, app lock, validators, sanitising, crypto helpers
    interceptors/    bearer token + refresh + HTTPS enforcement
    guards/          auth / guest / welcome guards
    utils/bcbp.ts    IATA boarding-pass barcode parser
  shared/            glass components, skeletons, motion directives, pipes
  pages/             welcome, auth, tabs (home, trips, chat, airport, profile), detail pages
src/theme/           design tokens, Liquid Glass surfaces, motion library
```

Swap mock ↔ real backend with `useMocks` in `src/environments/*.ts`. The Java API must implement
the endpoints in [`docs/BACKEND_API.md`](docs/BACKEND_API.md).

More: [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/APP_STORE.md`](docs/APP_STORE.md) · [`docs/DESIGN.md`](docs/DESIGN.md)
