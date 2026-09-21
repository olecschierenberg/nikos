'use strict';
// Ausfuehren: npm test (nur Logik mit Testdaten, keine echten API-Aufrufe)
const test = require('node:test');
const assert = require('node:assert/strict');
const { planUnsubscribes, planImport, maskEmail } = require('../lib/logic');

const row = (rowNumber, values) => ({ rowNumber, values });

test('maskEmail versteckt den lokalen Teil', () => {
  assert.equal(maskEmail('max.muster@firma.de'), 'm***@firma.de');
  assert.equal(maskEmail('kaputt'), '***');
});

test('planUnsubscribes: nur "-", ohne Duplikate und ohne leere E-Mail', () => {
  const rows = [
    row(2, { email: 'a@x.de', newsletter: '-' }),
    row(3, { email: 'A@x.de ', newsletter: '-' }), // Duplikat (Gross-/Kleinschreibung, Leerzeichen)
    row(4, { email: 'b@x.de', newsletter: 'x' }),
    row(5, { email: 'c@x.de', newsletter: '' }),
    row(6, { email: '', newsletter: '-' }),
    row(7, { email: 'd@x.de', newsletter: ' - ' }), // Leerzeichen um das Minus
  ];
  const r = planUnsubscribes(rows);
  assert.deepEqual(r.emails, ['a@x.de', 'd@x.de']);
  assert.equal(r.withoutEmail, 1);
});

test('planImport: markiert leere Zeile mit "x" und ergaenzt nur leere Felder', () => {
  const rows = [row(2, { email: 'a@x.de', newsletter: '', name: 'Bestand', firma: '', telefon: '' })];
  const contacts = [{ email: 'A@x.de', attributes: { VORNAME: 'Neu', FIRMA: 'Firma A', TELEFON: '123' } }];
  const r = planImport(contacts, rows, '19.09.2026');
  assert.deepEqual(r.cellUpdates, [
    { rowNumber: 2, column: 'newsletter', value: 'x' },
    { rowNumber: 2, column: 'firma', value: 'Firma A' },
    { rowNumber: 2, column: 'telefon', value: '123' },
  ]); // "name" bleibt "Bestand"
  assert.equal(r.stats.marked, 1);
  assert.equal(r.appends.length, 0);
});

test('planImport: "-" im Sheet gewinnt gegen Brevo (keine Wiederanmeldung durch den Sync)', () => {
  const rows = [row(2, { email: 'a@x.de', newsletter: '-' })];
  const r = planImport([{ email: 'a@x.de' }], rows, 'heute');
  assert.equal(r.cellUpdates.length, 0);
  assert.equal(r.stats.skippedUnsubscribedInSheet, 1);
});

test('planImport: gesperrte Brevo-Kontakte werden nie aktiv markiert', () => {
  const r = planImport([{ email: 'a@x.de', emailBlacklisted: true }], [], 'heute');
  assert.equal(r.appends.length, 0);
  assert.equal(r.stats.skippedBlacklisted, 1);
});

test('planImport: unbekannte E-Mail -> neue Zeile; bereits "x" -> nichts tun', () => {
  const rows = [row(2, { email: 'b@x.de', newsletter: 'x' })];
  const contacts = [
    { email: 'neu@x.de', attributes: { VORNAME: 'Nina', FIRMA: 'F', TELEFON: '1' } },
    { email: 'b@x.de' },
    { email: 'neu@x.de' }, // doppelt in Brevo
  ];
  const r = planImport(contacts, rows, '19.09.2026');
  assert.deepEqual(r.appends, [
    { name: 'Nina', firma: 'F', email: 'neu@x.de', telefon: '1', newsletter: 'x', typ: 'Newsletter', datum: '19.09.2026' },
  ]);
  assert.equal(r.stats.alreadyMarked, 1);
  assert.equal(r.stats.contacts, 2);
});

test('planImport: mehrere Zeilen derselben E-Mail -> nur die erste wird markiert', () => {
  const rows = [
    row(2, { email: 'a@x.de', newsletter: '' }),
    row(9, { email: 'a@x.de', newsletter: '' }),
  ];
  const r = planImport([{ email: 'a@x.de' }], rows, 'heute');
  assert.deepEqual(r.cellUpdates, [{ rowNumber: 2, column: 'newsletter', value: 'x' }]);
});
