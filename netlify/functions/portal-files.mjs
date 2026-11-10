// GET /api/portal-files?bereich=technik  (Kopfzeile Authorization: Bearer <Login-Token>)
// Listet die Dateien des Drive-Ordners eines Portal-Bereichs; Unterordner = Gruppen (eine Ebene).
import { handleOptions, json, HttpError } from '../lib/http.mjs';
import { authorize } from '../lib/portal.mjs';
import { listChildren, FOLDER_MIME, EXPORTS } from '../lib/drive.mjs';

export const config = { path: '/api/portal-files' };

const shape = (f) => ({
  id: f.id,
  name: EXPORTS[f.mimeType] ? f.name + EXPORTS[f.mimeType].ext : f.name,
  size: f.size ? Number(f.size) : null,
  modified: f.modifiedTime || '',
  description: (f.description || '').slice(0, 500),
});
const isFile = (f) => f.mimeType !== FOLDER_MIME && !String(f.mimeType).startsWith('application/vnd.google-apps.') || EXPORTS[f.mimeType];

export default async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'GET') return json(req, 405, { error: 'Nur GET erlaubt' });
  const bereich = new URL(req.url).searchParams.get('bereich') || '';
  try {
    const { folderId } = authorize(req, bereich);
    const top = await listChildren(folderId);
    const groups = [{ name: '', files: top.filter(isFile).map(shape) }];
    for (const sub of top.filter((f) => f.mimeType === FOLDER_MIME).slice(0, 30)) {
      const files = (await listChildren(sub.id)).filter(isFile).map(shape);
      if (files.length) groups.push({ name: sub.name, description: (sub.description || '').slice(0, 500), files });
    }
    return json(req, 200, { bereich, groups: groups.filter((g) => g.files.length) });
  } catch (e) {
    if (e instanceof HttpError) return json(req, e.status, { error: e.message });
    console.error('portal-files:', e.message);
    return json(req, 502, { error: 'Dateiliste derzeit nicht verfügbar' });
  }
};
