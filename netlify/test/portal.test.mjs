// Geschützte Portal-Dateien (Google Drive) – ohne Netzwerk, mit falschem Drive.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv, get } from './helpers.mjs';
import files from '../functions/portal-files.mjs';
import dl from '../functions/portal-download.mjs';
import { createLoginToken } from '../lib/tokens.mjs';
import { folderIdFrom } from '../lib/drive.mjs';

const U = 'https://nikos.info';
const ROOT = 'ROOTfolder0000';
const FOLDER = 'application/vnd.google-apps.folder';
// Drive: ROOT → datei1, Unterordner SUB (→ datei2, gdoc), fremder Ordner OTHER → geheim
const items = {
  ROOTfolder0000: { id: ROOT, mimeType: FOLDER, parents: ['MYDRIVE00000'] },
  datei1xxxxxxx: { id: 'datei1xxxxxxx', name: 'NIKOS-audio_FW_2.1.bin', mimeType: 'application/octet-stream', size: '1234', modifiedTime: '2026-11-01T10:00:00Z', parents: [ROOT], description: 'Firmware' },
  SUBfolder0000: { id: 'SUBfolder0000', name: 'NIKOS dispatcher', mimeType: FOLDER, parents: [ROOT] },
  datei2xxxxxxx: { id: 'datei2xxxxxxx', name: 'Dispatcher-Setup.zip', mimeType: 'application/zip', size: '99', modifiedTime: '2026-10-01T10:00:00Z', parents: ['SUBfolder0000'] },
  gdocxxxxxxxxx: { id: 'gdocxxxxxxxxx', name: 'Changelog', mimeType: 'application/vnd.google-apps.document', parents: ['SUBfolder0000'] },
  DEEPfolder000: { id: 'DEEPfolder000', name: 'USB-Treiber', mimeType: FOLDER, parents: ['SUBfolder0000'] },
  tiefxxxxxxxxx: { id: 'tiefxxxxxxxxx', name: 'driver.zip', mimeType: 'application/zip', size: '5', parents: ['DEEPfolder000'] },
  shortcutxxxxx: { id: 'shortcutxxxxx', name: 'Verknüpfung', mimeType: 'application/vnd.google-apps.shortcut', parents: [ROOT] },
  OTHERfolder00: { id: 'OTHERfolder00', name: 'Intern', mimeType: FOLDER, parents: ['MYDRIVE00000'] },
  geheimxxxxxxx: { id: 'geheimxxxxxxx', name: 'geheim.pdf', mimeType: 'application/pdf', parents: ['OTHERfolder00'] },
  MYDRIVE00000: { id: 'MYDRIVE00000', mimeType: FOLDER, parents: [] },
};
let calls;

beforeEach(() => {
  setupEnv();
  process.env.PORTAL_DRIVE_TECHNIK = `https://drive.google.com/drive/folders/${ROOT}?usp=sharing`;
  delete process.env.PORTAL_DRIVE_MARKETING;
  calls = [];
  globalThis.fetch = async (url) => {
    url = new URL(String(url));
    calls.push(url.pathname);
    const ok = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.href.startsWith('https://oauth2.googleapis.com/token')) return ok({ access_token: 'g', expires_in: 3600 });
    const m = url.pathname.match(/^\/drive\/v3\/files(?:\/([^/]+))?(\/export)?$/);
    if (!m) throw new Error('unerwartet: ' + url.href);
    if (!m[1]) {
      const pid = url.searchParams.get('q').match(/'([^']+)' in parents/)[1];
      return ok({ files: Object.values(items).filter((f) => f.parents.includes(pid)) });
    }
    const f = items[decodeURIComponent(m[1])];
    if (!f) return new Response('{}', { status: 404 });
    if (m[2]) return new Response(`PDF:${f.name}`, { status: 200, headers: { 'content-length': String(4 + f.name.length) } });
    if (url.searchParams.get('alt') === 'media') return new Response(`DATA:${f.name}`, { status: 200 });
    return ok({ ...f, trashed: false });
  };
});

const auth = (k = 'Techniker', now) => ({ authorization: `Bearer ${createLoginToken({ email: 't@example.com', kategorie: k, now })}` });

