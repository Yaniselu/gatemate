# Publicarea în App Store și Google Play

Ce e deja făcut în cod și ce trebuie făcut manual în conturile Apple și Google.

## Deja rezolvat în cod

| Cerință | Stare |
|---|---|
| Ștergerea contului din aplicație (Apple 5.1.1(v), Google) | ✔ Profil → Securitate → Șterge contul; pentru Sign in with Apple se revocă și accesul |
| Pagină publică pentru ștergerea contului (Google Play) | ✔ `https://gatemate-api-2n16.onrender.com/legal/delete-account.html` |
| Politica de confidențialitate, publică | ✔ `https://gatemate-api-2n16.onrender.com/legal/privacy.html` |
| Termeni de utilizare | ✔ `https://gatemate-api-2n16.onrender.com/legal/terms.html` |
| Texte pentru permisiuni iOS (cameră, locație, poze, Face ID) | ✔ în `Info.plist` |
| Declarația de criptare (`ITSAppUsesNonExemptEncryption = NO`) | ✔ doar HTTPS și criptare de date locale, care sunt scutite |
| Manifestul de confidențialitate (`PrivacyInfo.xcprivacy`) | ✔ conținut; **trebuie adăugat o dată în Xcode** (vezi mai jos) |
| Evaluarea aplicației | ✔ prin fereastra oficială Apple/Google, fără întrebare care filtrează utilizatorii (interzisă de ambele magazine) |
| Raportarea și blocarea în chat (Apple 1.2, conținut generat de utilizatori) | ✔ |
| Notificări exacte pe Android 12+ | ✔ cere permisiunea „Alarme și mementouri” din Setări → Notificări |
| Fără chei API în aplicație | ✔ |
| Android minim 8.0 (SDK 26), țintă SDK 36 | ✔ |
| iOS minim 15 (aplicația), 16.2 (widget-ul Live Activity) | ✔ |

## De făcut o singură dată în Xcode

1. **PrivacyInfo:** File → Add Files to "App"… → `ios/App/App/PrivacyInfo.xcprivacy`, bifat doar ținta **App**.
2. **Ținta de widget:** verifică să fie în proiect (GatemateWidgetsExtension, iOS 16.2, aceeași echipă).
3. Salvează în git: `git add ios/App && git commit -m "Xcode project: widget target and privacy manifest" && git push`.

## Apple (App Store Connect)

- **Cont Apple Developer plătit (99 $/an).** Cu echipa personală (gratuită) aplicația nu se poate publica, iar Sign in with Apple nu se poate activa.
- **Sign in with Apple:** Xcode → ținta App → Signing & Capabilities → + Capability → *Sign in with Apple*. Apoi în `src/environments/environment.prod.ts` pui `appleEnabled: true`.
- **Google Sign-In:** obligatoriu împreună cu Sign in with Apple (regula 4.8), deci activează-le pe amândouă sau niciunul. Vezi secțiunea Google de mai jos.
- **App Privacy** (etichetele de confidențialitate): email, nume, ID utilizator, telefon (opțional), poze (doar avatar), conținut utilizator (chat), suport. Toate „legate de utilizator”, **fără tracking**.
- **Contul demo pentru recenzorul Apple** (obligatoriu, altfel respinge): creează un cont real pe server și pune e-mailul și parola în *App Review Information → Sign-in required*.
- **Linkuri:** Privacy Policy URL și Support URL (`https://velosyntech.com` sau pagina de confidențialitate).
- **Capturi de ecran:** iPhone 6,9" (obligatoriu) și 6,5".
- **Clasificarea de vârstă:** chatul permite conținut generat de utilizatori, cu moderare. La întrebarea despre conținut generat de utilizatori răspunde „Da”.

## Google Play Console

- **Cont personal nou:** Google cere **testare închisă cu cel puțin 12 testeri timp de 14 zile** înainte de producție.
- **Data safety:** aceleași date ca la Apple, criptate în tranzit; utilizatorul își poate cere ștergerea datelor (pune linkul de ștergere de mai sus).
- **Ștergerea contului:** linkul `…/legal/delete-account.html`.
- **Politica de confidențialitate:** linkul `…/legal/privacy.html`.
- **Clasificarea conținutului:** chestionarul IARC; răspunde „Da” la interacțiunea între utilizatori.
- **Semnarea:** generează un keystore de upload și păstrează-l în afara git (`*.jks` e deja ignorat).

## Google Sign-In (pentru ambele platforme)

1. În Google Cloud Console → APIs & Services → Credentials, creezi 3 ID-uri OAuth:
   - **Web** (pentru server și Android);
   - **iOS** (bundle `com.velosyntech.gatemate`);
   - **Android** (pachet `app.gatemate` + amprenta SHA-1 a keystore-ului).
2. În `environment.prod.ts` pui `googleWebClientId` și `googleIosClientId`. Acestea sunt identificatori publici, nu secrete.
3. În Xcode → ținta App → Info → URL Types, adaugi schema inversată a ID-ului iOS (`com.googleusercontent.apps.…`).
4. Pe Render, variabila `GOOGLE_AUDIENCES` = ID-ul Web și ID-ul iOS, separate prin virgulă.

## Ce nu poate garanta nimeni

Aprobarea o decide recenzorul Apple sau Google. Lista de mai sus acoperă motivele obișnuite de respingere. Cele mai frecvente rămân: lipsa contului demo, link de confidențialitate nefuncțional, butoane care nu fac nimic și crash-uri la prima pornire. Testează pe un telefon real înainte de trimitere.
