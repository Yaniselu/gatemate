# Gatemate, explicată pe module

Ghid de prezentare: pentru fiecare modul ai **ce face** (pe înțelesul oricui), **cum funcționează** (tehnic), **ce API-uri folosește** și **fraza de spus pe scenă**.

---

## 0. Imaginea de ansamblu

**În două propoziții:** Gatemate e însoțitorul de călătorie care îți ține biletele, îți urmărește zborul în timp real și te ghidează prin aeroport și la destinație. Totul într-o singură aplicație, pentru tine și pentru familia ta, cu un asistent AI care chiar face lucruri pentru tine.

**Problema:** azi un călător folosește 5–8 aplicații: aplicația companiei, Flightradar, Google Maps, aplicația de schimb valutar, WhatsApp pentru grup, un PDF cu biletul copiilor și o căutare pe Google despre ce are voie în bagaj.

**Soluția:** un singur loc, care lucrează și offline.

### Arhitectura, pe scurt

```
Telefon (iOS / Android / web)                 Server (Render, Frankfurt)
┌──────────────────────────────┐   HTTPS    ┌─────────────────────────────┐
│ Angular 20 + Ionic 8         │  + JWT     │ Spring Boot 4 · Java 21     │
│ Capacitor 8 (aplicație       │ ─────────► │ PostgreSQL 17 + Flyway      │
│ nativă din același cod)      │ ◄───────── │ 3 job-uri programate        │
│ Swift: Live Activity, scanare│  WebSocket │ WebSocket (STOMP) pt. chat  │
│ Stocare locală criptată      │  (chat)    │ Cache Caffeine, rate limit  │
└──────────────────────────────┘            └──────────────┬──────────────┘
                                                           │
     Gemini (AI) · ADS-B (avioane live) · OpenStreetMap / Overpass (hărți) ·
     Wikipedia / Wikidata (obiective) · Open-Meteo / MET Norway (vreme) ·
     Frankfurter (valută) · Nager.Date (sărbători) · Brevo (e-mail) · RevenueCat (Pro)
```

| Strat | Tehnologie | De ce |
|---|---|---|
| Aplicația | Angular 20 (componente standalone, *signals*, OnPush), Ionic 8 | un singur cod pentru iOS, Android și web; interfață nativă |
| Nativ | Capacitor 8 + Swift | acces la cameră, notificări, Face ID, Live Activity |
| Server | Spring Boot 4.1, Java 21 | robust, sigur, ușor de scalat |
| Bază de date | PostgreSQL 17, migrări Flyway (V1–V12) | date relaționale: călătorii, zboruri, membri |
| Găzduire | Render (deploy automat la fiecare push pe `main`) | zero administrare de servere |
| 3D / hărți | Three.js, Leaflet, SVG desenat de noi | avionul 3D, harta aeroportului, harta lumii |

**Cifre bune de spus:**
- 19 module pe server;
- ~70 de endpoint-uri REST;
- 12 migrări de bază de date;
- 43 de teste automate;
- 6 limbi;
- 7 jocuri offline;
- 74 de reguli de aeroport;
- 22 de modele de avion cu schema de locuri.

---

## 1. Cont și autentificare

**Ce face:** te înregistrezi cu e-mail și parolă, sau cu Google ori Apple.
- La înregistrare alegi țara, iar limba aplicației se setează singură.
- Primești un cod de 6 cifre pe e-mail ca să-ți confirmi adresa.
- Dacă îți uiți parola, o resetezi tot cu un cod pe e-mail.

**Cum funcționează:**
- **Parolele:**
  - sunt hash-uite pe server, niciodată păstrate în clar;
  - au minimum 10 caractere, cu literă mare, literă mică, cifră și simbol;
  - parolele uzuale și cele care conțin e-mailul sunt refuzate.
- **Sesiunea:**
  - **JWT semnat RS256**, cu cheie privată RSA care stă doar pe server, și valabilitate scurtă;
  - **refresh token rotit** la fiecare folosire: dacă cineva fură un token vechi, nu-l mai poate folosi.
