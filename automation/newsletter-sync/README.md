# NIKOS Newsletter-Abgleich — GitHub-Actions-Portierung (ohne n8n)

Ersetzt zwei n8n-Workflows durch ein Node.js-Skriptpaar, das täglich in
GitHub Actions läuft (`.github/workflows/newsletter-sync.yml`, 04:00 UTC):

| Schritt | Skript | Ersetzt (n8n) |
|---|---|---|
| 1. Abmeldungen Sheet → Brevo | `abmelde-sync.js` | "NIKOS – Abmelde-Sync (Sheet → Brevo)", ID `9GmhtntRPPRmdFCE` |
| 2. Abonnenten Brevo → Sheet | `brevo-import.js` | Newsletter-Sync, ID `fY1tXDSbXmzvurvm` (aktuell in n8n "NIKOS – Formular-Handling" benannt) |

Beide arbeiten auf dem Blatt **Leads** im Sheet **NIKOS-Listen**. Spalte
`newsletter`: `x` = aktiv, leer = neutral/neu, `-` = abgemeldet.

## Bewusste Unterschiede zu n8n

- **Feste Reihenfolge in einem Lauf** (erst Abmelden, dann Importieren). In n8n
  liefen beide getrennt (Import 23:37, Abmeldung 06:00): der Import konnte ein
  tagsüber gesetztes `-` wieder auf `x` zurückstellen, bevor die Abmeldung lief.
- **`-` im Sheet gewinnt.** Der Import setzt eine abgemeldete Adresse nie wieder auf `x`.
- **Gesperrte Brevo-Kontakte** (emailBlacklisted) werden nie als aktiv markiert.
- **Bestehende Zeilen werden nicht überschrieben.** n8n setzte bei jedem Lauf
  name/firma/telefon/typ/datum neu (auch bei Beratungs-Leads). Hier: nur `newsletter`
  wird auf `x` gesetzt, leere Felder werden aus Brevo ergänzt, `typ`/`datum`
  bleiben unangetastet. Nur unbekannte E-Mails erhalten eine neue Zeile.
- **Seitenweise Brevo-Abfrage.** n8n holte nur die ersten 500 Kontakte.
- **Logs ohne volle E-Mail-Adressen** (`m***@firma.de`), falls die Logs öffentlich sind.

## Secrets (Settings → Secrets and variables → Actions)

- `GOOGLE_SERVICE_ACCOUNT_JSON` — vorhanden. **Das Service-Konto muss zusätzlich dem
  Sheet "NIKOS-Listen" als Bearbeiter freigegeben werden** (die bisherigen Automationen
  nutzen das Sheet "Landingpagedaten").
- `BREVO_API_KEY` — **neu anlegen** (derselbe Key wie im n8n-Credential "Brevo").
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — vorhanden (Erfolgs-/Fehlermeldung).

## Erster Test

1. Actions → "Newsletter-Abgleich" → **Run workflow** (Haken "live" AUS = Probelauf).
   Das Log zeigt, was passieren würde, ohne etwas zu ändern.
2. Passt das Ergebnis, nochmal starten mit Haken "live".
3. Danach die beiden n8n-Workflows deaktivieren.

## Lokal prüfen

```bash
cd automation/newsletter-sync
npm test        # Logik-Tests mit Testdaten, ohne echte API-Aufrufe
```
