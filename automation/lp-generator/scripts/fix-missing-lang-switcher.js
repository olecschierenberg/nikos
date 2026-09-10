#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Migrationsskript (2026-09-10).
 *
 * HINTERGRUND: Der Nutzer meldete, dass bei
 * loesungen/besucherinformation-iga-ruhrgebiet-2027-dortmund/ (und weiteren
 * Seiten) das Sprachumschaltungs-Menue (Flaggen-Icon rechts oben in der Nav)
 * komplett fehlt. Untersuchung ergab: 112 von 198 `loesungen/<slug>/index.html`
 * -Seiten haben zwar die komplette CSS fuer den Sprachschalter (`.lang-flag`
 * usw., wird von der Node "Feinschliff" ausnahmslos auf jeder Seite
 * eingefuegt), aber das eigentliche HTML-Element
 * `<div class="lang-flag" id="langFlag">...</div>` fehlt. Grund: die
 * aktuellen HTML-Bau-Vorlagen (html_bauen.js, html_bauen_ml.js) enthalten
 * dieses HTML bereits korrekt -- betroffen sind ausschliesslich AELTERE,
 * bereits frueher generierte Seiten (vor Einfuehrung dieses HTML-Blocks in
 * der Vorlage). Es handelt sich also NICHT um einen aktiven Generator-Bug
 * (neu erzeugte Seiten sind bereits korrekt), sondern um eine historische
 * Nachzueglerliste, die per Einmal-Skript aufgeholt werden muss.
 *
 * An der betroffenen Stelle im Markup (in <div class="nav__right">, direkt
 * nach dem Kontakt/Contact-Link) klafft bei allen 112 Seiten eine
 * BYTE-IDENTISCHE Luecke (eine leere, 6-Leerzeichen-eingerueckte Zeile) --
 * verifiziert per exaktem String-Vergleich vor jeder Aenderung. Dieses
 * Skript fuegt an dieser Stelle den bekannten, ueberall sonst identischen
 * HTML-Block ein (1:1 aus einer bereits korrekten Seite uebernommen, siehe
 * z. B. loesungen/besucherinformation-bremer-freimarkt-bremen/index.html).
 * Alle 112 betroffenen Seiten haben LOCAL_FLAG='🇩🇪' (verifiziert) -- das
 * anfaengliche Flaggen-Icon im eingefuegten HTML passt also ueberall.
 *
 * KEINE KI-Aufrufe, KEINE Aenderung an Ueberschrift/Text/FAQ-Inhalten --
 * reiner HTML-Einfuege-Fix, nur bei EXAKTEM 1x-Treffer der bekannten Luecke
 * (sonst Anomalie-Log, nie geraten/teilweise ersetzt).
 *
 * Aufruf: node scripts/fix-missing-lang-switcher.js (Dry-Run) / --live [--limit=N] [--slug=<slug>]
 */

const fs = require('fs');
const path = require('path');

const LIVE = process.argv.includes('--live');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;
const SLUG_ARG = process.argv.find((a) => a.startsWith('--slug='));
const ONLY_SLUG = SLUG_ARG ? SLUG_ARG.split('=')[1] : null;

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const LOESUNGEN_DIR = path.join(REPO_ROOT, 'loesungen');

function log(msg) { console.log(`[fix-missing-lang-switcher] ${msg}`); }

// Exakte, bekannte Luecke im Markup (byte-identisch auf allen 112
// betroffenen Seiten verifiziert, 2026-09-10): Kontakt/Contact-Link, dann
// eine leere eingerueckte Zeile, dann das schliessende </div> von
// nav__right.
const OLD_GAP = '<a href="https://nikos.info/de/kontakt/" class="nav__cta" data-de>Kontakt</a><a href="https://nikos.info/en/contact/" class="nav__cta" data-en>Contact</a>\n' +
  '      \n' +
  '    </div>';

// Ersatz: dieselbe Zeile, danach der vollstaendige lang-flag-HTML-Block (1:1
// aus einer bereits korrekten Seite uebernommen), dann das schliessende
// </div> wie zuvor.
const NEW_BLOCK = `<a href="https://nikos.info/de/kontakt/" class="nav__cta" data-de>Kontakt</a><a href="https://nikos.info/en/contact/" class="nav__cta" data-en>Contact</a>
      <div class="lang-flag" id="langFlag">
        <button class="lang-flag__btn" id="langFlagBtn" aria-haspopup="true" aria-expanded="false"><span class="flag" id="langFlagIcon">🇩🇪</span><span class="chevron">▾</span></button>
        <div class="lang-flag__dropdown" id="langFlagDropdown" role="listbox">
          <button class="lang-flag__option active" data-lang-opt="de"><span class="flag">🇩🇪</span> Deutsch</button>
          <button class="lang-flag__option" data-lang-opt="en"><span class="flag">🇬🇧</span> English</button>
        </div>
      </div>
    </div>`;

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0, pos = 0;
  for (;;) {
    const i = haystack.indexOf(needle, pos);
    if (i === -1) break;
    count++;
    pos = i + needle.length;
  }
  return count;
}

function writeVerified(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  const back = fs.readFileSync(file, 'utf8');
  if (back !== content) throw new Error(`Integritaetspruefung fehlgeschlagen beim Schreiben von ${file}`);
}

function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  let slugs = fs.readdirSync(LOESUNGEN_DIR).filter((d) => {
    return fs.existsSync(path.join(LOESUNGEN_DIR, d, 'index.html'));
  });
  slugs.sort();
  if (ONLY_SLUG) slugs = slugs.filter((s) => s === ONLY_SLUG);
  log(`${slugs.length} Verzeichnis(se) in loesungen/ werden geprueft.`);

  const stats = { qualifying: [], changed: [], alreadyHasSwitcher: [], noGap: [], ambiguous: [] };

  for (const slug of slugs) {
    if (LIMIT && stats.changed.length >= LIMIT) break;
    const file = path.join(LOESUNGEN_DIR, slug, 'index.html');
    const content = fs.readFileSync(file, 'utf8');

    if (content.includes('id="langFlagBtn"')) {
      stats.alreadyHasSwitcher.push(slug);
      continue;
    }

    const n = countOccurrences(content, OLD_GAP);
    if (n === 0) {
      stats.noGap.push(slug);
      continue;
    }
    if (n > 1) {
      stats.ambiguous.push(slug);
      continue;
    }

    stats.qualifying.push(slug);
    log(`[${slug}] Luecke gefunden, Sprachschalter-HTML wird eingefuegt ...`);

    if (LIVE) {
      const newContent = content.split(OLD_GAP).join(NEW_BLOCK);
      writeVerified(file, newContent);
      stats.changed.push(slug);
      log(`[${slug}] OK -- Sprachschalter-HTML eingefuegt und geschrieben.`);
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`Qualifizierend (Luecke exakt 1x gefunden): ${stats.qualifying.length}`);
  console.log(`Tatsaechlich geaendert: ${stats.changed.length}`);
  console.log(`Bereits mit Sprachschalter (uebersprungen): ${stats.alreadyHasSwitcher.length}`);
  console.log(`Luecke nicht gefunden (uebersprungen, BITTE PRUEFEN): ${stats.noGap.length}`);
  if (stats.noGap.length) console.log('  - ' + stats.noGap.join('\n  - '));
  console.log(`Mehrdeutig / >1 Treffer (uebersprungen, BITTE PRUEFEN): ${stats.ambiguous.length}`);
  if (stats.ambiguous.length) console.log('  - ' + stats.ambiguous.join('\n  - '));

  if (!LIVE) console.log('\nDies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main();
