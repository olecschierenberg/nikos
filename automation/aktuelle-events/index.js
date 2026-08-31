#!/usr/bin/env node
'use strict';
/**
 * NIKOS Aktuelle-Events-Recherche — GitHub-Actions-Portierung des n8n-
 * Workflows "Aktuelle Events" (Workflow-ID 8xWFAzCU5aU0DNuM).
 *
 * Ablauf (1:1 aus dem n8n-Workflow, siehe dortige Connections):
 *   Stadt-Fakten lesen + Erlaubte Regionen lesen -> Sheet-Stand aufbereiten
 *   (Code) -> Message a model (OpenAI, Websuche) -> JSON parsen (Code)
 *   -> Updates aufsplitten -> Updates bereinigen (Code) -> Neue Region? (IF)
 *   -> Neue Region anlegen (append) / Aktuell+Events aktualisieren (update)
 *   -> Stadt-Fakten sortieren (batchUpdate sortRange).
 *
 * BEWUSSTE AENDERUNG ggue. dem n8n-Original (Absprache 2026-08-31, "mehr
 * Auslandsevents finden"): Statt EINEM biwoechentlichen Lauf am 1./15., der
 * am 15. alle ~30 uebrigen Laender in einer einzigen, sehr breiten Anfrage
 * durchsucht (geringe Trefferquote pro Land), rotiert dieser Port
 * WOECHENTLICH durch kleine Laendergruppen (siehe ROTATION unten) UND traegt
 * dem Modell im User-Prompt ausdruecklich auf, pro Land im Suchbereich
 * mehrere gezielte Anfragen zu stellen (siehe lib/prompts/aktuelle-events.
 * user.txt, Abschnitt "DIESER LAUF IST EIN AUSLANDS-LAUF"). Ergebnis: mehr
 * Laeufe insgesamt, dafuer jeweils enger/tiefer fokussiert -> mehr
 * gefundene Auslandsevents ueber die Zeit, DE+AT bleibt weiterhin
 * woechentlich abgedeckt.
 *
 * ROTATION:
 *   Montags (Cron 1) -> "core"-Lauf: DE + AT (wie im n8n-Original der
 *   1.-des-Monats-Lauf, jetzt aber jede Woche statt alle 2 Wochen).
 *   Donnerstags (Cron 2) -> "foreign"-Lauf: EINE Gruppe von ca. 6 Laendern
 *   aus der "Erlaubte Regionen"-Liste, rotierend nach ISO-Kalenderwoche
 *   (kompletter Zyklus je nach Laenderzahl i. d. R. alle 5-7 Wochen).
 *   Manueller Dispatch ohne --scope -> Default "core" (schneller, guenstiger
 *   Testlauf); "--scope=foreign" fuer einen gezielten Auslands-Testlauf.
 *
 * SICHERHEITSDESIGN (siehe README.md):
 *  - TEST-Modus (Standard): ruft OpenAI ganz normal auf (Websuche kostet in
 *    beiden Modi gleich), schreibt aber NICHTS ins Sheet — nur Logging, was
 *    geschrieben WUERDE.
 *  - Erst --live schreibt neue/aktualisierte Zeilen in "Stadt-Fakten" und
 *    sortiert das Blatt neu.
 */

const path = require('path');
const fs = require('fs');
const { DateTime } = require('luxon');
const sheets = require('./lib/sheets');
const { webSearchCompletion } = require('./lib/openaiWebSearch');

const PROMPTS_DIR = path.join(__dirname, 'lib', 'prompts');
const LIVE = process.argv.includes('--live');
const STADT_FAKTEN_TAB = 'Stadt-Fakten';
const REGIONEN_SHEET_ID = '1_JhSXcyg9IEtrMqBSSx0Pt616emHrLsmUx4kH5_umwQ';
const REGIONEN_TAB_GID = 1498711867; // gid des Tabs "Erlaubte Regionen" (wie im n8n-Original per ID referenziert)
const GROUP_SIZE = 6;
const CORE_CRON = '0 6 * * 1';
const FOREIGN_CRON = '0 6 * * 4';

