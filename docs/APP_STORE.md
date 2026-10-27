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

## To do before submission
1. Apple Developer Program account (99 USD/yr) and Google Play Console (25 USD once).
2. Xcode: enable capabilities **Sign in with Apple**, **Push Notifications**; add `PrivacyInfo.xcprivacy` to the App target; add the Google reversed-client-ID URL scheme.
3. Fill real client IDs in `src/environments/environment.prod.ts`.
4. Host Privacy Policy, Terms and a support page on `gatemate.app` (URLs are required in App Store Connect) — have a lawyer review the templates in `src/app/pages/legal/legal-content.ts`.
5. Licensed flight-data provider (e.g. Cirium, FlightAware AeroAPI, AviationStack) — never scrape airline sites.
6. App Privacy questionnaire: Name, Email, User ID, User Content — linked to user, not used for tracking.
7. Age rating questionnaire: unrestricted user-generated content → expect 12+/17+ depending on answers.
8. App icon 1024×1024, screenshots 6.9" & 6.5", review notes with a demo account.
9. Check the trademark "Gatemate" (EUIPO / USPTO / OSIM) and register the domain.
