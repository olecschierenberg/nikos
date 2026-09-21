'use strict';
// Prueft Seitenweise-Abfrage und Fehlerbehandlung mit einem vorgetaeuschten fetch (kein Netzwerk).
const test = require('node:test');
const assert = require('node:assert/strict');
const { listContacts, blacklistContact } = require('../lib/brevo');

const realFetch = global.fetch;
test.afterEach(() => { global.fetch = realFetch; });

const json = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test('listContacts holt alle Seiten (500 + 120 Kontakte)', async () => {
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    const offset = Number(new URL(url).searchParams.get('offset'));
    const n = offset === 0 ? 500 : 120;
    return json(200, { contacts: Array.from({ length: n }, (_, i) => ({ email: `k${offset + i}@x.de` })) });
  };
  const all = await listContacts('KEY', 2);
  assert.equal(all.length, 620);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /offset=500/);
});

test('blacklistContact: 204 -> gesperrt, 404 -> nicht-in-brevo, 400 -> Fehler', async () => {
  global.fetch = async () => json(204, {});
  assert.equal(await blacklistContact('KEY', 'a@x.de'), 'gesperrt');
  global.fetch = async () => json(404, { message: 'Contact does not exist' });
  assert.equal(await blacklistContact('KEY', 'a@x.de'), 'nicht-in-brevo');
  global.fetch = async () => json(400, { message: 'bad' });
  await assert.rejects(() => blacklistContact('KEY', 'a@x.de'), /HTTP 400/);
});

test('blacklistContact kodiert die E-Mail-Adresse im Pfad', async () => {
  let called;
  global.fetch = async (url) => { called = url; return json(204, {}); };
  await blacklistContact('KEY', 'a+b@x.de');
  assert.match(called, /contacts\/a%2Bb%40x\.de$/);
});