function log(msg) { console.log(`[aktuelle-events] ${msg}`); }
function readPrompt(name) { return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf8'); }
function uniq(arr) { const seen = {}; const out = []; for (const v of arr) { if (v && !seen[v]) { seen[v] = true; out.push(v); } } return out; }
function isTrue(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; }
function chunk(arr, size) { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; }
function render(tpl, ctx) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => (ctx[key] !== undefined ? String(ctx[key]) : m));
}

function determineScope() {
  const argScope = (process.argv.find((a) => a.startsWith('--scope=')) || '').split('=')[1];
  if (argScope) return argScope;
  const sched = process.env.GITHUB_EVENT_SCHEDULE || '';
  if (sched === CORE_CRON) return 'core';
  if (sched === FOREIGN_CRON) return 'foreign';
  return 'core';
}

// ---- "Sheet-Stand aufbereiten" (Code-Node), Kernlogik 1:1 aus n8n, nur die
// Suchbereich-Ermittlung ist neu (Rotation statt Tag-des-Monats-Umschaltung). ----
function buildSheetStand(sfRows, regionRows, scope) {
  const regions = uniq(sfRows.map((r) => r.Region));
  const withCurrent = sfRows.filter((r) => r.Aktuell && String(r.Aktuell).trim() !== '');
  const currentList = withCurrent.map((r) => `${r.Region}: ${r.Aktuell}`).join('\n');
  const withEvents = sfRows.filter((r) => r.Events && String(r.Events).trim() !== '');
  const currentEventsList = withEvents.map((r) => `${r.Region}: ${r.Events}`).join('\n');

  const countryRows = regionRows.filter((r) => r.region_id && String(r.region_id).indexOf('de-') !== 0 && String(r.region_id).indexOf('at-') !== 0);
  const allowedCountries = uniq(countryRows.filter((r) => isTrue(r.selectable)).map((r) => r.region_name_de));
  const excludedCountries = uniq(countryRows.filter((r) => !isTrue(r.selectable)).map((r) => r.region_name_de));
  const deRows = regionRows.filter((r) => r.region_id && String(r.region_id).indexOf('de-') === 0);
  const atRows = regionRows.filter((r) => r.region_id && String(r.region_id).indexOf('at-') === 0);
  const deFullyAllowed = deRows.length > 0 && deRows.every((r) => isTrue(r.selectable));
  const atFullyAllowed = atRows.length > 0 && atRows.every((r) => isTrue(r.selectable));

  const allowedRegionsParts = [];
  if (deFullyAllowed) allowedRegionsParts.push('Deutschland (alle Bundeslaender)');
  if (atFullyAllowed) allowedRegionsParts.push('Oesterreich (alle Regionen)');
  const allowedRegionsList = allowedRegionsParts.concat(allowedCountries).join('; ');
  const excludedRegionsList = excludedCountries.length ? excludedCountries.join('; ') : '(keine explizit ausgeschlossenen Laender in der Liste)';

  // NEU: Rotation statt Tag-des-Monats (siehe Kommentar am Dateianfang)
  const groups = chunk(allowedCountries, GROUP_SIZE);
  const weekNumber = DateTime.now().weekNumber;
  const groupIdx = groups.length ? weekNumber % groups.length : 0;

  let searchScopeParts = [];
  let searchScopeLabel = '';
  if (scope === 'foreign') {
    searchScopeParts = groups[groupIdx] || [];
    searchScopeLabel = `Ausland Gruppe ${groupIdx + 1}/${groups.length || 1} (rotierend nach Kalenderwoche, voller Zyklus alle ${groups.length || 1} Woche(n))`;
  } else {
    if (deFullyAllowed) searchScopeParts.push('Deutschland (alle Bundeslaender)');
    if (atFullyAllowed) searchScopeParts.push('Oesterreich (alle Regionen)');
    searchScopeLabel = 'DE+AT (Kernmaerkte, woechentlich durchsucht)';
  }
  const searchScopeList = searchScopeParts.join('; ') || '(keine Laender in diesem Lauf zu durchsuchen)';

  const windowStart = DateTime.now().plus({ months: 3 });
  const windowEnd = DateTime.now().plus({ months: 36 });
  return {
    todayStr: DateTime.now().toFormat('dd.MM.yyyy'),
    windowStartStr: windowStart.toFormat('MM.yyyy'),
    windowEndStr: windowEnd.toFormat('MM.yyyy'),
    existingRegionsList: regions.join('; '),
    currentAktuellList: currentList || '(keine Region hat aktuell einen Eintrag)',
    currentEventsList: currentEventsList || '(keine Region hat Events)',
    allowedRegionsList,
    excludedRegionsList,
    searchScopeList,
    searchScopeLabel,
    groupInfo: scope === 'foreign' ? { groupIdx, totalGroups: groups.length, groups } : null,
  };
}

