#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Migrationsskript (2026-09-11).
 *
 * HINTERGRUND: Nutzer-Meldung: auf einer englischen Seitenansicht fuehrte
 * ein englischer Link in der "More examples"-Box (verwandte_verlinken.js,
 * siehe Bugfix vom 2026-09-10) auf die DEUTSCHE Ansicht der Zielseite,
 * obwohl der Linktext korrekt Englisch war. Ursache lag NICHT im Linktext
 * (der ist bereits korrekt bilingual), sondern im Sprachschalter-Bootstrap-
 * <script>-Block, der auf JEDER loesungen/<slug>/index.html-Seite eingebettet
 * ist: eine bereits per localStorage gemerkte EN-Praeferenz wird beim Laden
 * einer "einsprachigen" Seite (IS_DUAL=false, das sind praktisch alle
 * loesungen/-Seiten) ABSICHTLICH wieder auf Deutsch (DEFAULT_BUCKET)
 * zurueckgesetzt -- das ist fuer direkte/organische Besucher sinnvoll
 * (verhindert, dass ein zufaelliger alter EN-Wert aus einem ganz anderen
 * Website-Bereich eine SEO-Landingpage faelschlich englisch zeigt), macht
 * aber eine gezielte interne Verlinkung auf die EN-Ansicht einer anderen
 * Seite unmoeglich.
 *
 * FIX: verwandte_verlinken.js haengt an jeden Anker jetzt explizit
 * ?lang=de bzw. ?lang=en an (siehe dortiger Kommentar). Dieses Skript
 * patcht den Sprachschalter-Bootstrap-<script>-Block auf allen bestehenden
 * Seiten so, dass ein vorhandener ?lang=-URL-Parameter als hoechste
 * Prioritaet gilt und die automatische Ruecksetzung auf Deutsch fuer DIESEN
 * Seitenaufruf aushebelt -- ohne das bestehende Default-Verhalten fuer
 * Besucher ohne diesen Parameter zu aendern.
 *
 * Drei bekannte Skript-Varianten im aktuellen Bestand (2026-09-11 per
 * Vollpruefung ALLER 198 Seiten verifiziert, per exaktem Block-Vergleich
 * auf genau 3 unterschiedliche Textvarianten reduziert):
 *  - "Standard" (106 Seiten): traegt `var IS_DUAL=false;` UND die neuere
 *    normLang()/LANG_ALIASES-Fassung der Praeferenz-Logik (`var _pref='';
 *    if(saved==='en'){...}else if(saved&&normLang(saved)===...`). Zwei
 *    gezielte Aenderungen: Parameter-Erkennung ergaenzen, Rueckfall-Zeile
 *    um `&& !_qsLang` ergaenzen.
 *  - "Standard-B" (81 Seiten): ebenfalls `var IS_DUAL=false;`, aber eine
 *    AELTERE Zwischenfassung der Praeferenz-Logik ohne normLang()
 *    (`var _pref=saved; if(_pref!=='de'&&_pref!=='en'){...`). Gleiche
 *    Zwei-Aenderungen-Strategie, andere exakte Ankertexte.
 *  - "Legacy" (11 Seiten, aeltere Generator-Iteration ganz ohne IS_DUAL-
 *    Variable, aber bereits vollstaendig zweisprachig): eine gezielte
 *    Ein-Zeilen-Aenderung (`setLang(saved==='en'?'en':'de')` wird um die
 *    Parameter-Pruefung ergaenzt).
 * Diese Vorlage (html_bauen.js) ist ebenfalls bereits entsprechend
 * angepasst (auf die "Standard"-Fassung), betrifft also nur kuenftig NEU
 * erzeugte Seiten automatisch; dieses Skript holt die BESTEHENDEN Seiten
 * (alle drei Varianten) nach.
 *
 * KEINE KI-Aufrufe, KEINE Aenderung an Ueberschrift/Text/FAQ-Inhalten --
 * reiner Text-Ersatz im <script>-Block, nur bei EXAKTEM 1x-Treffer der
 * jeweils bekannten Zeile(n) (sonst Anomalie-Log, nie geraten/teilweise
 * ersetzt).
 *
 * Aufruf: node scripts/fix-lang-persistence-footer-script.js (Dry-Run) / --live [--limit=N] [--slug=<slug>]
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

