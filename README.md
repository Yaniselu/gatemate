<p align="center">
  <img src="public/icon-512.png" alt="Gatemate" width="96">
</p>

<h1 align="center">Gatemate</h1>

<p align="center"><b>Însoțitorul tău de la check-in până la destinație.</b><br>
Bilete de îmbarcare, zboruri live, hărți de aeroport, familie, drepturi de pasager și Velo, asistentul AI, într-o singură aplicație.</p>

<p align="center">
  Hackathon Craiova 2.0 · <i>Future flight, airport and in-flight experience</i> · echipa Velosyntech
</p>

---

> **For English readers:** Gatemate is a mobile travel companion (Ionic Angular + Capacitor, Spring Boot backend). The fastest way to try it is `npm install && npm start` and opening http://localhost:4200. It runs on built-in demo data, so no server or API keys are needed. Sign in with `alex.morgan@example.com` / `Sky-High2026!`.

## Cuprins

1. [Încearcă aplicația în 2 minute](#1-încearcă-aplicația-în-2-minute)
2. [Ce face Gatemate](#2-ce-face-gatemate)
3. [Rularea cu serverul real](#3-rularea-cu-serverul-real)
4. [Pe iPhone și Android](#4-pe-iphone-și-android)
5. [Backend-ul](#5-backend-ul)
6. [Arhitectura](#6-arhitectura)
7. [Structura repo-ului](#7-structura-repo-ului)
8. [Securitate](#8-securitate)
9. [Teste](#9-teste)
10. [Documentație](#10-documentație)

---

## 1. Încearcă aplicația în 2 minute

Ai nevoie doar de **Node.js 22** (sau 20+) și npm.

```bash
git clone https://github.com/Yaniselu/gatemate.git
cd gatemate
npm install
npm start
```

Deschide **http://localhost:4200**, ideal cu vizualizarea de telefon din DevTools (F12 → iconița de telefon), fiindcă aplicația e gândită pentru mobil.

**Cont demo:**

| E-mail | Parolă |
|---|---|
| `alex.morgan@example.com` | `Sky-High2026!` |

În acest mod (`useMocks: true` în `src/environments/environment.ts`), aplicația folosește date demo locale. Nu are nevoie de server, de bază de date sau de chei API. Merge și orice alt e-mail cu o parolă de minimum 8 caractere. Contul demo are deja călătorii, bilete, familie, chat-uri și abonament Pro, ca să poți vedea toate funcțiile.

**Ce să încerci primul:**

1. **Acasă** → cardul cu următorul zbor, cu numărătoarea inversă și starea zborului.
2. **Călătorii** → deschide un zbor → atinge biletul ca să se întoarcă și să arate codul QR.
3. **Adaugă zbor** → scanează sau lipește un bilet de îmbarcare, ori adaugă biletul unui membru al familiei.
4. **Aeroport** → harta interactivă cu porți, magazine, toalete și etaje (de exemplu CRA, OTP sau orice aeroport din lume).
5. **Velo** (iconița ✦) → întreabă „Ce pot vizita în Barcelona?” sau „Fă-mi un plan de călătorie”.
6. **Căutare** (lupa de pe Acasă) → găsește orice funcție, regulă de aeroport sau oraș.

---

## 2. Ce face Gatemate

| Zonă | Ce primești |
|---|---|
| **Bilete** | Import din codul de bare al biletului (standard IATA BCBP), din rezervare, din e-mail sau manual. Biletul e disponibil offline, cu cod QR real. Data zborului e dedusă corect. |
| **Familie și prieteni** | Toate biletele într-un singur loc, chiar dacă copiii nu au aplicația. Fiecare bilet e potrivit cu numele de pe el, iar ecranul „Al cui e biletul?” evită confuziile între membrii familiei cu același nume. |
| **Zbor live** | Întârzierile actualizează automat orele de decolare și aterizare. Primești alerte la schimbarea porții și notificări cu 20, 10 și 5 minute înainte de îmbarcare. |
| **Avionul** | Modelul avionului (din datele ADS-B sau după companie) și schema de locuri potrivită modelului. |
| **Live Activity** | Pe ecranul de blocare, în Dynamic Island și pe Apple Watch. Pornește cu 2,5 zile înainte de zbor și se poate dezactiva. |
| **Hărți de aeroport** | Pentru orice aeroport din lume, din date OpenStreetMap, cu etaje, porți și puncte de interes. Hărțile sunt păstrate în cache pe server, ca să se încarce repede. |
| **Velo AI** | Asistentul aplicației, bazat pe Gemini. Știe de zborurile tale, îți spune ce poți vizita și îți face un plan de călătorie. |
| **Călătorii de grup** | Invitații prin link sau pe e-mail, chat pe călătorie și „lounge” pentru pasagerii de pe același zbor. Poți șterge un chat glisând. |
| **Lost & Found** | Pași clari pentru bagaj pierdut, întârziat sau deteriorat, plus termenele legale și scrisoarea de reclamație generată automat. |
| **Drepturi de pasager** | Calculator de despăgubiri EU261 și scrisoare de reclamație. |
| **Reguli de aeroport** | Lichide, power bank-uri, medicamente, documente. Toate pot fi căutate. |
| **Instrumente** | Convertor valutar live, fus orar și jet lag, dimensiunile bagajului de cabină pe companii, distanța dintre aeroporturi. |
| **Profil** | Pașaportul de călător cu statistici, harta lumii cu țările vizitate, realizări și jocuri offline pentru zbor. |
| **Identitate** | Verificarea numelui real cu pașaportul (scanarea MRZ se face pe telefon). Este opțională, aplicația merge și fără. |
| **Pro** | Planul gratuit include până la 5 bilete. Pro aduce bilete nelimitate și funcții în plus. |
| **Pentru oricine** | 10+ limbi (limba se alege automat după țară la înregistrare), mod luminos și întunecat, setări de accesibilitate și un mod „lite” automat pentru telefoanele mai slabe. |

Lista completă de funcții și structura prezentării sunt în **[docs/HACKATHON.md](docs/HACKATHON.md)**. Clipul de prezentare și slide-urile sunt în [`promo/`](promo/).

---

## 3. Rularea cu serverul real

Serverul de producție rulează pe Render:
**https://gatemate-api-2n16.onrender.com**. Pentru verificare, deschide `/actuator/health`.

> Planul gratuit Render adoarme după 15 minute fără trafic. Prima cerere poate dura 30–60 de secunde, iar cele următoare sunt instant.

Build-urile de producție (`npm run build:prod`, `npm run cap:sync`) folosesc `environment.prod.ts`, care trimite aplicația direct la acest server.

**Aplicația + backend-ul pe calculatorul tău:**

```bash
# terminal 1
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev     # H2 în memorie, fără configurare

# terminal 2
npm run start:api      # aplicația pe :4200, conectată la http://<host>:8080
```

Profilul `dev` folosește o bază de date H2 în memorie și generează automat cheile JWT, deci nu trebuie configurat nimic. Funcțiile care depind de servicii externe (Velo AI, e-mail) se activează doar dacă pui cheile lor în variabilele de mediu (vezi [secțiunea 5](#5-backend-ul)).

---

## 4. Pe iPhone și Android

```bash
npm run cap:sync        # build de producție + copiere în proiectele native
npx cap open ios        # deschide Xcode
npx cap open android    # deschide Android Studio
```

**Pe iPhone (Xcode):**

1. Selectează target-ul **App** → *Signing & Capabilities* → alege echipa ta (merge și un Apple ID gratuit).
2. Conectează telefonul și apasă ▶︎ (Run).
3. Prima dată: *Setări → General → VPN și gestionare dispozitiv* → marchează dezvoltatorul ca de încredere.

Pașii detaliați, inclusiv pentru Live Activity și widget, sunt în [docs/RULARE.md](docs/RULARE.md).

---

## 5. Backend-ul

**Cerințe:** Java 21 și Maven 3.9+ (sau doar Docker).

```bash
cd backend
mvn test                                         # testele
mvn spring-boot:run -Dspring-boot.run.profiles=dev   # local, cu H2
```

**Cu Docker și Postgres, ca în producție:**

```bash
cd backend
cp .env.example .env      # completează valorile (vezi mai jos)
docker compose up --build # API pe http://localhost:8080
```

**Variabile de mediu importante** (lista completă e în [`backend/.env.example`](backend/.env.example)):

| Variabilă | La ce folosește | Obligatorie |
|---|---|---|
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | Postgres | da (în afară de profilul `dev`) |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | semnarea sesiunilor (RS256) | recomandat; altfel cheile se generează la pornire |
| `TOKEN_ENCRYPTION_KEY` | criptarea codurilor de bare și a token-urilor | da în producție |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Velo AI | nu; fără ele, Velo e dezactivat pe server |
| `MAIL_API_KEY`, `MAIL_FROM` | e-mailurile de verificare și invitațiile (Brevo sau Resend) | nu; fără ele, e-mailurile nu se trimit, iar invitația se deschide în aplicația de e-mail a telefonului |
| `PRO_EMAILS` | conturi care primesc Pro automat (pentru demo) | nu |
| `AERODATABOX_KEY`, `UNSPLASH_ACCESS_KEY` | date de zbor și imagini cu licență | nu |

**Migrările bazei de date** sunt gestionate de Flyway (`backend/src/main/resources/db/migration`) și rulează automat la pornire.

**Deploy:** fișierul [`render.yaml`](render.yaml) descrie serviciul. Fiecare push pe `main` face deploy automat pe Render.

Documentația API-ului este în [docs/BACKEND_API.md](docs/BACKEND_API.md) și în [backend/README.md](backend/README.md).

---

## 6. Arhitectura

```
 ┌───────────────────────────┐        HTTPS / JWT        ┌──────────────────────────┐
 │  Aplicația (Ionic Angular │  ───────────────────────► │  API Spring Boot 4       │
 │  + Capacitor: iOS/Android │                           │  (Java 21, Render)       │
 │  /web)                    │  ◄─────────────────────── │                          │
 │  • offline: bilete, hărți │                           │  • Postgres + Flyway     │
 │  • Live Activity (Swift)  │                           │  • job-uri: stare zbor,  │
 │  • scanare cod / MRZ      │                           │    ADS-B, cache hărți    │
 └───────────────────────────┘                           └────────────┬─────────────┘
                                                                      │
                     Gemini (Velo) · OpenSky / ADS-B · OpenStreetMap / Overpass ·
                     cursuri valutare · Brevo (e-mail) · RevenueCat (Pro)
```

| Strat | Tehnologii |
|---|---|
| Aplicație | Angular 20 (standalone, signals, OnPush), Ionic 8, Capacitor 8, Leaflet, ZXing |
| Nativ iOS | Swift: Live Activity / widget, scanare text (Vision) pentru pașaport |
| Server | Spring Boot 4.1, Spring Security (OAuth2 Resource Server, JWT RS256), JPA, Flyway, Caffeine, Bucket4j |
| Date | PostgreSQL 17 (H2 pentru dezvoltare și teste) |
| Traduceri | fișiere `i18n-src/*.tsv` compilate cu `python3 scripts/i18n-build.py` |

---

## 7. Structura repo-ului

```
gatemate/
├── src/app/
│   ├── core/          servicii, modele, gărzi, i18n, date (aeroporturi, avioane), utilitare (BCBP, MRZ)
│   ├── pages/         ecranele: home, trips, add-flight, airport-map, assistant, chat, family, lost-found, …
│   └── shared/        componente refolosite (bilet, schema de locuri, pasageri, invitații)
├── src/environments/  environment.ts (demo) · environment.local.ts · environment.prod.ts
├── backend/           API-ul Spring Boot (src/main/java/app/gatemate/…), teste, Dockerfile
├── ios/ · android/    proiectele native Capacitor
├── i18n-src/          traducerile (TSV)
├── scripts/           unelte pentru traduceri și build
├── docs/              documentație detaliată
├── promo/             clip și prezentare pentru hackathon
└── render.yaml        configurația de deploy
```

**Scripturi npm:**

| Comandă | Ce face |
|---|---|
| `npm start` | aplicația pe :4200 cu date demo |
| `npm run start:api` | aplicația conectată la backend-ul local (:8080) |
| `npm run build:prod` | build de producție în `www/` |
| `npm run build:preview` | build cu date demo, pentru găzduire statică |
| `npm run cap:sync` | build de producție + sincronizare cu iOS și Android |
| `npm test` | testele aplicației |

---

## 8. Securitate

- **Niciun secret în cod sau în aplicație.** Cheile (Gemini, e-mail, JWT, criptare) stau doar în variabilele de mediu ale serverului. Aplicația nu conține nicio cheie API.
- Sesiuni **JWT RS256** de scurtă durată, cu refresh token rotit și parole hash-uite.
- **Rate limiting** pe autentificare și pe Velo, plus CORS restrictiv.
- **Codurile de bare** ale biletelor sunt criptate în baza de date și trimise doar celui care a revendicat biletul. Un bilet poate fi adăugat doar dacă numele de pe el se potrivește cu contul sau cu un membru al familiei.
- Verificarea identității cu pașaportul se face **pe telefon**; serverul primește doar numele, nu imaginea documentului.
- Pe telefon: blocarea aplicației cu Face ID sau PIN după inactivitate, plus export și ștergere a datelor (GDPR).

Detalii în [docs/SECURITY.md](docs/SECURITY.md).

---

## 9. Teste

```bash
cd backend && mvn test     # 42 de teste: BCBP, potrivirea numelor, MRZ, autentificare, călătorii
npm test                   # testele aplicației
```

---

## 10. Documentație

| Fișier | Despre |
|---|---|
| [docs/HACKATHON.md](docs/HACKATHON.md) | prezentarea, demo-ul pas cu pas, toate funcțiile, competitorii |
| [docs/RULARE.md](docs/RULARE.md) | ghid complet de rulare (Render, Xcode, Docker) |
| [docs/BACKEND_API.md](docs/BACKEND_API.md) | endpoint-urile API |
| [docs/SECURITY.md](docs/SECURITY.md) | modelul de securitate |
| [docs/VELO.md](docs/VELO.md) | asistentul Velo AI |
| [docs/LIVE_ACTIVITY.md](docs/LIVE_ACTIVITY.md) | Live Activity și Apple Watch |
| [docs/PRO.md](docs/PRO.md) | abonamentul Pro |
| [docs/MAIL.md](docs/MAIL.md) · [docs/EMAIL.md](docs/EMAIL.md) | trimiterea e-mailurilor · importul rezervărilor din e-mail |
| [docs/I18N.md](docs/I18N.md) | traducerile |
| [docs/DESIGN.md](docs/DESIGN.md) | sistemul de design |
| [docs/COMPETITORS.md](docs/COMPETITORS.md) | comparația cu alte aplicații |
| [docs/APP_STORE.md](docs/APP_STORE.md) | publicarea în magazine |

---

<p align="center">Făcut de <b>Velosyntech</b> · <a href="mailto:contact@velosyntech.com">contact@velosyntech.com</a></p>