- **Google / Apple:** verificăm pe server semnătura token-ului primit de la Google sau Apple, cu cheile lor publice. Nu avem încredere orbește în ce spune telefonul.
- **Codurile de pe e-mail:**
  - pe server păstrăm doar un hash al codului;
  - expiră în 30 de minute;
  - sunt limitate: 3 trimiteri pe oră și 5 încercări la 15 minute.
- **Protecții:** contul se blochează temporar după prea multe parole greșite, plus rate limiting pe toate rutele de autentificare.

**API-uri:**
- **ale noastre:** `/auth/register`, `/auth/login`, `/auth/oauth/{google|apple}`, `/auth/refresh`, `/auth/logout`, `/auth/password-reset`, `/auth/password-reset/confirm`, `/me/email/code`, `/me/email/verify`;
- **externe:** Google (accounts.google.com, verificarea token-ului), Apple (appleid.apple.com), **Brevo** (trimite e-mailurile de pe contact@velosyntech.com).

**Pe scenă:** „Securitatea e de nivel bancar: token-uri semnate criptografic, rotite la fiecare folosire, iar codurile din e-mail nu sunt păstrate nici măcar de noi.”

---

## 2. Adăugarea biletelor (inima aplicației)

**Ce face:** adaugi zborul în 5 feluri:
1. **scanezi codul de bare** de pe bilet (hârtie sau ecranul altui telefon);
2. încarci o **captură de ecran** din aplicația Wizz, Ryanair sau a oricărei companii;
3. **lipești sau redirecționezi e-mailul** de confirmare;
4. imporți de la companie, cu cod de rezervare și nume;
5. manual (marcat „neverificat”).

**Cum funcționează:**
- **Codul de bare** e în standardul **IATA BCBP**, același pe toate biletele din lume. Îl citim pe telefon cu **ZXing** (PDF417, Aztec, QR) și îl decodăm cu parserul nostru: nume, PNR, rută, zbor, dată, loc, clasă.
- **Data zborului:**
  - biletul conține doar ziua din an (de exemplu „ziua 234”), fără an;
  - deducem anul din data emiterii, când există, sau alegem data cea mai apropiată de azi;
  - un bilet din 22 august e pus corect în anul potrivit.
- **E-mailul** e parsat pe server: găsim zborurile, orele și codul de rezervare. Poți și să-l redirecționezi pe o adresă unică de import.
- **Siguranța biletelor:**
  - un bilet intră în cont doar dacă **numele de pe el se potrivește** cu al tău sau cu al unui membru al familiei, ca nimeni să nu-și poată adăuga zborul unui străin;
  - potrivirea numelui ignoră diacriticele, titlurile lipite de nume (MR, MRS) și ordinea cuvintelor;
  - potrivirea exactă bate potrivirea pe prefix, ca să nu confundăm Ion cu Ionuț.
- **Criptarea:** codul de bare original e **criptat în baza de date** și trimis doar celui care a revendicat biletul.

**API-uri:**
- **ale noastre:** `/flights` (adaugă), `/flights/claim` (revendică un bilet scanat), `/bookings/lookup` (după cod de rezervare), `/bookings/email/preview`, `/bookings/email/import`, `/inbound/email` (webhook pentru e-mailurile redirecționate);
- **externe:** niciuna pentru scanare, totul se întâmplă pe telefon.

**De știut (dacă te întreabă):** importul direct de la companie, după cod de rezervare, are nevoie de un parteneriat cu compania sau de un furnizor de rezervări (GDS sau NDC). În demo merge cu rezervări de test. Scanarea și e-mailul merg cu orice companie, de azi.

**Pe scenă:** „Scanezi biletul și în 2 secunde ai tot zborul. Merge cu orice companie din lume, pentru că citim standardul IATA folosit pe toate biletele.”

---

## 3. Familie și prieteni

**Ce face:**
- îți adaugi familia o singură dată (copii, partener, părinți);
- le pui biletele lângă al tău, chiar dacă **copiii n-au aplicație**: toate biletele familiei sunt în telefonul tău, fiecare cu codul lui de bare real;
- când scanezi un bilet, aplicația întreabă „Al cui e biletul?”.

