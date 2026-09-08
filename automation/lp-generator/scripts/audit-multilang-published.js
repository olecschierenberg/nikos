#!/usr/bin/env node
'use strict';
/**
 * NIKOS Audit (rein lesend, schreibt NIE ins Sheet): prueft ALLE
 * Sheet-Zeilen, deren pfad-Feld auf das neue Mehrsprachen-URL-Schema
 * (nikos.info/<lang>/lp/<slug>/) zeigt, per HTTP, ob die Seite tatsaechlich
 * live ist (200) -- oder nur im Sheet als erledigt markiert wurde, ohne
 * dass die Datei je committet wurde.
 *
 * HINTERGRUND (Bug gefunden 2026-09-08): .gitignore enthielt eine
 * pauschale Regel "lp/", die JEDES Verzeichnis namens "lp" ignorierte
 * (also auch de/lp, en/lp, ...). Zusaetzlich staged lp-publish.yml's
 * Commit-Schritt nur "lp-preview" und "loesungen", nie die neuen
 * <lang>/lp/-Ordner. lp-publish.js selbst markiert die Sheet-Zeile (via
 * Google-Sheets-API, unabhaengig von Git) aber bereits VOR dem eigentlichen
 * Commit als aktiv=x -- jede seit 2026-09-03 ueber das neue Schema
 * veroeffentlichte Seite wurde dadurch im Sheet als fertig gefuehrt, ist
 * aber nie tatsaechlich live gegangen. Fix (bereits lokal committet,
 * Commit a677ef3, wartet auf deploy.bat): .gitignore-Regel entfernt +
 * git add um "*/lp" ergaenzt.
   *
   * Aufruf: node audit-multilang-published.js
 */

  const https = require('https');
const sheets = require('../lib/sheets.js');

function looksNewScheme(pfad) {
    return /\/[a-z]{2}\/lp\//i.test(String(pfad || ''));
}

function httpHeadOk(url) {
    return new Promise((resolve) => {
          if (!url) return resolve(false);
          const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
                  resolve(res.statusCode >= 200 && res.statusCode < 400);
                  res.resume();
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
                  req.destroy();
                  resolve(false);
          });
          req.end();
    });
}

async function main() {
    const rows = await sheets.readSheetAsItems('Keywordkombinationen');
    const candidates = rows.filter((r) => looksNewScheme(r.json.pfad));

  console.log(`---- ${candidates.length} Zeile(n) mit pfad im neuen Mehrsprachen-Schema (nikos.info/<lang>/lp/<slug>/) ----`);
    let live = 0;
    let broken = 0;
    for (const r of candidates) {
          const j = r.json;
          const ok = await httpHeadOk(j.pfad);
          if (ok) live++;
          else broken++;
          console.log(
                  `Zeile ${j.row_number}: Problem="${j.Problem || ''}" | Einsatz="${j.Einsatz || ''}" | Region="${j.Region || ''}" | pfad="${j.pfad}" | erstellt_am="${j.erstellt_am || ''}" | aktiv="${j.aktiv || ''}" -- HTTP: ${ok ? 'LIVE (200)' : 'KAPUTT (nicht erreichbar / nie committet)'}`
                );
    }
    console.log(`\n---- Zusammenfassung: ${live} tatsaechlich live, ${broken} kaputt (im Sheet als erledigt markiert, aber nie veroeffentlicht) ----`);
}

main().catch((err) => {
    console.error('FEHLER:', err);
    process.exit(1);
});
