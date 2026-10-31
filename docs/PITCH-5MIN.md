# Prezentarea Gatemate în 5 minute

**Ideea care leagă totul:** nu prezinți funcții una după alta. Spui **povestea unei călătorii**, de acasă până la destinație, iar fiecare funcție apare exact în momentul în care călătorul are nevoie de ea. Așa treci natural de la una la alta.

**Firul poveștii:** *Acasă → La aeroport → În avion → La destinație → Când ceva merge prost → Sub capotă → Final*

---

## Înainte să urci pe scenă (2 minute de pregătire)

- Telefonul e conectat la proiector, pe **tema întunecată** (arată mai bine pe ecran mare) și cu **luminozitatea la maxim**.
- Ești logat cu contul demo (`alex.morgan@example.com` / `Sky-High2026!`) și ești pe **Acasă**.
- Ai **un bilet de îmbarcare tipărit** sau pe al doilea telefon, ca să-l scanezi live.
- Activează **Nu deranja**, ca să nu apară notificări străine pe ecran.
- Ai pregătite, în aplicația Velo, butoanele rapide (nu scrii nimic de la tastatură pe scenă).
- **Plan B:** clipul din `promo/` deschis într-un tab, în caz că pică internetul.

---

## Scriptul, minut cu minut

> Textul *cursiv* e ce spui. **[Între paranteze]** e ce faci pe telefon.

### 0:00–0:30 · Deschiderea: problema

*„Câte aplicații ați deschis ultima dată când ați zburat? Aplicația companiei pentru bilet, Flightradar ca să vedeți dacă întârzie, Google Maps în aeroport, WhatsApp pentru grup, un PDF cu biletul copilului și Google ca să aflați dacă aveți voie cu power bank-ul în bagaj.*

*Șase aplicații pentru un singur zbor. Noi am făcut una singură: **Gatemate**.”*

**[Arăți ecranul Acasă]**

> **Trecerea:** *„Hai să vă arăt o călătorie adevărată, de acasă până la destinație.”*

---

### 0:30–1:20 · Acasă: biletul și familia

*„Totul începe cu biletul. Nu trebuie să tastez nimic.”*

**[Adaugă zbor → Scanează boarding pass-ul → scanezi biletul tipărit]**

*„Am scanat codul de bare de pe bilet. E standardul IATA, același pe toate biletele din lume, așa că merge cu orice companie. În două secunde aplicația știe zborul, locul, poarta și data.*

*Pentru siguranță, biletul intră în cont doar dacă numele de pe el e al meu sau al cuiva din familia mea. Nimeni nu poate adăuga biletul unui străin.”*

> **Trecerea:** *„Și pentru că rar zburăm singuri…”*

**[Apeși pe zbor → rândul de pasageri de sus („Tu”, apoi membrii familiei)]**

*„…pot pune biletele întregii familii aici, chiar dacă copiii nu au telefon. La poartă scanez pe rând, din același telefon.”*

---

### 1:20–2:20 · La aeroport: zborul live

> **Trecerea:** *„Acum e ziua zborului. Gatemate știe asta înaintea mea.”*

**[Te întorci pe Acasă → cardul cu zborul și numărătoarea inversă]**

*„Îmi spune când să plec de acasă, la ce poartă merg și cât mai e până la îmbarcare. Cu 20, 10 și 5 minute înainte primesc notificare, iar pe iPhone o văd direct pe ecranul blocat, în Dynamic Island și pe ceas.”*

**[Deschizi zborul → scena 3D cu avionul]**

*„Ăsta e avionul meu, acum. Nu afișăm ce spune compania: ascultăm direct semnalul radio pe care îl transmite avionul. Știm modelul, altitudinea, viteza, iar dacă zborul întârzie, aplicația mută automat toate orele.”*

> **Trecerea:** *„Dar până la avion trebuie să-mi găsesc drumul prin aeroport.”*

**[Tabul Aeroport → Deschide harta → Craiova]**

*„Harta aeroportului din Craiova: porți, cafenele, toalete, pe etaje. Și nu doar Craiova: orice aeroport din lume, desenat automat din date deschise.”*

---

### 2:20–3:00 · În avion

> **Trecerea:** *„M-am îmbarcat, am pus telefonul în modul avion. Gatemate merge în continuare.”*

**[Profil sau Acasă → În zbor → arăți jocurile]**

