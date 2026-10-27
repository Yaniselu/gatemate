# Cum pornești Gatemate (backend, bază de date și telefon)

## Ce e pornit acum

| Parte | Unde rulează | Adresă |
|---|---|---|
| Serverul (Java + Spring Boot) | Render, plan gratuit, Frankfurt | https://gatemate-api-2n16.onrender.com |
| Baza de date (PostgreSQL 18) | Render, `gatemate-db`, gratuit | expiră pe **26 noiembrie 2026**; înainte de data asta faci upgrade (~6 $/lună) sau o muți pe Neon (gratuit) |
| Codul | GitHub, `Yaniselu/gatemate` (privat) | fiecare push pe `main` face redeploy automat pe Render |

Planul gratuit Render „adoarme” serverul după 15 minute fără activitate. Prima cerere după aceea durează ~50 de secunde, apoi merge normal.

## 0. Pe iPhone, din Xcode (cel mai rapid)

Ai nevoie de un Mac cu **Xcode**, **Node.js 22** și un **Apple ID** (merge și unul gratuit).

```bash
git clone https://github.com/Yaniselu/gatemate.git
cd gatemate
npm install
npm run cap:sync        # build pentru producție (legat de serverul de pe Render) + copiere în proiectul iOS
npx cap open ios
```

În Xcode:
1. Selectezi proiectul **App** → tab-ul **Signing & Capabilities** → bifezi „Automatically manage signing” → la **Team** alegi Apple ID-ul tău (Add Account… dacă nu apare).
2. Conectezi iPhone-ul prin cablu, îl alegi sus (lângă ▶) și apeși **▶ Run**.
3. Prima dată, pe iPhone: Setări → General → VPN & Device Management → contul tău de developer → **Trust**. Pe iOS 16+ trebuie activat și Setări → Confidențialitate și securitate → **Developer Mode**.
4. Îți faci cont în aplicație cu email și parolă. Datele se salvează pe server.

Cu Apple ID gratuit, aplicația rămâne pe telefon 7 zile, apoi o reinstalezi din Xcode. Cu Apple Developer (99 $/an) dispare limita și poți activa Sign in with Apple.

Dacă Xcode spune că identificatorul `com.velosyntech.gatemate` e ocupat, îl schimbi în Signing & Capabilities → Bundle Identifier (de ex. `com.numele-tau.gatemate`).

---

## 1. Ce instalezi o singură dată

- **Node.js 22**: https://nodejs.org
- **Docker Desktop**: https://www.docker.com/products/docker-desktop (pornește Postgres și serverul fără alte instalări)
- **Android Studio**, dacă vrei aplicația nativă pe Android
- **Xcode**, doar pe Mac, dacă vrei aplicația pe iPhone

---

## 2. Pornești serverul și baza de date (pe calculator)

```bash
cd backend
cp .env.example .env
```

În `.env` completezi doar asta ca să meargă local:

```bash
# cheia de criptare (32 de octeți)
openssl rand -base64 32        # → pune rezultatul la TOKEN_ENCRYPTION_KEY
DATABASE_PASSWORD=o-parola-a-ta
CORS_ORIGINS=http://localhost:*,http://192.168.*.*:*
```

Cheile JWT pot rămâne goale local: serverul generează unele temporare. Asta înseamnă doar că te deloghează la fiecare repornire.

Apoi:

```bash
docker compose up --build
```

- Baza de date pornește în Docker, iar tabelele se creează automat (Flyway).
- Serverul răspunde la http://localhost:8080. Verificare: http://localhost:8080/actuator/health → `{"status":"UP"}`.

**Variantă fără Docker** (bază de date în memorie, se pierde la oprire):

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

---

## 3. Pornești aplicația legată de server

În altă fereastră de terminal, din folderul principal `gatemate`:

```bash
npm install
npm run start:api
```

- Pe calculator: http://localhost:4200
- **Pe telefon (în aceeași rețea Wi-Fi):** afli IP-ul calculatorului (pe Mac: `ipconfig getifaddr en0`, pe Windows: `ipconfig`) și deschizi `http://IP-UL-TAU:4200` în browserul telefonului.

