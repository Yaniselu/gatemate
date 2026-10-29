# Emailuri de verificare și resetare a parolei

## Cum funcționează
- **La crearea contului**, Gatemate trimite un **cod de 6 cifre**. Utilizatorul îl scrie în aplicație, iar contul apare ca „confirmat”. Dacă apasă „Later”, pe Home apare un card care îi amintește să confirme.
- **La „Forgot password”** primește tot un cod de 6 cifre și alege direct în aplicație o parolă nouă. Nu sunt linkuri de deschis.
- **Securitatea codurilor:**
  - sunt stocate criptat (hash);
  - expiră în 30 de minute;
  - se pot încerca de cel mult 5 ori;
  - se poate cere cel mult un cod pe minut și 5 pe oră.

## Ce faci tu o singură dată (~5 minute, gratuit)
Folosim **Brevo**: gratuit, 300 de emailuri pe zi, și poți trimite de pe adresa ta, fără domeniu propriu.

1. Îți faci cont pe https://www.brevo.com (planul Free).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**. Pui adresa de pe care pleacă emailurile, de exemplu `serban-yanis@velosyntech.com`, și o confirmi din emailul primit de la Brevo.
3. **SMTP & API → API Keys → Generate a new API key**. Copiezi cheia, care începe cu `xkeysib-`.
4. În **Render → gatemate-api → Environment** completezi:
   - `MAIL_API_KEY` = cheia de la pasul 3;
   - `MAIL_FROM` = adresa confirmată la pasul 2.

   Apeși **Save changes**, iar serverul repornește singur.

**Nu trimite cheia în chat.** Pune-o direct în Render.

Până faci pașii de mai sus, aplicația nu trimite emailuri: ecranul de confirmare nu apare, iar „Forgot password” spune că trimiterea de emailuri nu e configurată încă.

Alternativă: **Resend**, dacă ai acces la DNS-ul domeniului `velosyntech.com`. În Render pui `MAIL_PROVIDER=resend` și cheia Resend.

## Protecția împotriva atacurilor
- **Pe IP:**
  - autentificare: 20 de cereri la 10 minute;
  - creare de cont: 5 pe oră;
  - API-ul obișnuit: 300 de cereri pe minut.
- **Pe adresa de email, oricare ar fi IP-ul:**
  - login: 10 încercări la 15 minute;
  - coduri de resetare a parolei: 3 pe oră;
  - încercări cu un cod de resetare: 5 la 15 minute.
- **Pe cont:** după mai multe parole greșite contul se blochează temporar, iar pauza se dublează la fiecare nouă greșeală.
- **Pe tot serverul:** cel mult 600 de cereri de autentificare pe minut, ca protecție când cineva folosește foarte multe IP-uri.
- **Parole:** sunt stocate cu Argon2id. Răspunsurile nu dezvăluie dacă un email are cont.
