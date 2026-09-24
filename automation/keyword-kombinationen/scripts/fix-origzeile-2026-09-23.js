#!/usr/bin/env node
'use strict';
/**
 * EINMAL-FIX 2026-09-23: Hilfsspalte "OrigZeile" dauerhaft stabil machen + alle Zeilen sortieren.
 *
 * Problem: Die ARRAYFORMULA(ROW()) fuer "OrigZeile" stand in einer Datenzelle und ist beim Sortieren
 * mitgewandert (zuletzt in Zeile 210 -> Zeilen 2..209 ohne Wert). Ausserdem lag die zuletzt
 * angehaengte Zeile (391) ausserhalb des Filterbereichs und wurde beim manuellen Sortieren nicht erfasst.
 *
 * Loesung:
 *  1) Spalte OrigZeile ab Zeile 2 leeren (entfernt die verrutschte Formel).
 *  2) Formel in die KOPFZELLE setzen: sie liefert "OrigZeile" als Ueberschrift und fuer jede
 *     Datenzeile die aktuelle Zeilennummer. Die Kopfzeile wird nie sortiert -> Formel kann nicht wandern.
 *  3) Alle Zeilen nach Relevanz sortieren + Filter ueber ALLE Zeilen neu setzen (ohne OrigZeile-Spalte,
 *     siehe lib/sheets.js sortByRelevanceDesc).
 *  4) Kontrolle: jede Datenzeile hat OrigZeile == eigene Zeilennummer.
 *
 * Standard: Dry-Run. Mit --live wird geschrieben.
 */
const sheets = require('../lib/sheets.js');
const { google } = require('googleapis');

const TAB = 'Keywordkombinationen';
const LIVE = process.argv.includes('--live');
const log = (m) => console.log(`[fix-origzeile] ${m}`);
const fail = (m) => { console.error(`[fix-origzeile] ABBRUCH: ${m}`); process.exit(1); };

async function client() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  const auth = new google.auth.JWT(creds.client_email, null, creds.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
}

async function check(api, col) {
  const res = await api.spreadsheets.values.get({
    spreadsheetId: sheets.SPREADSHEET_ID, range: `${TAB}!A1:${col}`, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  const header = rows[0] || [];
  const idx = header.indexOf('OrigZeile');
  let dataRows = 0; let ok = 0; const bad = [];
  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    if (!r.slice(0, idx).some((v) => String(v ?? '').trim() !== '')) return; // leere Zeile
    dataRows++;
    if (Number(r[idx]) === rowNo) ok++; else if (bad.length < 5) bad.push(`${rowNo}:${r[idx] ?? '-'}`);
  });
  return { header, idx, dataRows, ok, bad };
}

