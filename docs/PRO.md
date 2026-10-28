# Gatemate Pro – cum activezi plățile reale

Abonamentul **Gatemate Pro** costă **2,99 €/lună** sau **19,99 €/an**, cu **7 zile gratuite**.

**Ce primește utilizatorul Pro:**
- călătorii nelimitate (contul gratuit: 3 călătorii viitoare);
- toate obiectivele din Explore (gratuit: primele 8);
- „Settle up” (cine cui îi datorează) și export CSV pentru cheltuieli.

Codul e gata. Plata trece obligatoriu prin App Store / Google Play (cerință Apple 3.1.1 și Google Play Billing), prin **RevenueCat**, care e gratuit până la 2.500 $ venit pe lună.

## Cum funcționează (pe scurt)
1. Utilizatorul plătește în aplicație. Plata e procesată de Apple sau Google.
2. RevenueCat primește confirmarea de la magazin și trimite un **webhook** serverului nostru (`/api/v1/billing/revenuecat`).
3. Serverul marchează contul ca Pro până la data expirării. **Aplicația nu poate debloca Pro singură**: serverul decide, pe baza evenimentelor semnate de magazin.

## Ce trebuie să faci tu (o singură dată)

### 1. Apple (ai nevoie de Apple Developer, 99 $/an)
1. App Store Connect → **Agreements, Tax and Banking**: semnezi „Paid Apps” și adaugi contul bancar.
2. Creezi aplicația cu Bundle ID `com.velosyntech.gatemate`.
3. **Subscriptions** → creezi un grup „Gatemate Pro”, cu două produse:
   - `gatemate_pro_monthly`: 1 lună, 2,99 €, introductory offer 7 zile gratuit;
   - `gatemate_pro_yearly`: 1 an, 19,99 €, introductory offer 7 zile gratuit.
4. **Users and Access → Integrations → In-App Purchase**: generezi o cheie (.p8) pentru RevenueCat.

### 2. Google Play (25 $ o singură dată)
1. Play Console → aplicația → **Monetize → Subscriptions**: aceleași două produse, cu aceleași ID-uri.
2. Conectezi un service account pentru RevenueCat (ghidul RevenueCat te duce pas cu pas).

### 3. RevenueCat (gratuit)
1. Creezi proiectul **Gatemate** și adaugi aplicația iOS și aplicația Android.
2. **Entitlements**: creezi `pro` și îi atașezi ambele produse.
3. **Offerings**: în `default` adaugi pachetele **Monthly** (`$rc_monthly`) și **Annual** (`$rc_annual`).
4. **API keys**: copiezi cheile publice (`appl_…` și `goog_…`) și mi le trimiți, sau le pui în `src/environments/environment.prod.ts`, la `purchases`. Cheile publice nu sunt secrete.
5. **Integrations → Webhooks**:
   - URL: `https://gatemate-api-2n16.onrender.com/api/v1/billing/revenuecat`;
   - Authorization header: valoarea variabilei `REVENUECAT_WEBHOOK_SECRET` din Render (gatemate-api → Environment).
6. Opțional: o cheie secretă `sk_…`, pusă în Render la `REVENUECAT_SECRET_KEY`. Cu ea, serverul confirmă abonamentul imediat după plată.

### 4. Testare
- Pe iPhone, cu un cont **Sandbox** (App Store Connect → Users → Sandbox Testers), plata e simulată și nu se încasează nimic.
- Până faci pașii de mai sus, ecranul Pro din aplicație spune „Subscriptions aren’t available in this build yet”. Acesta e comportamentul corect: Apple respinge aplicațiile cu butoane de plată care nu merg.

## Reguli Apple pe care le respectă deja ecranul Pro
- Prețurile vin din magazin, în moneda utilizatorului (nu sunt scrise de mână).
- Se afișează durata, prețul după perioada gratuită și reînnoirea automată.
- Există butoanele „Restore purchases”, Terms și Privacy.
- Abonamentul se gestionează din setările magazinului („Manage subscription”).
- La ștergerea contului, utilizatorul e avertizat că abonamentul se anulează separat, din magazin.