function log(msg) { console.log(`[fix-lang-persistence-footer-script] ${msg}`); }

// ---- Variante "Standard" (IS_DUAL=false, 187 Seiten) -----------------

const STD_MARKER = "var IS_DUAL=false;";

const STD_OLD_1 =
  "var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}\n" +
  "  var _pref='';\n" +
  "  if(saved==='en'){_pref='en';}else if(saved&&normLang(saved)===normLang(LOCAL_LANG_CODE)){_pref='de';}";

const STD_NEW_1 =
  "var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}\n" +
  "  var _qsLang='';try{var _q=new URLSearchParams(location.search).get('lang');if(_q==='de'||_q==='en'){_qsLang=_q;}}catch(e){}\n" +
  "  var _pref='';\n" +
  "  if(_qsLang){_pref=_qsLang;}else if(saved==='en'){_pref='en';}else if(saved&&normLang(saved)===normLang(LOCAL_LANG_CODE)){_pref='de';}";

const STD_OLD_2 = "if(!IS_DUAL && _pref==='en'){_pref=DEFAULT_BUCKET;}";
const STD_NEW_2 = "if(!IS_DUAL && _pref==='en' && !_qsLang){_pref=DEFAULT_BUCKET;}";

// ---- Variante "Standard-B" (IS_DUAL=false, aeltere Zwischenfassung ohne
//      normLang(), 81 Seiten) -----------------------------------------

const STDB_MARKER = "var _pref=saved;";

const STDB_OLD_1 =
  "var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}\n" +
  "  var _pref=saved;";

const STDB_NEW_1 =
  "var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}\n" +
  "  var _qsLang='';try{var _q=new URLSearchParams(location.search).get('lang');if(_q==='de'||_q==='en'){_qsLang=_q;}}catch(e){}\n" +
  "  var _pref=_qsLang||saved;";

const STDB_OLD_2 = STD_OLD_2; // identisch in dieser Variante
const STDB_NEW_2 = STD_NEW_2;

// ---- Variante "Legacy" (ohne IS_DUAL, 11 Seiten) ----------------------

const LEGACY_OLD =
  "var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}\n" +
  "  setLang(saved==='en'?'en':'de');";

