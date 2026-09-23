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

  const formula = `=ARRAYFORMULA(IF(ROW(${firstDataCol}1:${firstDataCol})=1,"OrigZeile",IF(${firstDataCol}1:${firstDataCol}="","",ROW(${firstDataCol}1:${firstDataCol}))))`;
  log(`Plan: ${col}2:${col} leeren, ${col}1 = ${formula}, danach alle Zeilen nach Relevanz sortieren (Filter/Sortierung A..${sheets.columnLetter(idx - 1)}).`);
  if (!LIVE) { log('DRY-RUN: nichts geschrieben.'); return; }

  await api.spreadsheets.values.clear({ spreadsheetId: sheets.SPREADSHEET_ID, range: `${TAB}!${col}2:${col}` });
  await api.spreadsheets.values.update({
    spreadsheetId: sheets.SPREADSHEET_ID, range: `${TAB}!${col}1`, valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[formula]] },
  });
  let after = await check(api, col);
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