*„Biletul, regulile și harta funcționează fără internet. Pentru zbor avem șapte jocuri offline, exerciții de respirație pentru cei cărora le e frică și sfaturi contra jet lag-ului.”*

---

### 3:00–3:50 · La destinație și Velo

> **Trecerea:** *„Am aterizat în Barcelona. Ce fac acum?”*

**[Deschizi călătoria → Ghidul orașului]**

*„Gatemate îmi spune ce să vizitez, îmi face un plan pe zile, îmi arată vremea, cursul euro și fraze în spaniolă pe care le aud cu o atingere.”*

> **Trecerea:** *„Și dacă am o întrebare la care nu răspunde niciun ecran?”*

**[Velo → butonul rapid „Zborul meu întârzie”]**

*„Acesta e Velo, agentul nostru AI. Nu e un chatbot care doar vorbește: are acces la zborurile mele reale și poate acționa. Îi spun că zborul a întârziat și îmi calculează despăgubirea exactă după regulamentul european, pe zborul meu.”*

---

### 3:50–4:20 · Când ceva merge prost

> **Trecerea:** *„Pentru că, să fim sinceri, la zboruri ceva merge prost.”*

**[Căutare → scrii „bagaj” → Lost & Found]**

*„Bagajul nu a ajuns? Gatemate îmi spune exact ce fac la ghișeu, ce termen legal am și îmi scrie scrisoarea de reclamație. Gratuit. Firmele de recuperare iau 25–35% din banii voștri.”*

---

### 4:20–4:45 · Sub capotă (pentru juriul tehnic)

**[Lași telefonul jos, te uiți la juriu]**

*„Pe scurt, partea tehnică:*
- *aplicația e Angular și Ionic, nativă pe iOS și Android din același cod, plus Swift pentru Live Activity;*
- *serverul e Spring Boot 4 cu Java 21 și PostgreSQL;*
- *zboruri live din semnale ADS-B, hărți din OpenStreetMap, AI cu Gemini.*

*Securitate: nicio cheie API în aplicație, totul trece prin server; codurile de bare sunt criptate; pașaportul e citit doar pe telefon. Aplicația merge offline, în 6 limbi.”*

---

### 4:45–5:00 · Finalul

*„Șase aplicații au devenit una. De la check-in până la destinație, pentru tine și pentru familia ta.*

***Gatemate. Your gate, your mate.*** *Vă mulțumim!”*

---

## Cheat-sheet de buzunar

```
0:00  Problema: 6 aplicații pentru un zbor
0:30  Scanez biletul (IATA, orice companie) → familia, copii fără telefon
1:20  Ziua zborului: numărătoare, 20/10/5 min, ecran blocat
      → avion 3D live (semnal radio ADS-B) → harta aeroportului CRA
2:20  Mod avion: totul merge offline, jocuri
3:00  Barcelona: ghid, plan, fraze → Velo calculează despăgubirea
3:50  Bagaj pierdut → scrisoare gratuită
4:20  Tehnic: Angular/Ionic + Spring Boot + Gemini; nicio cheie în app
4:45  „Șase aplicații au devenit una.”
```

**Cuvintele care fac trecerile, în ordine:**
„Hai să vă arăt o călătorie…” → „Și pentru că rar zburăm singuri…” → „Acum e ziua zborului…” → „Dar până la avion trebuie să-mi găsesc drumul…” → „M-am îmbarcat…” → „Am aterizat…” → „Și dacă am o întrebare…” → „Pentru că, să fim sinceri…” → „Pe scurt, partea tehnică…”

---

## Sfaturi

- **Exersează cu cronometrul** de 2–3 ori. Dacă depășești, taie „În avion” (2:20–3:00) și spune doar o frază: *„și merge offline, cu jocuri pentru zbor”*.
- **Nu explica butoanele.** Spune ce simte călătorul, iar ecranul arată restul.
- **O singură cifră pe secțiune** se ține minte: „6 aplicații”, „2 secunde”, „orice aeroport din lume”, „25–35%”.
- **Dacă ceva nu se încarcă**, nu aștepta: *„pe Wi-Fi-ul de aici durează, dar arată așa”* și treci la ecranul următor. Biletul, harta Craiovei, jocurile și Lost & Found merg oricum fără internet.
- **La întrebări**, folosește tabelul de la finalul `docs/MODULE.md`.