(async () => {
  log(`Modus: ${LIVE ? 'LIVE' : 'DRY-RUN'}`);
  const api = await client();
  const hdr = (await api.spreadsheets.values.get({ spreadsheetId: sheets.SPREADSHEET_ID, range: `${TAB}!1:1` })).data.values[0];
  const idx = hdr.indexOf('OrigZeile');
  if (idx === -1) fail('Spalte "OrigZeile" nicht in der Kopfzeile gefunden.');
  if (idx !== hdr.length - 1) fail(`"OrigZeile" ist nicht die letzte Spalte (Index ${idx} von ${hdr.length}).`);
  const col = sheets.columnLetter(idx);
  const firstDataCol = 'E'; // Spalte "Problem" -- in jeder Datenzeile befuellt
  if (hdr.indexOf('Problem') !== 4) fail(`Spalte "Problem" erwartet in E, gefunden Index ${hdr.indexOf('Problem')}.`);

  const before = await check(api, col);
  log(`Vorher: ${before.dataRows} Datenzeilen, davon ${before.ok} mit korrekter OrigZeile. Beispiele falsch: ${before.bad.join(', ') || '-'}`);

  // Trennzeichen haengt von der Laendereinstellung des Sheets ab (DE: Semikolon, EN: Komma) -> beide probieren.
  const E = firstDataCol;
  const formulas = [
    `=ARRAYFORMULA(IF(ROW(${E}1:${E})=1;"OrigZeile";IF(${E}1:${E}="";"";ROW(${E}1:${E}))))`,
    `=ARRAYFORMULA(IF(ROW(${E}1:${E})=1,"OrigZeile",IF(${E}1:${E}="","",ROW(${E}1:${E}))))`,
  ];
  log(`Plan: ${col}2:${col} leeren, ${col}1 = ${formulas[0]} (bzw. Komma-Variante), danach alle Zeilen nach Relevanz sortieren (Filter/Sortierung A..${sheets.columnLetter(idx - 1)}).`);
  // Zusatz 2026-09-24: noch nicht veroeffentlichte Mehrsprach-LPs zeigten in "pfad" schon auf die spaetere
  // Live-URL (404). Auf die Vorschau umstellen, sofern der Vorschau-Ordner im Repo existiert.
  const fs = require('fs');
  const path = require('path');
  const all = await sheets.readSheetAsItems(TAB);
  const pfadFixes = [];
  for (const { json: r } of all) {
    const m = String(r.pfad || '').match(/^https:\/\/nikos\.info\/([a-z]{2})\/lp\/([^/]+)\/$/);
    if (!m || String(r.aktiv || '').trim() !== '' || String(r.slug || '').trim() !== m[2]) continue;
    const dir = path.join(__dirname, '..', '..', '..', 'lp-preview', m[2], m[1]);
    if (!fs.existsSync(dir)) { log(`pfad-Fix: Zeile ${r.row_number} (${m[2]}) -- Vorschau ${m[1]} nicht gefunden, uebersprungen.`); continue; }
    pfadFixes.push({ row: r.row_number, pfad: `https://nikos.info/lp-preview/${m[2]}/${m[1]}/` });
  }
  pfadFixes.forEach((f) => log(`pfad-Fix: Zeile ${f.row} -> ${f.pfad}`));

  if (!LIVE) { log('DRY-RUN: nichts geschrieben.'); return; }
  for (const f of pfadFixes) await sheets.updateRowByRowNumber(TAB, f.row, { pfad: f.pfad });

  await api.spreadsheets.values.clear({ spreadsheetId: sheets.SPREADSHEET_ID, range: `${TAB}!${col}2:${col}` });
  let after;
  for (const formula of formulas) {
    await api.spreadsheets.values.update({
      spreadsheetId: sheets.SPREADSHEET_ID, range: `${TAB}!${col}1`, valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[formula]] },
    });
    after = await check(api, col);
    log(`Versuch ${formula} -> Ueberschrift "${after.header[idx]}"`);
    if (after.header[idx] === 'OrigZeile') break;
  }
  if (after.header[idx] !== 'OrigZeile') {
    // Formel nicht akzeptiert -> Ueberschrift als Text wiederherstellen, damit nichts anderes bricht.
    await api.spreadsheets.values.update({
      spreadsheetId: sheets.SPREADSHEET_ID, range: `${TAB}!${col}1`, valueInputOption: 'RAW', requestBody: { values: [['OrigZeile']] },
    });
    fail(`Formel lieferte Ueberschrift "${after.header[idx]}" -- Ueberschrift als Text wiederhergestellt, Spalte bleibt leer (LP-Generator braucht sie nicht).`);
  }
  await sheets.sortByRelevanceDesc(TAB);
  after = await check(api, col);
  log(`Nachher: ${after.dataRows} Datenzeilen, davon ${after.ok} mit korrekter OrigZeile. Falsch: ${after.bad.join(', ') || '-'}`);
  if (after.ok !== after.dataRows) fail('Kontrolle fehlgeschlagen.');
  log('FERTIG.');
})().catch((e) => fail(e.stack || e.message));