**Cum funcționează:**
- membrii familiei („companions”) sunt păstrați pe server;
- fiecare zbor are o listă de pasageri, fiecare cu locul și codul de bare criptat;
- potrivirea numelui alege automat persoana corectă, chiar dacă toți au același nume de familie;
- **identitatea** se poate verifica scanând pașaportul (zona MRZ, cele 2 rânduri de jos): citirea se face **pe telefon**, cu OCR nativ (Apple Vision), iar pe server ajung doar numele, țara și data expirării, **niciodată poza documentului**.

**API-uri:**
- **ale noastre:** `/me/companions` (CRUD), `/me/companions/{id}/identity`, `/me/identity`, `/flights/{id}/passengers`;
- **externe:** niciuna.

**Pe scenă:** „Mergi cu doi copii? Toate cele trei bilete sunt în telefonul tău, cu codurile reale. La poartă scanezi pe rând.”

---

## 4. Zborul în timp real

**Ce face:**
- arată starea zborului (la timp sau întârziat), poarta și terminalul;
- dacă zborul întârzie, **mută automat orele** de decolare și aterizare;
- avionul apare pe hartă, în 3D, cu altitudinea și viteza reale;
- vezi modelul avionului și schema lui de locuri.

**Cum funcționează:**
- **Pe server rulează 3 job-uri programate:**
  - `FlightStatusJob`, la 10 minute: actualizează starea și întârzierile; când găsește o întârziere, trimite alerta și recalculează orele;
  - `LiveStatusJob`, la 3 minute: poziția avionului din date **ADS-B** (semnalele radio emise de avion); de acolo luăm și modelul și înmatricularea;
  - încălzirea hărților de aeroport, la 10 minute (vezi modulul 6).
- **Modelul avionului:** catalogul nostru are 22 de modele (A320, 737 MAX, A321neo, 787…), fiecare cu numărul real de rânduri și locuri. Dacă ADS-B nu știe modelul, folosim modelul tipic al companiei.
- **Scena 3D:** e desenată cu **Three.js**, cu rulare, decolare, croazieră și aterizare. Pe telefoanele slabe trecem automat pe un mod „lite”.

**API-uri:**
- **ale noastre:** `/flights/{id}/status`, `/flights/{id}/live`;
- **externe:**
  - **adsb.lol** și **adsb.fi** (date ADS-B deschise, gratuite);
  - **AeroDataBox** (opțional, prin RapidAPI, pentru orarul oficial, dacă e setată cheia).

**Pe scenă:** „Nu afișăm ce zice compania. Ascultăm direct semnalul radio al avionului.”

---

## 5. Notificări și Live Activity

**Ce face:**
- îți spune când să pleci spre aeroport, când se deschide check-in-ul, când se schimbă poarta;
- te anunță cu **20, 10 și 5 minute înainte de îmbarcare**;
- pe iPhone, numărătoarea inversă apare pe **ecranul blocat, în Dynamic Island și pe Apple Watch**, cu **2,5 zile înainte**;
- fiecare tip de notificare se poate opri.

**Cum funcționează:**
- **Remindere locale:** sunt programate **pe telefon** (Capacitor Local Notifications), deci vin chiar și fără internet sau în modul avion. Când zborul întârzie, se reprogramează automat.
- **Alerte de pe server** (întârzieri, schimbări de poartă): apar în ecranul Alerte.
- **Live Activity:**
  - e cod **Swift / ActivityKit** scris de noi, plus un widget;
  - pornește la 60 de ore înainte de zbor;
  - iOS o închide singur după aproximativ 8 ore, iar aplicația o repornește.

**API-uri:**
- **ale noastre:** `/alerts`, `/alerts/read`, `/push-tokens`;
- **externe:** niciuna, totul e pe telefon.

**Pe scenă:** „Nu mai deschizi aplicația ca să afli poarta. O vezi pe ecranul blocat și pe ceas.”

