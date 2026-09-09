#!/usr/bin/env node
'use strict';
/**
 * NIKOS Bereinigung (2026-09-09, Nutzer-Auftrag nach der Loeschung der 25
 * Alt-Relikte: "Lische die vier verbliebenen Redirect Stubs jetzt. Ich habe
 * Angst, dass dies spaeter vergessen wird ... Fuehre entsprechende
 * Nebenmassnahmen wie Umleitungsaenderungen durch"): entfernt die letzten 4
 * bewusst zurueckgehaltenen Redirect-Stub-Seiten aus dem EN-Slug-Fix Teil 2
 * (2026-09-08/09), NACHDEM fuer jede der 4 alten URLs eine serverseitige
 * Cloudflare-Umleitungsregel (301, "Redirect Stub loeschen: ...") angelegt
 * und per fetch(redirect:'manual') als aktiv (opaqueredirect) verifiziert
 * wurde -- alte Links/Suchmaschineneintraege werden dadurch weiterhin
 * korrekt umgeleitet, auch wenn die Ursprungsdatei im Repo verschwindet.
 *
 * SICHERHEIT: feste Liste (kein dynamisches Muster), jede Datei wird vor dem
 * Loeschen nochmal gegen die dokumentierte Canonical-URL geprueft (die bei
 * einem Redirect-Stub auf die NEUE Ziel-URL zeigt); bei Abweichung wird
 * NICHTS geloescht und ein Fehler geworfen. --live erforderlich, sonst nur
 * Vorschau.
 */

const fs = require('fs');
const path = require('path');

const LIVE = process.argv.includes('--live');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// [relativer Pfad zum Verzeichnis, erwartete Canonical-URL (= neues Ziel)]
const TARGETS = [
  ['en/lp/besucherinformation-sail-amsterdam-2030', 'https://nikos.info/en/lp/visitor-information-sail-amsterdam-2030/'],
  ['en/lp/besucherlenkung-sail-amsterdam-2030', 'https://nikos.info/en/lp/visitor-guidance-sail-amsterdam-2030/'],
  ['en/lp/besuchersicherheit-gentse-feesten', 'https://nikos.info/en/lp/visitor-safety-gentse-feesten/'],
  ['en/lp/unwetterwarnung-sail-amsterdam-2030', 'https://nikos.info/en/lp/weather-warning-sail-amsterdam-2030/'],
];

function log(msg) { console.log(`[delete-en-redirect-stubs] ${msg}`); }

function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (loescht wirklich)' : 'DRY-RUN (loescht NICHTS, nur Vorschau)'}`);
  log(`${TARGETS.length} Ziel-Verzeichnis(se) in der Liste.`);

  const toDelete = [];
  for (const [rel, expectedCanonical] of TARGETS) {
    const file = path.join(REPO_ROOT, rel, 'index.html');
    if (!fs.existsSync(file)) {
      log(`UEBERSPRUNGEN (existiert nicht mehr): ${rel}`);
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    const m = /<link rel="canonical" href="([^"]+)">/.exec(content);
    const actual = m ? m[1] : '';
    if (actual !== expectedCanonical) {
      throw new Error(`SICHERHEITSABBRUCH: ${rel} hat Canonical "${actual}", erwartet "${expectedCanonical}" -- nichts geloescht, bitte manuell pruefen.`);
    }
    toDelete.push(rel);
  }

  log(`${toDelete.length} Verzeichnis(se) bestaetigt (Canonical-Check bestanden) und werden ${LIVE ? 'geloescht' : 'geloescht werden (Dry-Run)'}.`);
  for (const rel of toDelete) {
    const dir = path.join(REPO_ROOT, rel);
    if (LIVE) {
      fs.rmSync(dir, { recursive: true, force: true });
      log(`GELOESCHT: ${rel}`);
    } else {
      log(`WUERDE LOESCHEN: ${rel}`);
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`${toDelete.length} Verzeichnis(se) ${LIVE ? 'geloescht' : 'wuerden geloescht'}.`);
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main();
