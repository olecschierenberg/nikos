// Gemeinsame Prüfung für geschützte Portal-Inhalte: Login-Token (Kopfzeile "Authorization: Bearer …")
// + Berechtigung für den Bereich + konfigurierter Drive-Ordner.
import { PORTAL_BEREICHE } from './config.mjs';
import { verifyLoginToken } from './tokens.mjs';
import { folderIdFrom } from './drive.mjs';
import { HttpError } from './http.mjs';

export function bearer(req) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(\S{1,1000})$/i);
  return m ? m[1] : '';
}

/** Liefert { session, folderId } oder wirft HttpError (401/403/404/503). */
export function authorize(req, bereich) {
  const b = PORTAL_BEREICHE[bereich];
  if (!b) throw new HttpError(404, 'Unbekannter Bereich');
  const session = verifyLoginToken(bearer(req));
  if (!session.valid) throw new HttpError(401, 'Nicht angemeldet oder Anmeldung abgelaufen');
  if (!b.kategorien.includes(session.kategorie)) throw new HttpError(403, 'Kein Zugriff auf diesen Bereich');
  const folderId = folderIdFrom(process.env[b.env]);
  if (!folderId) throw new HttpError(503, 'Bereich noch nicht eingerichtet');
  return { session, folderId };
}