---

## 6. Aeroportul și harta aeroportului

**Ce face:**
- **ghidul aeroportului:** poarta, distanța până la ea, reguli, ore;
- **harta interactivă** pentru **orice aeroport din lume**: porți, cafenele, magazine, toalete, farmacii, pe etaje;
- căutare de tipul „cafea lângă poarta B12”.

**Cum funcționează:**
- **Sursa:** datele vin din **OpenStreetMap**, prin interogări **Overpass**.
- **Desenul:** harta e desenată de noi în SVG (nu e o imagine din satelit), ca să fie rapidă și să meargă offline.
- **Viteza:**
  - serverul păstrează hărțile **în baza de date** și le reîmprospătează în fundal la 10 minute;
  - aplicația primește harta gata făcută, iar telefonul o ține și în cache;
  - dacă un server Overpass e căzut, încearcă automat altul (avem 4).
- **Datele de bază:** baza cu peste 5.300 de aeroporturi (OurAirports) e inclusă în aplicație, deci căutarea merge offline.

**API-uri:**
- **ale noastre:** `/airports`, `/airports/{iata}`, `/airports/{iata}/map`;
- **externe:** **Overpass API** (overpass-api.de, kumi.systems, private.coffee, mail.ru), plăcile de hartă Esri / ArcGIS.

**Pe scenă:** „Harta Craiovei, a Otopeniului sau a aeroportului din Tokyo, toate desenate automat din date deschise.”

---

## 7. Destinația: ghidul orașului

**Ce face:** pentru orașul în care zbori:
- **obiectivele de top** și un **plan de călătorie pe zile**;
- **vremea** pe 5 zile;
- **sărbătorile legale** din perioada călătoriei, răsăritul și apusul;
- **fraze utile** în limba locală, pe care le auzi atingându-le;
- **bani:** curs live, bacșiș, prețuri;
- **lista de bagaj** și **informații esențiale:** prize, numere de urgență, pe ce parte se circulă;
- transportul de la aeroport (Uber, Bolt, transport public) și închirieri auto.

**Cum funcționează:**
- **Obiective:** interogare **SPARQL pe Wikidata** după coordonate și notorietate, plus rezumate și poze de pe **Wikipedia**.
- **Planul pe zile:** grupăm obiectivele apropiate pe aceeași zi, cu algoritmul nostru de grupare geografică.
- **Vremea:** vine de la **Open-Meteo**; dacă acesta e indisponibil, serverul trece automat pe **MET Norway** (institutul meteo norvegian).
- **Rezultatele** sunt păstrate în cache pe server (Caffeine), ca să nu cerem de două ori aceleași date.

**API-uri:**
- **ale noastre:** `/destinations/{iata}`, `/destinations/{iata}/sights`, `/countries/{cc}/holidays`, `/fx`;
- **externe:** Wikipedia, Wikidata, Open-Meteo, MET Norway, **Frankfurter** (cursuri BCE), **Nager.Date** (sărbători), **Photon / Komoot** (căutarea adreselor), Unsplash (poze, opțional).

**Pe scenă:** „Aterizezi în Barcelona și știi deja ce vizitezi azi, cât e un euro și cum spui «nota, vă rog».”

---

## 8. Velo, agentul AI

**Ce face:**
- e un asistent care **știe de zborurile tale** și **face lucruri**: îți pregătește călătoria, îți spune ce poți vizita, calculează despăgubirea, convertește bani și adaugă lucruri pe lista ta de bagaj;
- are butoane rapide: „Zborul meu întârzie”, „Ce pun în bagaj”, „Acte și reguli de intrare”.

**Cum funcționează:**
- **Modelul:** **Google Gemini** (`gemini-flash-lite-latest`), apelat **doar de pe server**. Cheia API nu ajunge niciodată în aplicație.
- **Function calling:** e un **agent cu unelte**. Modelul decide singur ce funcții din codul nostru să apeleze:
  - `get_my_trips`: călătoriile tale;
  - `get_flight`: detaliile unui zbor;
  - `find_airport`: caută un aeroport;
  - `get_destination_guide`: obiective, vreme, monedă, acte;
  - `estimate_compensation`: calculul EU261;
  - `convert_currency`: curs live;
  - `add_checklist_items`: **scrie** pe lista ta de bagaj.
