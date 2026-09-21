// HTTP-Helfer: einheitliche Antworten (nie zwischenspeichern!) + CORS
import { ALLOWED_ORIGINS } from './config.mjs';

const BASE = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/** Antwort auf den Browser-"Vorabfrage" (OPTIONS). Sonst null. */
export function handleOptions(req) {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: { ...BASE, ...corsHeaders(req) } });
}

export function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE, ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function plain(status, body) {
  return new Response(body, { status, headers: { ...BASE, 'Content-Type': 'text/plain; charset=utf-8' } });
}

export function html(status, body) {
  return new Response(body, {
    status,
    headers: { ...BASE, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

export function redirect(url) {
  return new Response(null, { status: 302, headers: { ...BASE, Location: url } });
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** JSON-Body lesen (mit Größenlimit). */
export async function readJson(req, maxChars = 50_000) {
  const raw = await req.text();
  if (raw.length > maxChars) throw new HttpError(413, 'Anfrage zu groß');
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('kein Objekt');
    return v;
  } catch {
    throw new HttpError(400, 'Ungültiges JSON');
  }
}
