// Google Drive (nur lesen) für den geschützten Portal-Bereich.
// Die Ordner werden mit dem Dienstkonto (GOOGLE_SERVICE_ACCOUNT_JSON) als "Betrachter" geteilt.
import { googleAccessToken } from './google.mjs';

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3/files';
const FIELDS = 'id,name,mimeType,size,modifiedTime,description,parents';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const COMMON = { supportsAllDrives: 'true' };

// Google-Dokumente haben keine Datei → als PDF bzw. Excel ausliefern.
export const EXPORTS = {
  'application/vnd.google-apps.document': { mime: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.presentation': { mime: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.drawing': { mime: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx' },
};

/** Ordner-ID oder kompletter Drive-Link → ID. */
export function folderIdFrom(v) {
  const s = String(v || '').trim();
  const m = s.match(/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/^([A-Za-z0-9_-]{10,})$/);
  return m ? m[1] : '';
}

async function call(url, { raw = false } = {}) {
  const token = await googleAccessToken(SCOPE);
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(raw ? 25000 : 8000) });
  if (!res.ok) {
    const err = new Error(`Drive-API HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return raw ? res : res.json();
}

export async function listChildren(folderId) {
  const out = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({
      ...COMMON,
      includeItemsFromAllDrives: 'true',
      q: `'${folderId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${FIELDS})`,
      orderBy: 'folder,name_natural',
      pageSize: '200',
      ...(pageToken ? { pageToken } : {}),
    });
    const j = await call(`${API}?${q}`);
    out.push(...(j.files || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken && out.length < 1000);
  return out;
}

export async function getMeta(fileId) {
  return call(`${API}/${encodeURIComponent(fileId)}?${new URLSearchParams({ ...COMMON, fields: `${FIELDS},trashed` })}`);
}

/** Liegt die Datei (direkt oder in Unterordnern, max. maxDepth Ebenen) im Ordner rootId? */
export async function isInside(meta, rootId, maxDepth = 3) {
  let parents = meta.parents || [];
  for (let d = 0; d < maxDepth && parents.length; d++) {
    if (parents.includes(rootId)) return true;
    const p = await getMeta(parents[0]);
    if (p.trashed) return false;
    parents = p.parents || [];
  }
  return parents.includes(rootId);
}

/** Antwort (Stream) mit dem Dateiinhalt. */
export async function download(meta) {
  const exp = EXPORTS[meta.mimeType];
  const url = exp
    ? `${API}/${encodeURIComponent(meta.id)}/export?${new URLSearchParams({ mimeType: exp.mime })}`
    : `${API}/${encodeURIComponent(meta.id)}?${new URLSearchParams({ ...COMMON, alt: 'media' })}`;
  const res = await call(url, { raw: true });
  return { res, mime: exp ? exp.mime : (meta.mimeType || 'application/octet-stream'), name: exp ? meta.name + exp.ext : meta.name };
}