- **Răspunsul:** vine în flux, cuvânt cu cuvânt (SSE).
- **Limitări:** are timeout per model și rate limiting per utilizator.

**API-uri:**
- **ale noastre:** `GET` și `POST` pe `/assistant`;
- **externe:** **Gemini API** (generativelanguage.googleapis.com).

**Pe scenă:** „Velo nu e un chatbot care doar vorbește. E un agent: îi spui «zborul meu întârzie» și îți calculează despăgubirea pe zborul tău real.”

---

## 9. Chat și călătorii de grup

**Ce face:**
- fiecare călătorie are un **chat de grup**;
- pasagerii de pe același zbor se pot întâlni într-un **„lounge”**;
- inviți oameni prin **link** sau **e-mail**;
- ștergi un chat glisând spre stânga.

**Cum funcționează:**
- mesajele vin **în timp real prin WebSocket (STOMP)**, autentificat cu același JWT;
- **moderare:** poți raporta un mesaj sau bloca o persoană;
- invitațiile sunt **token-uri unice**; invitația pe e-mail pleacă prin Brevo.

**API-uri:**
- **ale noastre:** `/chats`, `/chats/{id}/messages`, `/chats/lounges`, `/moderation/reports`, `/moderation/blocks`, `/invites`, `/invites/email`, `/invites/{token}/accept`;
- **externe:** Brevo (e-mailul de invitație).

---

## 10. Drepturile pasagerului și Lost & Found

**Ce face:**
- **EU261:** îți spune dacă ai dreptul la **250, 400 sau 600 €** pentru întârziere sau anulare și îți **generează scrisoarea de reclamație**;
- **Lost & Found:** pentru bagaj pierdut, întârziat sau deteriorat, ori un obiect uitat în avion: pașii exacți, **termenele legale** (7 sau 21 de zile, după Convenția de la Montreal) și scrisoarea gata de trimis.

**Cum funcționează:**
- regulile EU261 și Montreal sunt **codificate de noi**: distanța, ora de sosire, compania UE sau non-UE;
- distanța se calculează cu formula **haversine** între coordonatele aeroporturilor;
- totul merge **offline**.

**API-uri:** niciuna, totul e local.

**Pe scenă:** „Firmele de recuperare iau 25–35% din banii tăi. Noi îți dăm scrisoarea gratuit.”

---

## 11. Reguli de aeroport, unelte, căutare

**Ce face:**
- **74 de reguli:** lichide, power bank-uri, medicamente, acte, pe categorii, toate căutabile;
- **unelte:** convertor valutar, fus orar și jet lag, dimensiunile bagajului de cabină pe companii, distanța dintre aeroporturi;
- **căutare globală:** găsește orice funcție, regulă, aeroport sau călătorie.

**Cum funcționează:**
- toate datele sunt incluse în aplicație;
- căutarea ignoră diacriticele și caută în ambele limbi.

---

## 12. Profil, pașaport de călător, distracție

**Ce face:**
- **Pașaportul de călător:** km zburați, țări, ore în aer, un card de distribuit pe Instagram;
- **harta lumii** cu țările vizitate și cele planificate;
- **realizări:** 23 de insigne și niveluri;
- **7 jocuri offline** pentru zbor (Sky Dodge, 2048, quiz cu steaguri, Memory…), plus exerciții de respirație și stretching pe scaun.

**Cum funcționează:** totul e calculat local din zborurile tale. Harta lumii e SVG, iar cardul de distribuit e o imagine generată pe telefon.

---

## 13. Gatemate Pro

**Ce face:**
- planul gratuit include **până la 5 bilete**;
- **Pro** oferă bilete nelimitate și funcții în plus.

