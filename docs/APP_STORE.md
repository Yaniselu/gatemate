# App Store & Google Play readiness

## Already handled in the app
- **Sign in with Apple** offered alongside Google, shown first (Guideline 4.8).
- **Account deletion inside the app** — Profile → Delete account (5.1.1(v)).
- **User-generated content** (1.2): Terms/EULA acceptance at sign-up, Community Guidelines, report message, block user, profanity filter, moderated public lounges, 16+ age confirmation.
- **Privacy**: Privacy Policy in-app, data export, purpose strings for camera and Face ID, `PrivacyInfo.xcprivacy`, no tracking (no ATT prompt needed).
- **Not a web wrapper** (4.2): native camera scanning, biometrics, local notifications, haptics, privacy screen.
- **No airline/airport logos or claims of affiliation**; Terms state Gatemate is independent and passes are convenience copies.
- **Passenger-rights screen** clearly marked as information, not legal advice.
- `ITSAppUsesNonExemptEncryption = false` (only standard HTTPS).

- **Ratings** (Apple 5.6.1 / Google Play in-app review policy): only the native review sheet (`SKStoreReviewController` / Play In-App Review), triggered after positive moments with a 120-day cooldown. No custom "Do you like the app?" gate before it — both stores forbid that. Feedback is a separate screen that never redirects to the store.
- **Permissions with purpose strings**: camera (scan pass), photo library (avatar, pass screenshot), location *when in use* (airport map), Face ID, notifications. Android: CAMERA, ACCESS_COARSE/FINE_LOCATION, POST_NOTIFICATIONS, USE_BIOMETRIC.
- **WhatsApp invites** use the public `https://wa.me/?text=` share link — no WhatsApp SDK or special permission needed.
- **Airline names** appear only as text to identify the user's own booking (nominative use); no airline logos.

## To do before submission
1. Apple Developer Program account (99 USD/yr) and Google Play Console (25 USD once).
2. Xcode: enable capabilities **Sign in with Apple**, **Push Notifications**; add `PrivacyInfo.xcprivacy` to the App target; add the Google reversed-client-ID URL scheme.
3. Fill real client IDs in `src/environments/environment.prod.ts`.
4. Host Privacy Policy, Terms and a support page on `gatemate.app` (URLs are required in App Store Connect) — have a lawyer review the templates in `src/app/pages/legal/legal-content.ts`.
5. Booking import needs an airline/NDC aggregator agreement; email import needs the `in.gatemate.app` inbound mail domain with DKIM checks.
6. Indoor airport maps: licensed provider (IMDF / Mapbox indoor / Mappedin) per airport.
7. Licensed flight-data provider (e.g. Cirium, FlightAware AeroAPI, AviationStack) — never scrape airline sites.
8. App Privacy questionnaire: Name, Email, Phone, Photos, User ID, User Content, Customer Support — linked to user, not used for tracking.
9. Age rating questionnaire: unrestricted user-generated content → expect 12+/17+ depending on answers.
10. App icon 1024×1024, screenshots 6.9" & 6.5", review notes with a demo account.
11. Check the trademark "Gatemate" (EUIPO / USPTO / OSIM) and register the domain.
