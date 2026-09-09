#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-09, Teil 3 des EN-Slug-Bugfixes):
 * Vier bereits LIVE stehende Auslands-Landingpages (primaerLang=en) wurden
 * noch mit dem alten, gebuggten Code erzeugt (vor Commit 05d4dd7) und tragen
 * deshalb einen unuebersetzten deutschen Slug in ihrer eigenen englischen URL,
 * z.B. https://nikos.info/en/lp/besucherinformation-sail-amsterdam-2030/
 * statt .../visitor-information-sail-amsterdam-2030/.
 *
 * Der Pipeline-Code ist laengst gefixt (05d4dd7) und der naechste automatische
 * Lauf wuerde diese vier Seiten irgendwann neu erzeugen -- aber der Nutzer
 * will es JETZT manuell, schnell und nachvollziehbar erledigt haben, statt auf
 * mehrere Generator-/Publish-Zyklen zu warten und danach noch Redirects von
 * Hand nachzuziehen.
 *
 * Dieses Skript macht pro betroffener Seite in EINEM Rutsch:
 *  1. Verschiebt den Seiteninhalt von en/lp/<alterSlug>/ nach en/lp/<neuerSlug>/
 *     (Selbstreferenzen darin -- canonical/hreflang-en/x-default/og:url/
 *     Sprachumschalter -- werden dabei auf die neue URL aktualisiert).
 *  2. Ersetzt en/lp/<alterSlug>/index.html durch einen Redirect-Stub
 *     (meta-refresh + canonical + noscript + JS location.replace) zur neuen URL.
 *  3. Ersetzt REPO-WEIT (ausser backups/ und lp-preview/) jedes Vorkommen der
 *     alten URL durch die neue -- das korrigiert hreflang/Sprachumschalter in
 *     allen 7 Schwestersprachen sowie die Verlinkung in sitemap.xml und
 *     loesungen/index.html (Hub-Seite), sodass niemand mehr ueber einen
 *     Redirect-Umweg gehen muss.
 *
 * Die neuen Slugs wurden aus Title/H1 der jeweiligen Seite abgeleitet und mit
 * den bereits korrekten Nachbarseiten crowd-management-gentse-feesten /
 * crowd-management-sail-amsterdam-2030 (Stil: <keyword>-<event>[-jahr]) auf
 * Konsistenz geprueft; alle vier Ziel-Slugs sind aktuell frei (keine Kollision).
 *
 * Aufruf: node fix-en-slugs-batch-rename.js (Dry-Run) / --live (schreibt wirklich)
 */

const fs = require('fs');
const path = require('path');

const LIVE = process.argv.includes('--live');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const BASE_URL = 'https://nikos.info';

const MAPPINGS = [
  { oldSlug: 'besucherinformation-sail-amsterdam-2030', newSlug: 'visitor-information-sail-amsterdam-2030' },
  { oldSlug: 'besucherlenkung-sail-amsterdam-2030', newSlug: 'visitor-guidance-sail-amsterdam-2030' },
  { oldSlug: 'besuchersicherheit-gentse-feesten', newSlug: 'visitor-safety-gentse-feesten' },
  { oldSlug: 'unwetterwarnung-sail-amsterdam-2030', newSlug: 'weather-warning-sail-amsterdam-2030' },
];

const EXCLUDE_DIR_PREFIXES = ['backups' + path.sep, 'lp-preview' + path.sep, '.git' + path.sep, 'node_modules' + path.sep];

function log(msg) { console.log(`[fix-en-slugs-batch-rename] ${msg}`); }