**Cum funcționează:**
- plata trece prin **App Store sau Google Play**, gestionată de **RevenueCat**;
- serverul primește confirmarea printr-un **webhook semnat** și activează Pro.

**API-uri:**
- **ale noastre:** `/billing/revenuecat` (webhook), `/me/pro/sync`;
- **externe:** RevenueCat.

**Model de afaceri:** freemium. Pe viitor: comision de la parteneri (transport, închirieri, asigurări) și o variantă B2B pentru aeroporturi și companii aeriene.

---

## 14. Securitate și confidențialitate (de spus mereu)

- **Zero chei API în aplicație.** Toate (Gemini, e-mail, criptare) stau doar în variabilele de mediu ale serverului.
- **Criptare:** HTTPS peste tot. Codurile de bare și token-urile sensibile sunt criptate în baza de date (AES-GCM).
- **Pe telefon:**
  - blocare cu **Face ID sau PIN** după inactivitate;
  - ecranul se ascunde în lista de aplicații recente;
  - datele salvate offline sunt criptate.
- **Rate limiting** pe autentificare, AI și importuri, plus CORS restrictiv.
- **GDPR:** export complet al datelor (`/me/export`) și ștergerea contului dintr-un buton (`DELETE /me`).
- **Pașaportul** e citit doar pe telefon; serverul nu vede niciodată poza documentului.

---

## 15. Calitate și performanță

- **Testare:** 43 de teste automate pe server (parsarea biletelor, potrivirea numelor, MRZ, autentificare, vreme), plus teste automate de interfață (Playwright) pe toate ecranele, pe tema luminoasă și pe cea întunecată.
- **Încărcare:** aplicația pornește cu ~300 KB. Părțile grele (3D, scanerul) se încarcă doar când sunt folosite.
- **Telefoane slabe:** **modul „lite” automat**, detectat după memorie, procesor, economizorul de date și un test de cadre pe secundă.
- **Offline:** biletele, regulile, jocurile, drepturile și harta aeroportului merg fără internet.
- **6 limbi:** română, engleză, germană, franceză, spaniolă, italiană.

---

## 16. Întrebări grele de la juriu, cu răspunsuri

| Întrebare | Răspuns |
|---|---|
| De unde aveți datele de zbor? | Din semnalele ADS-B transmise de avioane (rețele deschise adsb.lol și adsb.fi), plus orarul oficial prin AeroDataBox când e activat. |
| Cât costă să rulați asta? | Aproape zero la început: surse de date deschise, Gemini Flash-Lite e foarte ieftin, iar Render are plan gratuit. Costul crește liniar cu utilizatorii, iar Pro îl acoperă. |
| De ce nu folosesc aplicația companiei? | Pentru că ai 3 companii pe an, nu una. Și nicio aplicație de companie nu ține biletele copiilor, harta aeroportului din altă țară, drepturile tale și grupul de prieteni. |
| Ce se întâmplă dacă pică serverul? | Biletele, regulile și harta sunt deja pe telefon. Pentru hărți avem 4 servere Overpass de rezervă, iar pentru vreme 2 surse. |
| E legal să citiți codul de pe bilet? | Da. E standardul public IATA BCBP, același pe care îl citește poarta de îmbarcare. Datele rămân la utilizator. |
| Cum evitați să-mi adauge cineva biletul? | Biletul intră doar dacă numele de pe el se potrivește cu contul tău sau cu familia ta. Codul de bare e criptat și ajunge doar la proprietar. |
| Importul de la companie merge cu orice companie? | Scanarea și e-mailul, da. Importul după codul de rezervare are nevoie de parteneriate cu companiile sau de un furnizor de rezervări (GDS/NDC); în demo arătăm fluxul cu rezervări de test. |
| Ce face AI-ul concret? | E agent cu 7 unelte: îți citește zborurile, calculează despăgubirea, convertește valută și îți scrie lista de bagaj. Nu inventează: lucrează pe datele tale reale. |
| Ce urmează? | Parteneriate cu aeroporturi (date oficiale despre porți și cozi), integrare cu companiile aeriene și extinderea pe Android Wear. |