const LEGACY_NEW =
  "var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}\n" +
  "  var _qsLang='';try{var _q=new URLSearchParams(location.search).get('lang');if(_q==='de'||_q==='en'){_qsLang=_q;}}catch(e){}\n" +
  "  setLang(_qsLang||(saved==='en'?'en':'de'));";

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

  const stats = {
    stdQualifying: [], stdChanged: [], stdAlready: [], stdAmbiguous: [],
    stdbQualifying: [], stdbChanged: [], stdbAlready: [], stdbAmbiguous: [],
    legacyQualifying: [], legacyChanged: [], legacyAlready: [], legacyAmbiguous: [],
    unrecognized: [],
  };

  for (const slug of slugs) {
    if (LIMIT && (stats.stdChanged.length + stats.stdbChanged.length + stats.legacyChanged.length) >= LIMIT) break;
    const file = path.join(LOESUNGEN_DIR, slug, 'index.html');
    const content = fs.readFileSync(file, 'utf8');

    if (content.includes('_qsLang')) {
      // bereits gepatcht (egal welche Variante)
      if (content.includes(STDB_MARKER)) stats.stdbAlready.push(slug);
      else if (content.includes(STD_MARKER)) stats.stdAlready.push(slug);
      else stats.legacyAlready.push(slug);
      continue;
    }

    if (content.includes(STDB_MARKER)) {
      const n1 = countOccurrences(content, STDB_OLD_1);
      const n2 = countOccurrences(content, STDB_OLD_2);
      if (n1 !== 1 || n2 !== 1) {
        stats.stdbAmbiguous.push(`${slug} (n1=${n1}, n2=${n2})`);
        continue;
      }
      stats.stdbQualifying.push(slug);
      log(`[${slug}] Standard-B-Variante, wird gepatcht ...`);
      if (LIVE) {
        let nc = content.split(STDB_OLD_1).join(STDB_NEW_1);
        nc = nc.split(STDB_OLD_2).join(STDB_NEW_2);
        writeVerified(file, nc);
        stats.stdbChanged.push(slug);
        log(`[${slug}] OK -- Standard-B-Skript gepatcht.`);
      }
      continue;
    }

    if (content.includes(STD_MARKER)) {
      const n1 = countOccurrences(content, STD_OLD_1);
      const n2 = countOccurrences(content, STD_OLD_2);
      if (n1 !== 1 || n2 !== 1) {
        stats.stdAmbiguous.push(`${slug} (n1=${n1}, n2=${n2})`);
        continue;
      }
      stats.stdQualifying.push(slug);
      log(`[${slug}] Standard-Variante, wird gepatcht ...`);
      if (LIVE) {
        let nc = content.split(STD_OLD_1).join(STD_NEW_1);
        nc = nc.split(STD_OLD_2).join(STD_NEW_2);
        writeVerified(file, nc);
        stats.stdChanged.push(slug);
        log(`[${slug}] OK -- Standard-Skript gepatcht.`);
      }
      continue;
    }

    const nLegacy = countOccurrences(content, LEGACY_OLD);
    if (nLegacy === 1) {
      stats.legacyQualifying.push(slug);
      log(`[${slug}] Legacy-Variante, wird gepatcht ...`);
      if (LIVE) {
        const nc = content.split(LEGACY_OLD).join(LEGACY_NEW);
        writeVerified(file, nc);
        stats.legacyChanged.push(slug);
        log(`[${slug}] OK -- Legacy-Skript gepatcht.`);
      }
      continue;
    }
    if (nLegacy > 1) {
      stats.legacyAmbiguous.push(slug);
      continue;
    }

    stats.unrecognized.push(slug);
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`Standard-Variante qualifizierend: ${stats.stdQualifying.length}`);
  console.log(`Standard-Variante tatsaechlich geaendert: ${stats.stdChanged.length}`);
  console.log(`Standard-Variante bereits gepatcht: ${stats.stdAlready.length}`);
  console.log(`Standard-Variante mehrdeutig (BITTE PRUEFEN): ${stats.stdAmbiguous.length}`);
  if (stats.stdAmbiguous.length) console.log('  - ' + stats.stdAmbiguous.join('\n  - '));
  console.log(`Standard-B-Variante qualifizierend: ${stats.stdbQualifying.length}`);
  console.log(`Standard-B-Variante tatsaechlich geaendert: ${stats.stdbChanged.length}`);
  console.log(`Standard-B-Variante bereits gepatcht: ${stats.stdbAlready.length}`);
  console.log(`Standard-B-Variante mehrdeutig (BITTE PRUEFEN): ${stats.stdbAmbiguous.length}`);
  if (stats.stdbAmbiguous.length) console.log('  - ' + stats.stdbAmbiguous.join('\n  - '));
  console.log(`Legacy-Variante qualifizierend: ${stats.legacyQualifying.length}`);
  console.log(`Legacy-Variante tatsaechlich geaendert: ${stats.legacyChanged.length}`);
  console.log(`Legacy-Variante bereits gepatcht: ${stats.legacyAlready.length}`);
  console.log(`Legacy-Variante mehrdeutig (BITTE PRUEFEN): ${stats.legacyAmbiguous.length}`);
  if (stats.legacyAmbiguous.length) console.log('  - ' + stats.legacyAmbiguous.join('\n  - '));
  console.log(`Nicht erkannt / anderes Skript-Muster (uebersprungen, BITTE PRUEFEN): ${stats.unrecognized.length}`);
  if (stats.unrecognized.length) console.log('  - ' + stats.unrecognized.join('\n  - '));

  if (!LIVE) console.log('\nDies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main();

