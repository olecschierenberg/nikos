// GET /api/portal-files?bereich=technik  (Kopfzeile Authorization: Bearer <Login-Token>)
// Listet die Dateien des Drive-Ordners eines Portal-Bereichs; Unterordner (bis 4 Ebenen) = Gruppen.
import { handleOptions, json, HttpError } from '../lib/http.mjs';
import { authorize } from '../lib/portal.mjs';
import { listChildren, FOLDER_MIME, EXPORTS } from '../lib/drive.mjs';

export const config = { path: '/api/portal-files' };

const MAX_DEPTH = 4;
const MAX_FOLDERS = 60;

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
    // Unterordner (bis MAX_DEPTH Ebenen) werden zu Gruppen; Name = Pfad, z. B. "NIKOS audio › USB-Treiber".
    const groups = [];
    let folders = 0;
    const walk = async (id, path, depth, description = '') => {
      const items = await listChildren(id);
      groups.push({ name: path.join(' › '), description, files: items.filter(isFile).map(shape) });
      if (depth >= MAX_DEPTH) return;
      for (const sub of items.filter((f) => f.mimeType === FOLDER_MIME)) {
        if (++folders > MAX_FOLDERS) return;
        await walk(sub.id, [...path, sub.name], depth + 1, (sub.description || '').slice(0, 500));
      }
    };
    await walk(folderId, [], 0);
    return json(req, 200, { bereich, groups: groups.filter((g) => g.files.length) });
  } catch (e) {
    if (e instanceof HttpError) return json(req, e.status, { error: e.message });
    console.error('portal-files:', e.message);
    return json(req, 502, { error: 'Dateiliste derzeit nicht verfügbar' });
  }
};
