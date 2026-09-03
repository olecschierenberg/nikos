'use strict';
/**
 * NEU (2026-09-03, kein n8n-Vorbild): Wiederverwendbare, einmalig geprüft
 * freigegebene Übersetzungen fester Textbausteine (Nutzer-Idee vom
 * 2026-09-03: eine Formulierung, die sich als sprachlich hochwertig
 * erwiesen hat, einmalig mit einem stärkeren Modell erzeugen/prüfen und
 * danach OHNE weiteren KI-Aufruf wiederverwenden — spart Kosten UND
 * garantiert konstante, geprüft gute Formulierung, unabhängig davon,
 * welches Modell gerade produktiv für die übrigen Felder läuft).
 *
 * Dies ist ein GEWÖHNLICHES Node-Modul (require() möglich), wie lib/i18n.js
 * — NICHT eine der lib/nodes/*.js-Pseudo-n8n-Code-Node-Dateien.
 *
 * ERSTER EINTRAG: usp_intro. Der deutsche Ausgangssatz ist in index.js als
 * FIXED_USP_INTRO_DE hart hinterlegt und ändert sich NIE zwischen
 * Kombinationen (reiner Marken-/Plattform-Satz, unabhängig vom konkreten
 * Einsatz/Region). Die folgenden Übersetzungen wurden am 2026-09-03 mit
 * gpt-5.6-terra erzeugt (siehe Vergleich_Terra_vs_Luna_2026-09-03.md) und
 * stichprobenartig geprüft/freigegeben.
 *
 * WICHTIG bei einer inhaltlichen Änderung von FIXED_USP_INTRO_DE
 * (site/automation/lp-generator/index.js): diese Übersetzungen müssen dann
 * neu erzeugt und hier ersetzt werden, sonst weichen sie vom neuen
 * deutschen Satz ab.
 *
 * Fehlt eine Sprache hier (z. B. weil die Baseline später erweitert wird),
 * fällt index.js automatisch auf die frische Modell-Übersetzung für dieses
 * eine Feld zurück — kein Codepfad bricht dadurch.
 */
const USP_INTRO_TRANSLATIONS = {
  en: 'NIKOS combines announcements, alerting, visitor information and control in a single, network-independent platform.',
  fr: 'NIKOS réunit les annonces, l’alerte, l’information des visiteurs et le pilotage au sein d’une plateforme unique, indépendante des réseaux.',
  it: 'NIKOS riunisce annunci, allertamento, informazione dei visitatori e controllo in un\'unica piattaforma indipendente dalla rete.',
  es: 'NIKOS reúne avisos, alarmas, información para visitantes y control en una única plataforma independiente de la red.',
  nl: 'NIKOS bundelt omroepberichten, alarmering, bezoekersinformatie en besturing in één enkel, netonafhankelijk platform.',
  da: 'NIKOS samler meddelelser, alarmering, besøgsinformation og styring i én samlet, netuafhængig platform.',
  pl: 'NIKOS łączy komunikaty, alarmowanie, informowanie uczestników i sterowanie w jednej, niezależnej od sieci platformie.',
};

module.exports = { USP_INTRO_TRANSLATIONS };
