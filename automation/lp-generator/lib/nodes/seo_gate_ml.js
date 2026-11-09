// NEU (2026-09-03, kein n8n-Vorbild): SEO-Gate-Variante fuer den neuen
// Multi-Sprach-URL-Pfad (nikos.info/<lang>/lp/<slug>/). Fast identisch zu
// lib/nodes/seo_gate.js (dort UNVERAENDERT fuer den Alt-Pfad belassen),
// mit zwei bewussten Unterschieden:
//  1) hreflang ist hier ERLAUBT (im Alt-Pfad noch hart verboten, siehe
//     HREFLANG_FORBIDDEN_UNTIL_V2_URL_SPLIT in seo_gate.js -- das "V2" ist
//     genau dieser neue Pfad).
//  2) CANONICAL_INVALID prueft gegen das neue Muster
//     https://nikos.info/<lang>/lp/<slug>/ statt /loesungen/<slug>/.
const item = $input.item;
const data = item.json || {};
const html = String(data.html || '');
const hardErrors = [];
const warnings = [];
const title = ((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
const description = ((html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || [])[1] || '').trim();
const canonical = ((html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1] || '').trim();
const h1Count = (html.match(/<h1\b/gi) || []).length;
if (!title) hardErrors.push('TITLE_MISSING');
if (!description) hardErrors.push('META_DESCRIPTION_MISSING');
if (!canonical || !/^https:\/\/nikos\.info\/[a-z]{2}\/lp\//.test(canonical)) hardErrors.push('CANONICAL_INVALID');
if (!/hreflang\s*=\s*["']x-default["']/i.test(html)) hardErrors.push('HREFLANG_XDEFAULT_MISSING');
if (h1Count < 1) hardErrors.push('H1_MISSING');
if (h1Count > 1) warnings.push('MULTIPLE_H1_ELEMENTS');
if (title && (title.length < 20 || title.length > 65)) hardErrors.push('TITLE_LENGTH_OUTSIDE_20_65');
if (description && (description.length < 80 || description.length > 158)) hardErrors.push('META_DESCRIPTION_LENGTH_OUTSIDE_80_158');
// 2026-11-09 Konsistenz-Gates (alle Sprachen): Beschreibung enthaelt die H1 (Keyword + Ereignis), Titel schneidet den Ereignisnamen nicht ab.
const dec = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().toLowerCase();
const h1Plain = dec(((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' '));
if (h1Plain && description && !dec(description).includes(h1Plain.slice(0, 30))) hardErrors.push('DESC_WITHOUT_H1_KEYWORD');
if (h1Plain && h1Plain.length <= 64 && title) {
  const lastWord = h1Plain.split(' ').pop().replace(/[.,;:]+$/, '');
  if (lastWord && !dec(title).includes(lastWord)) hardErrors.push('TITLE_CUT_BEFORE_EVENT');
}
if (hardErrors.length) throw new Error('SEO_GATE_ML_BLOCKED(' + (data.lang || '?') + '): ' + hardErrors.join(','));
return { json: { ...data, seo_gate: warnings.length ? 'warning' : 'pass', seo_warnings: warnings, canonical_url: canonical } };
