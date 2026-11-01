# Echipa Gatemate · Velosyntech

> **Gatemate:** însoțitorul de călătorie care îți ține biletele, îți urmărește zborul în timp real
> și te ghidează prin aeroport și la destinație. Pentru tine și pentru familia ta.

**Hackathon Craiova 2.0** · Tema: *Future flight, airport and in-flight experience*
**Echipa:** Velosyntech · **Oraș:** Craiova · **Contact:** contact@velosyntech.com
**Repo:** https://github.com/Yaniselu/gatemate

---

## Cine suntem

Suntem [2] oameni pasionați de tehnologie și de călătorii. Am pornit de la o problemă pe care am trăit-o:
la un singur zbor folosești 5–8 aplicații diferite, iar dacă mergi cu familia, biletele copiilor sunt
împrăștiate prin PDF-uri și capturi de ecran. Ne-am propus să facem **o singură aplicație** care te
însoțește de acasă până la destinație și care merge chiar și fără internet.

---

## Membrii echipei

### Serban Yanis
**Rol:** [ex. Team Lead · Full-stack & Mobile]
**GitHub:** [@Yaniselu](https://github.com/Yaniselu)

**De ce a răspuns:**
- [ex. Viziunea produsului și prioritizarea funcțiilor]
- [ex. Aplicația mobilă: Angular 20 + Ionic 8 + Capacitor 8]
- [ex. Integrarea nativă iOS: Live Activity (ecran blocat, Dynamic Island, Apple Watch), scanarea pașaportului]
- [ex. Deploy-ul pe Render și configurarea serviciilor externe (Gemini, Brevo)]

**Module la care a lucrat:**
| Modul | Ce a făcut |
|---|---|
| [Bilete și scanare] | [ex. scanarea codului IATA BCBP, potrivirea numelui] |
| [Zbor live] | [ex. scena 3D, starea zborului, întârzieri] |
| [Live Activity iOS] | [ex. widget-ul Swift, sincronizarea cu zborul următor] |
| [...] | [...] |

**Tehnologii folosite:** [Angular, TypeScript, Ionic, Capacitor, Swift, Spring Boot, ...]

**La prezentare:** [ex. prezintă povestea și demo-ul live]

---

### [Numele colegului]
**Rol:** [ex. Backend & Data · Design & UX · QA & Pitch]
**GitHub:** [@username](https://github.com/username)

**De ce a răspuns:**
- [ex. Serverul Spring Boot și baza de date PostgreSQL]
- [ex. Designul interfeței, tema luminoasă și cea întunecată]
- [ex. Testarea aplicației pe iOS și Android]
- [ex. Prezentarea și materialele video]

**Module la care a lucrat:**
| Modul | Ce a făcut |
|---|---|
| [Harta aeroportului] | [ex. date OpenStreetMap, etaje, căutare] |
| [Ghidul destinației] | [ex. obiective, plan pe zile, vreme, valută] |
| [Lost & Found / EU261] | [ex. reguli, termene, scrisori de reclamație] |
| [...] | [...] |

**Tehnologii folosite:** [...]

**La prezentare:** [ex. răspunde la întrebările tehnice ale juriului]

---

## Cum ne-am împărțit aplicația

| Zonă | Ce conține | Responsabil |
|---|---|---|
| **Aplicația mobilă** | ecrane, navigare, temă, 6 limbi, mod offline | [Yanis] |
| **Bilete și familie** | scanare BCBP, import din e-mail, potrivirea numelui, biletele familiei | [Yanis] |
| **Zbor live** | ADS-B, scenă 3D (Three.js), întârzieri, modelul avionului și locurile | [Yanis] |
| **Notificări și Live Activity** | remindere 20/10/5 min, ecran blocat, Apple Watch | [Yanis] |
| **Aeroport** | hărți OpenStreetMap / Overpass pentru orice aeroport, etaje, căutare | [Natalia] |
| **Destinație** | Wikidata, Wikipedia, vreme, valută, sărbători, fraze | [Natalia] |
| **Velo AI** | agent Gemini cu 7 unelte (zboruri, despăgubiri, valută, listă de bagaj) | [Yanis] |
| **Chat și grupuri** | WebSocket, invitații prin link și e-mail, moderare | [Natalia] |
| **Server** | Spring Boot 4, PostgreSQL, Flyway, securitate JWT, job-uri programate | [Yanis] |
| **Design și UX** | interfață, accesibilitate, contrast, animații | [Natalia] |
| **Testare** | 43 de teste automate pe server, testare pe iPhone și Android | [Natalia] |
| **Pitch** | prezentare, video, demo | [Ambii] |

---

## Cum am lucrat

- **Organizare:** [ex. ne-am împărțit pe module și ne-am sincronizat zilnic]
- **Cod:** un singur repo, cu push pe `main`; deploy automat pe Render la fiecare push
- **Testare:** teste automate pe server, teste de interfață pe toate ecranele, plus testare manuală pe telefoane reale
- **Unelte:** VS Code, Xcode, Android Studio, GitHub, Render, Claude Code (asistent AI pentru programare)

---

## Cronologie

| Zi | Ce am realizat |
|---|---|
| [Ziua 1] | [ex. ideea, arhitectura, autentificarea, primele ecrane] |
| [Ziua 2] | [ex. scanarea biletelor, zborul live, harta aeroportului] |
| [Ziua 3] | [ex. Velo AI, familia, Lost & Found, Live Activity] |
| [Ziua 4] | [ex. design, testare, optimizare, prezentare] |

---

## Ce am învățat

- [ex. Cum funcționează standardul IATA BCBP de pe biletele de avion]
- [ex. Cum se construiește un agent AI care apelează funcții din cod (function calling)]
- [ex. Cum se face o Live Activity pe iOS în Swift]
- [...]

---

## Ce urmează

- Parteneriate cu aeroporturi, pentru date oficiale despre porți și cozi
- Integrare directă cu companiile aeriene, pentru importul rezervărilor
- Publicare în App Store și Google Play
- [...]

---

<p align="center">Făcut cu drag în Craiova de echipa <b>Velosyntech</b> ✈️</p>