// ---- "JSON parsen" (Code-Node, 1:1) ----
function parseUpdatesJson(rawText) {
  let text = String(rawText || '').trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) {
    throw new Error(`Recherche-Antwort ist kein valides JSON: ${text.slice(0, 300)}`);
  }
  return Array.isArray(parsed.updates) ? parsed.updates : [];
}

// ---- "Updates bereinigen" (Code-Node, 1:1) ----
function bereinigeUpdates(updates, existingRegionsList, sfRows) {
  const existingSet = new Set(existingRegionsList.split(';').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const eventsByRegion = {};
  for (const r of sfRows) if (r.Region) eventsByRegion[String(r.Region).trim().toLowerCase()] = r.Events != null ? String(r.Events) : '';
  const splitList = (s) => String(s || '').split(';').map((x) => x.trim()).filter(Boolean);

  const groups = {};
  const order = [];
  for (const it of updates) {
    const key = (it.region || '').trim().toLowerCase();
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(it);
  }
  const merged = order.map((key) => {
    const group = groups[key];
    if (group.length === 1) return group[0];
    const seen = new Set();
    const events = [];
    for (const it of group) for (const e of splitList(it.aktuell)) { const k = e.toLowerCase(); if (!seen.has(k)) { seen.add(k); events.push(e); } }
    const base = group.reduce((a, b) => (Object.keys(b).length > Object.keys(a).length ? b : a));
    let ev = '';
    for (const it of group) if (it.events != null && String(it.events).trim() !== '') { ev = String(it.events); break; }
    return Object.assign({}, base, { aktuell: events.join('; '), events: ev });
  });

  return merged.map((it) => {
    const region = (it.region || '').trim();
    const alreadyExists = existingSet.has(region.toLowerCase());
    const provided = it.events != null && String(it.events).trim() !== '' ? String(it.events) : null;
    const fallback = eventsByRegion[region.toLowerCase()] || '';
    const finalEvents = provided != null ? provided : fallback;
    return Object.assign({}, it, { isNewRegion: !alreadyExists, events: finalEvents });
  });
}

async function main() {
  const scope = determineScope();
  log(`Start (${LIVE ? 'LIVE' : 'TEST'}-Modus), Scope=${scope}`);
  if (!process.env.OPENAI_API_KEY) { console.error('[aktuelle-events] ABBRUCH: OPENAI_API_KEY fehlt.'); process.exitCode = 1; return; }

  const sfRows = (await sheets.readSheetAsItems(STADT_FAKTEN_TAB)).map((it) => it.json);
  const regionRows = await regionenSheetItems();
  log(`  Stadt-Fakten: ${sfRows.length} Zeile(n), Erlaubte Regionen: ${regionRows.length} Zeile(n).`);

  const stand = buildSheetStand(sfRows, regionRows, scope);
  log(`  Suchbereich dieses Laufs: ${stand.searchScopeLabel} -> ${stand.searchScopeList}`);
  if (stand.groupInfo) log(`  (Auslands-Rotation: Gruppe ${stand.groupInfo.groupIdx + 1}/${stand.groupInfo.totalGroups})`);

  const system = readPrompt('aktuelle-events.system.txt');
  const user = render(readPrompt('aktuelle-events.user.txt'), stand);

  log('  Rufe OpenAI (gpt-5.4-mini, Websuche) auf — kann je nach Suchbereich mehrere Minuten dauern …');
  const rawText = await webSearchCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.4-mini', system, user,
    maxOutputTokens: 32768, timeoutMs: 480000, maxRetries: 1,
  });
  const updates = parseUpdatesJson(rawText);
  log(`  KI liefert ${updates.length} Update(s).`);
  if (!updates.length) { log('FERTIG: keine Aenderungen in diesem Lauf.'); return; }

  const bereinigt = bereinigeUpdates(updates, stand.existingRegionsList, sfRows);

  let neu = 0, aktualisiert = 0;
  for (const it of bereinigt) {
    const region = (it.region || '').trim();
    if (!region) continue;
    if (it.isNewRegion) {
      log(`  NEU: ${region} — aktuell="${it.aktuell || ''}" events="${it.events || ''}"`);
      if (LIVE) {
        await sheets.appendRow(STADT_FAKTEN_TAB, {
          Regionstyp: it.regionstyp || '', Region: region, Groessenklasse: it.groessenklasse || '',
          OpenAir_Gelaende: it.openair || '', Grossbaustellen: 'nein', Karnevalshochburg: 'nein',
          Festivalort: 'nein', Aktuell: it.aktuell || '', Events: it.events || '',
        });
      }
      neu++;
    } else {
      log(`  UPDATE: ${region} — aktuell="${it.aktuell || ''}" events="${it.events || ''}"`);
      if (LIVE) {
        await sheets.updateRowByColumnMatch(STADT_FAKTEN_TAB, 'Region', region, {
          Region: region, Aktuell: it.aktuell || '', Events: it.events || '',
        });
      }
      aktualisiert++;
    }
  }

  if (LIVE) {
    await sheets.sortStadtFaktenByRegion();
    log(`  Stadt-Fakten nach Region sortiert. ${neu} neue Region(en), ${aktualisiert} aktualisiert.`);
  } else {
    log(`  TEST-Modus: Sheet-Schreiben + Sortierung uebersprungen (waeren ${neu} neue Region(en), ${aktualisiert} Update(s)).`);
  }
  log(`FERTIG (${LIVE ? 'LIVE' : 'TEST'}).`);
}

