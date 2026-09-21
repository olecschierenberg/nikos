# NIKOS – Netlify Functions (Ersatz für die n8n-Workflows)

Kleine Server-Funktionen, die Netlify beim normalen Deploy (`deploy "..."`) automatisch mit veröffentlicht.
Ohne Zusatzpakete (nur Node.js), Code in `lib/` (gemeinsam) und `functions/` (je Adresse eine Datei).

| Adresse | Datei | Ersetzt n8n-Workflow |
|---|---|---|
| `POST /api/form` | `functions/form.mjs` | Formular-Handling (Anfragen, Newsletter, Zugangsanfrage) |
| `GET /api/zugang-confirm` | `functions/zugang-confirm.mjs` | Zugangsanfragen (Bestätigung durch Antragsteller) |
| `GET/POST /api/zugang-classify` | `functions/zugang-classify.mjs` | Zugangsanfragen (Klassifizierung durch RADACOM) |
| `POST /api/login-request` | `functions/login-request.mjs` | Magic-Link-Login (Link anfordern) |
| `GET /api/login-verify` | `functions/login-verify.mjs` | Magic-Link-Login (Klick auf Link) |
| `GET /api/login-check` | `functions/login-check.mjs` | Magic-Link-Login (Token prüfen) |
| `POST /api/seo-report` | `functions/seo-report.mjs` | SEO-/GEO-Report Versand |

## Umgebungsvariablen (Netlify → Project configuration → Environment variables)

| Name | Inhalt |
|---|---|
| `BREVO_API_KEY` | Brevo-API-Schlüssel (Mails + Newsletter-Anmeldung) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Schlüssel-JSON des Google-Dienstkontos (muss Bearbeiter im Sheet „NIKOS-Listen“ sein). Falls Netlify wegen der Größe meckert (4-KB-Grenze), nur die Felder `client_email` und `private_key` einfügen. |
| `NIKOS_SECRET` | Zufälliger langer Text (mind. 24 Zeichen) – signiert Login- und Klassifizierungs-Links |
| `REPORT_SECRET`, `REPORT_ALLOWED_RECIPIENTS` | Nur für `/api/seo-report`: Passwort des Aufrufers + erlaubte Empfänger (kommagetrennt) |
| `SITE_URL` | Optional, nur für Tests (Standard: `https://nikos.info`) |

Alle Werte gehören in Netlify – **nie in den Code oder ins Repo**.

## Tests

```
node --test netlify/test/functions.test.mjs
```

Die Tests laufen ohne Netzwerk (Google Sheets und Brevo werden nachgebildet).

## Sicherheit (Unterschiede zu n8n)

- Alle Formularwerte werden in Mails HTML-escaped; Sheet-Einträge werden als reiner Text geschrieben (keine Formeln).
- Klassifizierungs-Links tragen eine Unterschrift; der Klick öffnet nur eine Rückfrage, erst der Button führt aus.
- Zugangs-Tokens sind kryptografisch zufällig; Login-Tokens werden mit `NIKOS_SECRET` signiert (24 h gültig).
- Antworten sind immer `Cache-Control: no-store`; Browser-Zugriff (CORS) nur von nikos.info / nikos.audio.
