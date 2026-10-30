# Gatemate vs. the best app for each job (October 2026)

For every Gatemate feature: the strongest competitor, what they do well, where Gatemate is ahead, and the honest
gaps with what would close them. Prices and features of other apps come from public reviews and app-store data
gathered in October 2026; check them again before quoting them on stage.

**The one-line pitch:** every other app does one of these jobs. Gatemate does all of them in one place, offline,
in six languages, with an AI agent that acts on your real trip, and it's free where the others charge.

| # | Feature | Best competitor | Their edge | Gatemate's edge | Gap to close next |
|---|---------|-----------------|------------|-----------------|-------------------|
| 1 | Live flight tracking & alerts | **Flighty** (iOS, ~$60/yr) | Delay prediction from the inbound aircraft, hours before the airline; polished Live Activities | Live ADS-B, gate/boarding alerts in your language, lock-screen Live Activity + Apple Watch, Android too, free | Inbound-aircraft delay prediction (needs a schedule/registration feed) |
| 2 | Trip organiser | **TripIt** (Pro ~$49/yr) | Forward an e-mail, itinerary appears | E-mail forward + paste parser, verified tickets in your name, group trips with chat, checklist, expenses | Hotel and train bookings in the same timeline |
| 3 | Boarding pass | **Apple Wallet** / airline apps | Built into the phone | Encrypted offline pass with seat map, countdown and boarding timeline in one screen | "Add to Apple Wallet" export |
| 4 | Airport maps | **Apple / Google Maps indoor** | Big hubs mapped officially | 5,300+ airports drawn from OpenStreetMap, offline, floor switcher, gate distance, hand-drawn plans (Craiova) | More hand-checked plans for regional airports |
| 5 | AI travel agent | **Mindtrip**, **Layla** | Visual planning, in-chat booking | Velo knows *your* trips, flights and checklist, and acts on them (adds items, checks rights, guides), in six languages | Booking hotels/flights from chat |
| 6 | Passenger rights (EU261) | **AirHelp** (35 % fee, more in court), **Flightright** (~25–30 % + legal fees) | They chase the airline for you | **Free**: checks eligibility and writes the full claim letter (Sturgeon/Nelson case law), copy/share/e-mail, next steps and enforcement body; you keep 100 % | Track the claim and remind you when to escalate |
| 7 | Group trips & expenses | **Splitwise**, **Wanderlog** | Mature expense splitting, shared itineraries | Trip chat, invites, shared checklist and expenses next to the flights | Settle-up with payment links |
| 8 | Travel passport & stats | **Flighty Passport**, **Polarsteps** | Beautiful year-in-review | Map of flights, countries, shareable card, achievements | Animated year-in-review video |
| 9 | Seat map | **aeroLOPA** (web) | Exact airline-specific cabin layouts | Seat map on the pass with your seat lit up, side, wing, exit-row distance | Airline-specific layouts |
| 10 | Airport rules / "Can I bring?" | **MyTSA** (US only) | Official TSA answers | 74 rules in 12 categories for EU + world, accent-free search, offline, six languages, Velo for edge cases | Country-specific customs limits outside the EU |
| 11 | Getting from the airport | **Rome2Rio**, **Citymapper**, Uber/Bolt | Real transit routing and live prices | One card: ride vs transit vs rental for *your* accommodation, split per person, night arrivals, deep links, rental documents to checklist | Live transit times from a routing API |
| 12 | In-flight | Airline IFE, offline games apps | Movies | 7 offline games, breathing and seat stretches, cabin-air estimate (pressure, humidity) — nobody else shows this | Downloadable reading/podcasts |
| 13 | Trip film / visual | **Flighty** map animation | Elegant 2D route animation | Full 3D film: taxi, take-off, real great-circle route over the globe, landing | Replay a real past flight from ADS-B history |

## What was built because of this analysis

- **Free EU261 claim letter** (Rights page): eligibility check from the route distance and the delay or
  cancellation, the amount, and a ready-to-send claim citing Article 7 and the Sturgeon and Nelson judgments, with
  copy, share and e-mail buttons and the escalation steps. Directly undercuts AirHelp's 35 % and Flightright's
  25–30 %.

## Highest-value next steps

1. **Inbound-aircraft delay warning** (beats Flighty's signature feature): needs an aircraft-registration or
   schedule feed (e.g. AeroDataBox, already wired as an optional key on the server).
2. **Add to Apple Wallet / Google Wallet** for the boarding pass.
3. **Claim tracker**: remember when the claim was sent and nudge at 6 weeks to escalate.
4. **Hotels and trains** in the trip timeline (the TripIt gap).
