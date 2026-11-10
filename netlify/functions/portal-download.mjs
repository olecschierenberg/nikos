// GET /api/portal-download?bereich=technik&id=<Drive-Datei-ID>  (Authorization: Bearer <Login-Token>)
// Liefert die Datei nur, wenn sie im Ordner des Bereichs (oder einem Unterordner) liegt.
import { handleOptions, json, corsHeaders, HttpError } from '../lib/http.mjs';
import { authorize } from '../lib/portal.mjs';
import { getMeta, isInside, download, FOLDER_MIME } from '../lib/drive.mjs';

export const config = { path: '/api/portal-download' };

const asciiName = (n) => n.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '').trim() || 'download';

export default async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'GET') return json(req, 405, { error: 'Nur GET erlaubt' });
  const p = new URL(req.url).searchParams;
  const id = p.get('id') || '';
  try {
    const { session, folderId } = authorize(req, p.get('bereich') || '');
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new HttpError(400, 'Ungültige Datei');
    let meta;
    try { meta = await getMeta(id); } catch (e) { if (e.status === 404) throw new HttpError(404, 'Datei nicht gefunden'); throw e; }
    if (meta.trashed || meta.mimeType === FOLDER_MIME || !(await isInside(meta, folderId))) throw new HttpError(404, 'Datei nicht gefunden');
    const { res, mime, name } = await download(meta);
    console.log(`portal-download: ${session.kategorie} lädt "${meta.name}"`);
    const headers = {
      ...corsHeaders(req),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    };
    const len = res.headers.get('content-length');
    if (len) headers['Content-Length'] = len;
    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    if (e instanceof HttpError) return json(req, e.status, { error: e.message });
    console.error('portal-download:', e.message);
    return json(req, 502, { error: 'Download derzeit nicht verfügbar' });
  }
};