Aplicația vorbește singură cu serverul de pe `http://IP-UL-TAU:8080`.

**Ce merge în acest mod:**
- creare cont cu email și parolă, login, delogare, ștergere cont;
- adăugare bilet scanând boarding pass-ul (numele de pe bilet trebuie să fie numele legal din profil);
- adăugare zbor manual, checklist, cheltuieli, chat de grup, invitații, alerte;
- Explore (obiective, sărbători, fraze, valută), harta din satelit, pozele reale cu orașele.

**Limitări în browser:** browserul cere HTTPS ca să dea acces la locație și la cameră. Pe `http://IP:4200` distanța până la poartă și scanarea cu camera nu merg. Merg în aplicația nativă (pasul 4) sau după publicarea online (pasul 5).

---

## 4. Aplicația nativă pe telefonul tău

### Android
1. Pe telefon: Setări → Despre telefon → apeși de 7 ori pe „Build number”. Apoi, în Opțiuni dezvoltator, activezi „USB debugging”.
2. Pe calculator:
   ```bash
   npm run build -- --configuration local
   npx cap sync android
   npx cap open android
   ```
3. În Android Studio alegi telefonul conectat prin cablu și apeși ▶ Run.

### iPhone (ai nevoie de Mac)
```bash
npm run build -- --configuration local
npx cap sync ios
npx cap open ios
```
În Xcode, la Signing & Capabilities, alegi Apple ID-ul tău (merge și unul gratuit, pentru teste de 7 zile). Apoi alegi iPhone-ul și apeși ▶.

> Pentru aplicația nativă, serverul trebuie să fie accesibil de pe telefon. Local, Android acceptă `http` doar pentru emulator (`10.0.2.2`). Pentru telefonul real e mai simplu să publici serverul online, cu HTTPS (pasul 5).

---

## 5. Online, ca să meargă oriunde (recomandat)

1. **Serverul și baza de date**: Render, Railway sau Fly.io. Creezi o bază PostgreSQL și un serviciu web din folderul `backend/` (are deja `Dockerfile`). Variabilele din `.env.example` le pui în setările serviciului.
2. **Aplicația web**: Vercel sau Netlify, cu `npm run build:prod` și folderul `www/`.
3. În `src/environments/environment.prod.ts` pui adresa reală a serverului la `apiUrl` și la `allowedApiOrigins`. În `src/index.prod.html` adaugi aceeași adresă în `connect-src`.
4. Pentru magazine: `npm run cap:sync`, apoi build din Xcode sau Android Studio.

---

## 6. Login cu Apple și Google (când ai conturile)

- **Google**: Google Cloud Console → Credentials → creezi OAuth Client ID-uri (Web, iOS, Android cu amprenta SHA-1). ID-urile le pui în `environment.prod.ts` (aplicație) și în `GOOGLE_AUDIENCES` (server).
- **Apple** (ai nevoie de Apple Developer, 99 $/an): creezi un App ID cu „Sign in with Apple”, un Services ID și o cheie `.p8`. Valorile le pui în `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID` și `APPLE_PRIVATE_KEY`.
- Loginul cu email și parolă merge imediat, fără nimic în plus.

---

## Probleme frecvente

| Simptom | Rezolvare |
|---|---|
| „Can’t reach the server” în aplicație | Verifici că `docker compose up` rulează și că http://IP:8080/actuator/health răspunde de pe telefon |
| Eroare CORS în consolă | Adaugi adresa de unde deschizi aplicația în `CORS_ORIGINS` |
| Harta e neagră / fără poze | Ești în preview-ul Claude sau fără internet. Pe telefon, cu internet, se încarcă |
| Te deloghează la fiecare repornire a serverului | Completezi `JWT_PRIVATE_KEY` și `JWT_PUBLIC_KEY` în `.env` (comenzile sunt în `.env.example`) |