async function regionenSheetItems() {
  // "Erlaubte Regionen lesen" liest aus einem ANDEREN Spreadsheet als
  // Landingpagedaten -- lib/sheets.js ist fest auf SPREADSHEET_ID der
  // Landingpagedaten-Tabelle verdrahtet (wie in allen automation/*-Skripten),
  // daher hier ein eigener, minimaler direkter Google-Sheets-Read.
  // Die Sheets-API braucht fuer values.get() den Tab-NAMEN, nicht die gid
  // (anders als n8n's eigener Google-Sheets-Node, der "mode: id" kann) --
  // deshalb hier zuerst per spreadsheets.get() den Namen zur bekannten gid
  // (1498711867) aufloesen, statt ihn hart zu kodieren.
  const { google } = require('googleapis');
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON fehlt.');
  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT(creds.client_email, null, creds.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
  const client = google.sheets({ version: 'v4', auth });
  const meta = await client.spreadsheets.get({ spreadsheetId: REGIONEN_SHEET_ID, fields: 'sheets.properties' });
  const sheetProps = (meta.data.sheets || []).map((s) => s.properties).find((p) => p.sheetId === REGIONEN_TAB_GID);
  if (!sheetProps) throw new Error(`regionenSheetItems: kein Tab mit gid ${REGIONEN_TAB_GID} in Spreadsheet ${REGIONEN_SHEET_ID} gefunden.`);
  const res = await client.spreadsheets.values.get({ spreadsheetId: REGIONEN_SHEET_ID, range: sheetProps.title });
  const rows = res.data.values || [];
  if (rows.length < 1) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    header.forEach((h, idx) => { if (h) obj[h] = row[idx] !== undefined ? row[idx] : ''; });
    return obj;
  });
}

main().catch((err) => {
  console.error('[aktuelle-events] Lauf abgebrochen:', err.message);
  process.exitCode = process.exitCode || 1;
});
