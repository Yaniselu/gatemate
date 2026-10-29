# Adăugarea biletelor din emailul de confirmare

## 1. Lipește emailul (merge acum, fără nicio configurare)
În aplicație: **Add a booking → From the confirmation e-mail**.
1. Deschizi emailul companiei aeriene, selectezi tot textul și îl copiezi.
2. Îl lipești în căsuță și apeși **Find flights**.
3. Gatemate arată zborurile găsite: număr de zbor, aeroporturi, dată, oră, loc și cod de rezervare. Apeși **Add**.

Dacă numele tău legal (din profil) apare în email, zborul e marcat „pending” (numele tău e pe rezervare). Dacă nu apare, zborul e marcat „unverified”.

## 2. Forward către o adresă personală (opțional, ~10 minute)
Fiecare cont primește o adresă secretă. Când trimiți emailul pe ea de pe adresa contului, excursia apare singură, marcată **verified**.

Ai nevoie de un serviciu care primește emailuri și le trimite serverului. Varianta cea mai simplă, fără să ai un domeniu propriu:

### CloudMailin (are plan gratuit)
1. Îți faci cont pe https://www.cloudmailin.com. Primești o adresă de forma `1a2b3c4d5e@cloudmailin.net`.
2. **Target URL**:
   `https://gatemate:SECRET@gatemate-api-2n16.onrender.com/api/v1/inbound/email`
   - `SECRET` e valoarea lui `INBOUND_EMAIL_SECRET` din Render (gatemate-api → Environment). Serverul a generat-o deja.
   - **Format: JSON (Normalized)**.
3. În Render, la `IMPORT_EMAIL_ADDRESS`, pui `1a2b3c4d5e+{token}@cloudmailin.net`, cu adresa ta în loc de `1a2b3c4d5e`. `{token}` rămâne exact așa, cu acolade. Apeși **Save**, iar serverul repornește singur.

### Sau Postmark
1. Îți faci cont pe https://postmarkapp.com și creezi un server. La **Inbound** vezi adresa `abc123@inbound.postmarkapp.com`.
2. Webhook URL: `https://gatemate:SECRET@gatemate-api-2n16.onrender.com/api/v1/inbound/email`, cu același `SECRET` ca mai sus.
3. În Render: `IMPORT_EMAIL_ADDRESS` = `abc123+{token}@inbound.postmarkapp.com`.

## Ce verifică serverul la un forward
- **Secretul webhook-ului.** Fără el, cererea e respinsă.
- **Adresa secretă.** Trebuie să aparțină unui cont.
- **Expeditorul.** Emailul trebuie trimis de pe adresa contului, iar domeniul expeditorului trebuie să treacă verificarea SPF sau DKIM. Așa nimeni nu poate trimite în numele tău.
- **Numele legal din profil.** Trebuie să apară pe rezervare.
- **Unicitatea.** Același zbor nu poate fi adăugat de două conturi.

Răspunsul serverului e mereu 202, ca nimeni să nu poată afla ce adrese există.
