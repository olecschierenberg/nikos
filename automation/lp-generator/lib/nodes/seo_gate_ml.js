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
if (description && (description.length < 100 || description.length > 165)) hardErrors.push('META_DESCRIPTION_LENGTH_OUTSIDE_100_165');
if (hardErrors.length) throw new Error('SEO_GATE_ML_BLOCKED(' + (data.lang || '?') + '): ' + hardErrors.join(','));
return { json: { ...data, seo_gate: warnings.length ? 'warning' : 'pass', seo_warnings: warnings, canonical_url: canonical } };