test('Ordner-Link oder ID wird erkannt', () => {
  assert.equal(folderIdFrom(`https://drive.google.com/drive/u/0/folders/${ROOT}`), ROOT);
  assert.equal(folderIdFrom(ROOT), ROOT);
  assert.equal(folderIdFrom('quatsch ?'), '');
});

test('Dateiliste: ohne / mit abgelaufenem / gefälschtem Login → 401', async () => {
  assert.equal((await get(files, `${U}/api/portal-files?bereich=technik`)).status, 401);
  assert.equal((await get(files, `${U}/api/portal-files?bereich=technik`, auth('Techniker', Date.now() - 25 * 3600e3))).status, 401);
  assert.equal((await get(files, `${U}/api/portal-files?bereich=technik`, { authorization: 'Bearer abc.def' })).status, 401);
  assert.equal(calls.length, 0);
});

test('Dateiliste: Gruppen aus Unterordnern, Google-Doc als PDF, Verknüpfungen ausgeblendet', async () => {
  const r = await get(files, `${U}/api/portal-files?bereich=technik`, auth());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const d = await r.json();
  assert.deepEqual(d.groups.map((g) => g.name), ['', 'NIKOS dispatcher', 'NIKOS dispatcher › USB-Treiber']);
  assert.deepEqual(d.groups[2].files.map((f) => f.name), ['driver.zip']);
  assert.deepEqual(d.groups[0].files.map((f) => f.name), ['NIKOS-audio_FW_2.1.bin']);
  assert.equal(d.groups[0].files[0].size, 1234);
  assert.deepEqual(d.groups[1].files.map((f) => f.name).sort(), ['Changelog.pdf', 'Dispatcher-Setup.zip']);
});

test('Berechtigung: Techniker kein Marketing; Bereich ohne Ordner → 503; unbekannt → 404', async () => {
  assert.equal((await get(files, `${U}/api/portal-files?bereich=marketing`, auth('Techniker'))).status, 403);
  assert.equal((await get(files, `${U}/api/portal-files?bereich=marketing`, auth('Partner'))).status, 503);
  assert.equal((await get(files, `${U}/api/portal-files?bereich=xyz`, auth('Mitarbeiter'))).status, 404);
  for (const k of ['Partner', 'Mitarbeiter']) assert.equal((await get(files, `${U}/api/portal-files?bereich=technik`, auth(k))).status, 200);
});

test('Download: Datei im Ordner und Unterordner, Google-Doc als PDF', async () => {
  let r = await get(dl, `${U}/api/portal-download?bereich=technik&id=datei1xxxxxxx`, auth());
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'DATA:NIKOS-audio_FW_2.1.bin');
  assert.match(r.headers.get('content-disposition'), /attachment; filename="NIKOS-audio_FW_2.1.bin"/);
  r = await get(dl, `${U}/api/portal-download?bereich=technik&id=datei2xxxxxxx`, auth());
  assert.equal(await r.text(), 'DATA:Dispatcher-Setup.zip');
  r = await get(dl, `${U}/api/portal-download?bereich=technik&id=tiefxxxxxxxxx`, auth());
  assert.equal(await r.text(), 'DATA:driver.zip');
  r = await get(dl, `${U}/api/portal-download?bereich=technik&id=gdocxxxxxxxxx`, auth());
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /Changelog\.pdf/);
});

test('Download: fremde Datei, Ordner, unbekannt, ungültige ID, ohne Login → kein Inhalt', async () => {
  for (const id of ['geheimxxxxxxx', 'SUBfolder0000', 'gibtsnichtxxx']) {
    const r = await get(dl, `${U}/api/portal-download?bereich=technik&id=${id}`, auth());
    assert.equal(r.status, 404, id);
  }
  assert.equal((await get(dl, `${U}/api/portal-download?bereich=technik&id=../x`, auth())).status, 400);
  calls = [];
  assert.equal((await get(dl, `${U}/api/portal-download?bereich=technik&id=datei1xxxxxxx`)).status, 401);
  assert.equal((await get(dl, `${U}/api/portal-download?bereich=marketing&id=datei1xxxxxxx`, auth('Techniker'))).status, 403);
  assert.equal(calls.length, 0);
});

test('Drive-Fehler → 502 ohne Details', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  const r = await get(files, `${U}/api/portal-files?bereich=technik`, auth());
  assert.equal(r.status, 502);
  assert.doesNotMatch(await r.text(), /HTTP|Drive/);
});
