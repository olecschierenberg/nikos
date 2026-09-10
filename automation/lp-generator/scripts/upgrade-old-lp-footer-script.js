#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Migrationsskript (2026-09-10, Teil des EN-Inhalte-Bugfixes,
 * siehe scripts/fix-missing-en-content.js fuer den Hauptteil).
 *
 * HINTERGRUND: 36 aeltere `loesungen/<slug>/index.html`-Seiten (aus einer
 * FRUEHEREN Generierungs-Iteration, vor Einfuehrung des IS_DUAL-basierten
 * Sprachschalters) tragen im Footer-<script>-Block noch die ALTE, einfachere
 * Fassung des Sprachschalters: keine IS_DUAL/LOCAL_LANG_CODE/DEFAULT_BUCKET-
 * Variablen, kein gespeichertes Sprach-Gedaechtnis (`setLang('de')` wird beim
 * Laden IMMER fest aufgerufen, unabhaengig vom localStorage-Wert `saved`).
 * Der Hauptteil des Bugfix-Skripts (fix-missing-en-content.js) erkennt
 * "klassische" Seiten nur ueber den Literal-String `var IS_DUAL=false;` und
 * ueberspringt diese 36 Seiten deshalb komplett (Kategorie "nicht
 * IS_DUAL=false, anderer Modus").
 *
 * DIESES SKRIPT ersetzt NUR den Footer-<script>-Block dieser 36 Seiten durch
 * die aktuelle, ueberall sonst verwendete Fassung (siehe z. B.
 * loesungen/besucherinformation-barthelmarkt-manching/index.html) -- macht
 * die Seiten dadurch (a) sprachschalter-technisch gleichwertig zu allen
 * anderen klassischen LPs (Sprachpraeferenz wird jetzt korrekt in
 * localStorage gemerkt statt bei jedem Laden auf 'de' zurueckgesetzt) und (b)
 * fuer den naechsten Lauf von fix-missing-en-content.js automatisch
 * qualifizierend (danach traegt die Seite `var IS_DUAL=false;` wie alle
 * anderen klassischen Seiten). KEINE KI-Aufrufe, KEINE Aenderung an
 * Ueberschrift/Subhead/Intro/USP/FAQ-Inhalten -- reiner Text-Ersatz im
 * <script>-Block, nur bei EXAKTEM 1x-Treffer des bekannten alten Blocks
 * (sonst Anomalie-Log, nie geraten/teilweise ersetzt).
 *
 * Aufruf: node scripts/upgrade-old-lp-footer-script.js (Dry-Run) / --live [--limit=N] [--slug=<slug>]
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

function log(msg) { console.log(`[upgrade-old-lp-footer-script] ${msg}`); }

// Exakter, bekannter ALTER Footer-<script>-Block (byte-identisch auf allen 36
// betroffenen Seiten verifiziert, 2026-09-10).
const OLD_SCRIPT_BLOCK = `<script>
/* Sprachschalter + Mobile-Nav — autark, ohne nikos-footer.js (LP liegt in /lp/) */
(function(){
  function setLang(lang){
    document.documentElement.setAttribute('data-lang',lang);
    try{localStorage.setItem('nk-lang',lang);}catch(e){}
    document.documentElement.lang=lang;
    var icon=document.getElementById('langFlagIcon');
    if(icon) icon.textContent = lang==='en'?'🇬🇧':'🇩🇪';
    document.querySelectorAll('[data-lang-opt]').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-lang-opt')===lang);
    });
  }
  var btn=document.getElementById('langFlagBtn');
  var dd=document.getElementById('langFlagDropdown');
  if(btn&&dd){
    btn.addEventListener('click',function(e){e.stopPropagation();dd.classList.toggle('open');});
    document.addEventListener('click',function(){dd.classList.remove('open');});
    dd.addEventListener('click',function(e){
      var opt=e.target.closest('[data-lang-opt]');
      if(opt){setLang(opt.getAttribute('data-lang-opt'));dd.classList.remove('open');}
    });
  }
  var burger=document.getElementById('navBurger');
  var mob=document.getElementById('navMobile');
  if(burger&&mob){burger.addEventListener('click',function(){mob.classList.toggle('open');});}
  var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}
  setLang('de');
})();
</script>`;

// Aktuelle Fassung (1:1 aus einer bereits gefixten klassischen LP uebernommen).
const NEW_SCRIPT_BLOCK = `<script>
/* Sprachschalter + Mobile-Nav — autark, ohne nikos-footer.js (LP liegt in /lp/) */
(function(){
  var LOCAL_FLAG='🇩🇪';var LOCAL_LANG_CODE='de';var DEFAULT_BUCKET='de';var IS_DUAL=false;
  function setLang(lang){
    document.documentElement.setAttribute('data-lang',lang);
    var storeVal=(lang==='de')?LOCAL_LANG_CODE:'en';
    try{localStorage.setItem('nk-lang',storeVal);}catch(e){}
    document.documentElement.lang=(lang==='de'?LOCAL_LANG_CODE:'en');
    var icon=document.getElementById('langFlagIcon');
    if(icon) icon.textContent = lang==='en'?'🇬🇧':LOCAL_FLAG;
    document.querySelectorAll('[data-lang-opt]').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-lang-opt')===lang);
    });
  }
  var btn=document.getElementById('langFlagBtn');
  var dd=document.getElementById('langFlagDropdown');
  if(btn&&dd){
    btn.addEventListener('click',function(e){e.stopPropagation();dd.classList.toggle('open');});
    document.addEventListener('click',function(){dd.classList.remove('open');});
    dd.addEventListener('click',function(e){
      var opt=e.target.closest('[data-lang-opt]');
      if(opt){setLang(opt.getAttribute('data-lang-opt'));dd.classList.remove('open');}
    });
  }
  var burger=document.getElementById('navBurger');
  var mob=document.getElementById('navMobile');
  if(burger&&mob){burger.addEventListener('click',function(){mob.classList.toggle('open');});}
  var LANG_ALIASES={'nb':'no','nn':'no'};
  function normLang(c){c=(c||'').toLowerCase();return LANG_ALIASES[c]||c;}
  var saved;try{saved=localStorage.getItem('nk-lang');}catch(e){}
  var _pref='';
  if(saved==='en'){_pref='en';}else if(saved&&normLang(saved)===normLang(LOCAL_LANG_CODE)){_pref='de';}
  if(!_pref){
    if(IS_DUAL){
      var _bl='';try{_bl=((navigator.languages&&navigator.languages[0])||navigator.language||'').toLowerCase().slice(0,2);}catch(e){}
      _pref = (normLang(_bl)===normLang(LOCAL_LANG_CODE)) ? 'de' : 'en';
    } else {
      _pref = DEFAULT_BUCKET;
    }
  }
  if(!IS_DUAL && _pref==='en'){_pref=DEFAULT_BUCKET;}
  setLang(_pref);
  if(IS_DUAL){document.addEventListener('click',function(e){var a=e.target.closest('a[href*="nikos.info"]');if(a){try{localStorage.setItem('nk-lang','en');}catch(err){}}});}
})();
</script>`;

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

  const stats = { qualifying: [], changed: [], alreadyNew: [], noOldBlock: [], ambiguous: [] };

  for (const slug of slugs) {
    if (LIMIT && stats.changed.length >= LIMIT) break;
    const file = path.join(LOESUNGEN_DIR, slug, 'index.html');
    const content = fs.readFileSync(file, 'utf8');

    if (content.includes('var IS_DUAL=')) {
      stats.alreadyNew.push(slug);
      continue;
    }

    const n = countOccurrences(content, OLD_SCRIPT_BLOCK);
    if (n === 0) {
      stats.noOldBlock.push(slug);
      continue;
    }
    if (n > 1) {
      stats.ambiguous.push(slug);
      continue;
    }

    stats.qualifying.push(slug);
    log(`[${slug}] alter Footer-Script-Block gefunden, wird ersetzt ...`);

    if (LIVE) {
      const newContent = content.split(OLD_SCRIPT_BLOCK).join(NEW_SCRIPT_BLOCK);
      writeVerified(file, newContent);
      stats.changed.push(slug);
      log(`[${slug}] OK -- Footer-Script aktualisiert und geschrieben.`);
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`Qualifizierend (alter Block exakt 1x gefunden): ${stats.qualifying.length}`);
  console.log(`Tatsaechlich geaendert: ${stats.changed.length}`);
  console.log(`Bereits aktuelle Fassung (IS_DUAL vorhanden, uebersprungen): ${stats.alreadyNew.length}`);
  console.log(`Alter Block nicht gefunden (uebersprungen): ${stats.noOldBlock.length}`);
  if (stats.noOldBlock.length) console.log('  - ' + stats.noOldBlock.join('\n  - '));
  console.log(`Mehrdeutig / >1 Treffer (uebersprungen, BITTE PRUEFEN): ${stats.ambiguous.length}`);
  if (stats.ambiguous.length) console.log('  - ' + stats.ambiguous.join('\n  - '));

  if (!LIVE) console.log('\nDies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main();
