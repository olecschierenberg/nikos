#!/usr/bin/env node
'use strict';
/**
 * NIKOS Bereinigung (2026-09-09, Nutzer-Auftrag nach dem Bestandsaudit
 * audit-lp-inventory.js: "Ja, alle 25 jetzt loeschen"): entfernt die 25
 * bestaetigten Alt-Relikte aus der Vor-Migrations-Aera (git-erstellt
 * 2026-07-08, VOR der n8n-Abloesung 2026-09-01), die im Live-Sheet-Audit
 * (Lauf 34377674027) OHNE jede Sheet-Zeile gefunden wurden UND fuer die
 * (bis auf die 2 Gent-Faelle, die von den aktuell korrekt getrackten
 * de|nl/lp/*gentse-feesten*-Seiten bereits abgedeckt sind) keine aktuelle
 * Sheet-/ML-Entsprechung existiert.
 *
 * BEWUSST NICHT geloescht (siehe Memory nikos-landingpages-seo.md):
 *  - die 4 en/lp/*-sail-amsterdam-2030 bzw. -gentse-feesten Redirect-Stubs
 *    aus dem EN-Slug-Fix Teil 2 (canonical zeigt korrekt auf neue URL,
 *    geplanter Abbau erst in 3-6 Monaten laut bestehender Entscheidung).
 *
 * SICHERHEIT: liste ist FEST (kein dynamisches "alles ohne Sheet-Zeile
 * loeschen" -- verhindert, dass ein kuenftiger Sheet-Lese-Fehler versehentlich
 * frisch veroeffentlichte Seiten mitreisst). Vor dem Loeschen wird JEDE
 * Datei nochmal gegen die im Audit-Log dokumentierte Canonical-URL geprueft
 * (Sicherheitsnetz gegen Tippfehler in der Liste); bei Abweichung wird
 * NICHTS geloescht und ein Fehler geworfen. --live erforderlich, sonst nur
 * Vorschau.
 */

const fs = require('fs');
const path = require('path');

const LIVE = process.argv.includes('--live');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// [relativer Pfad zum Verzeichnis, erwartete Canonical-URL laut Audit-Log]
const TARGETS = [
  ['loesungen/alarmierung-sachsen-anhalt-tag-2028-aschersleben', 'https://nikos.info/loesungen/alarmierung-sachsen-anhalt-tag-2028-aschersleben/'],
  ['loesungen/alarmierung-tag-der-deutschen-einheit-2027-duesseldorf', 'https://nikos.info/loesungen/alarmierung-tag-der-deutschen-einheit-2027-duesseldorf/'],
  ['loesungen/ansagetechnik-sail-bremerhaven-bremerhaven', 'https://nikos.info/loesungen/ansagetechnik-sail-bremerhaven-bremerhaven/'],
  ['loesungen/besucherlenkung-basel-tattoo-basel', 'https://nikos.info/loesungen/besucherlenkung-basel-tattoo-basel/'],
  ['loesungen/besucherlenkung-katholikentag-paderborn', 'https://nikos.info/loesungen/besucherlenkung-katholikentag-paderborn/'],
  ['loesungen/besuchersicherheit-basel-tattoo-basel', 'https://nikos.info/loesungen/besuchersicherheit-basel-tattoo-basel/'],
  ['loesungen/bezoekersveiligheid-stadsfeest-gent', 'https://nikos.info/loesungen/bezoekersveiligheid-stadsfeest-gent/'],
  ['loesungen/crowd-management-basel-tattoo-basel', 'https://nikos.info/loesungen/crowd-management-basel-tattoo-basel/'],
  ['loesungen/crowd-management-bremer-freimarkt-bremen', 'https://nikos.info/loesungen/crowd-management-bremer-freimarkt-bremen/'],
  ['loesungen/crowd-management-hamburger-hafengeburtstag-hamburg', 'https://nikos.info/loesungen/crowd-management-hamburger-hafengeburtstag-hamburg/'],
  ['loesungen/crowdmanagement-carnaval-bezoekerssturing-aalst', 'https://nikos.info/loesungen/crowdmanagement-carnaval-bezoekerssturing-aalst/'],
  ['loesungen/crowdmanagement-gentse-feesten-gent', 'https://nikos.info/loesungen/crowdmanagement-gentse-feesten-gent/'],
  ['loesungen/emergency-warning-system-glastonbury-festival-glastonbury', 'https://nikos.info/loesungen/emergency-warning-system-glastonbury-festival-glastonbury/'],
  ['loesungen/evakueringsvarsling-bergenfest-bergen', 'https://nikos.info/loesungen/evakueringsvarsling-bergenfest-bergen/'],
  ['loesungen/evakuierung-tomorrowland-winter-alpe-d-huez', 'https://nikos.info/loesungen/evakuierung-tomorrowland-winter-alpe-d-huez/'],
  ['loesungen/evakuierungsansage-basel-tattoo-basel', 'https://nikos.info/loesungen/evakuierungsansage-basel-tattoo-basel/'],
  ['loesungen/lichtmasten-fernsteuern-hamburger-hafengeburtstag-hamburg', 'https://nikos.info/loesungen/lichtmasten-fernsteuern-hamburger-hafengeburtstag-hamburg/'],
  ['loesungen/nodvarsling-bergenfest-bergen', 'https://nikos.info/loesungen/nodvarsling-bergenfest-bergen/'],
  ['loesungen/nooddoorgave-carnaval-aalst', 'https://nikos.info/loesungen/nooddoorgave-carnaval-aalst/'],
  ['loesungen/notfalldurchsage-basel-tattoo-basel', 'https://nikos.info/loesungen/notfalldurchsage-basel-tattoo-basel/'],
  ['loesungen/notfallwarnsystem-basel-tattoo-basel', 'https://nikos.info/loesungen/notfallwarnsystem-basel-tattoo-basel/'],
  ['loesungen/sprachalarmierung-basel-tattoo-basel', 'https://nikos.info/loesungen/sprachalarmierung-basel-tattoo-basel/'],
  ['loesungen/sprachalarmierung-internationales-strassenfest-sindelfingen', 'https://nikos.info/loesungen/sprachalarmierung-internationales-strassenfest-sindelfingen/'],
  ['loesungen/sprachalarmierung-nrw-tag-duesseldorf', 'https://nikos.info/loesungen/sprachalarmierung-nrw-tag-duesseldorf/'],
  ['loesungen/unwetterwarnung-basel-tattoo-basel', 'https://nikos.info/loesungen/unwetterwarnung-basel-tattoo-basel/'],
];

function log(msg) { console.log(`[delete-legacy-orphan-lps] ${msg}`); }

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