function redirectStub(newUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=${newUrl}">
<link rel="canonical" href="${newUrl}">
<title>Redirecting... - NIKOS</title>
<script>location.replace(${JSON.stringify(newUrl)});</script>
</head>
<body>
<noscript><p>This page has moved. <a href="${newUrl}">Continue to the new page</a>.</p></noscript>
<p>This page has moved to <a href="${newUrl}">${newUrl}</a>.</p>
</body>
</html>
`;
}

function walkFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(REPO_ROOT, path.join(dir, entry.name));
    if (EXCLUDE_DIR_PREFIXES.some((p) => (rel + path.sep).startsWith(p))) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.xml'))) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  // Schritt 0: pruefen, dass alle alten Seiten existieren und neuen Slugs frei sind.
  for (const m of MAPPINGS) {
    const oldFile = path.join(REPO_ROOT, 'en', 'lp', m.oldSlug, 'index.html');
    const newDir = path.join(REPO_ROOT, 'en', 'lp', m.newSlug);
    if (!fs.existsSync(oldFile)) {
      log(`ABBRUCH: ${oldFile} existiert nicht -- nichts angefasst.`);
      return;
    }
    if (fs.existsSync(newDir)) {
      log(`ABBRUCH: Zielverzeichnis en/lp/${m.newSlug}/ existiert bereits -- nichts angefasst.`);
      return;
    }
    log(`OK: en/lp/${m.oldSlug}/ gefunden, Ziel en/lp/${m.newSlug}/ ist frei.`);
  }

  // Schritt 1: Originalinhalt jeder alten Seite sichern, BEVOR irgendwas ersetzt wird.
  const originals = new Map();
  for (const m of MAPPINGS) {
    const oldFile = path.join(REPO_ROOT, 'en', 'lp', m.oldSlug, 'index.html');
    originals.set(m.oldSlug, fs.readFileSync(oldFile, 'utf8'));
  }

  // Schritt 2: repo-weite Text-Ersetzung alte URL -> neue URL, in allen .html/.xml
  // Dateien (ausser backups/, lp-preview/). Das korrigiert Schwesterseiten,
  // sitemap.xml und loesungen/index.html in einem Rutsch.
  const allFiles = walkFiles(REPO_ROOT, []);
  let totalReplacements = 0;
  const touchedFiles = [];
  for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let fileChanged = false;
    for (const m of MAPPINGS) {
      const oldUrl = `${BASE_URL}/en/lp/${m.oldSlug}/`;
      const newUrl = `${BASE_URL}/en/lp/${m.newSlug}/`;
      const count = content.split(oldUrl).length - 1;
      if (count > 0) {
        content = content.split(oldUrl).join(newUrl);
        totalReplacements += count;
        fileChanged = true;
      }
    }
    if (fileChanged) {
      touchedFiles.push({ file: path.relative(REPO_ROOT, file), content });
    }
  }
  log(`Repo-weite Ersetzung: ${totalReplacements} Vorkommen in ${touchedFiles.length} Dateien betroffen.`);
  if (!LIVE) {
    for (const t of touchedFiles) log(`  (TEST) wuerde aendern: ${t.file}`);
  } else {
    for (const t of touchedFiles) {
      fs.writeFileSync(path.join(REPO_ROOT, t.file), t.content, 'utf8');
    }
    log(`Geschrieben: ${touchedFiles.length} Dateien aktualisiert.`);
  }

  // Schritt 3: neue Zielseite aus dem GESICHERTEN Originalinhalt erzeugen
  // (Selbstreferenzen darin ebenfalls alt->neu ersetzt), alte Seite durch
  // Redirect-Stub ersetzen.
  for (const m of MAPPINGS) {
    const oldUrl = `${BASE_URL}/en/lp/${m.oldSlug}/`;
    const newUrl = `${BASE_URL}/en/lp/${m.newSlug}/`;
    const newContent = originals.get(m.oldSlug).split(oldUrl).join(newUrl);
    const newDir = path.join(REPO_ROOT, 'en', 'lp', m.newSlug);
    const newFile = path.join(newDir, 'index.html');
    const oldFile = path.join(REPO_ROOT, 'en', 'lp', m.oldSlug, 'index.html');
    const stub = redirectStub(newUrl);

    if (!LIVE) {
      log(`(TEST) wuerde neu anlegen: en/lp/${m.newSlug}/index.html (Inhalt von altem en/lp/${m.oldSlug}/ übernommen)`);
      log(`(TEST) wuerde ersetzen:   en/lp/${m.oldSlug}/index.html -> Redirect-Stub nach ${newUrl}`);
    } else {
      fs.mkdirSync(newDir, { recursive: true });
      fs.writeFileSync(newFile, newContent, 'utf8');
      fs.writeFileSync(oldFile, stub, 'utf8');
      log(`ERSTELLT: en/lp/${m.newSlug}/index.html`);
      log(`REDIRECT: en/lp/${m.oldSlug}/index.html -> ${newUrl}`);
    }
  }

  console.log('\n---- Fertig ----');
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
