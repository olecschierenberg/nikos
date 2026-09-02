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
if (!canonical || !/^https:\/\/nikos\.info\//.test(canonical)) hardErrors.push('CANONICAL_INVALID');
if (/hreflang\s*=/i.test(html)) hardErrors.push('HREFLANG_FORBIDDEN_UNTIL_V2_URL_SPLIT');
if (h1Count < 1) hardErrors.push('H1_MISSING');
// Titel-/Meta-Laengenpruefung VOR Veroeffentlichung (verbindlich seit 02.09.2026, siehe
// project_memory.md): vorher nur Warnung -- dadurch gingen wiederholt zu lange bzw. mitten
// im Satz abgeschnittene Title-/Description-Tags live (Ahrefs-Fehler "Title zu lang" /
// "Meta-Beschreibung zu lang"). Jetzt harter Block: eine Seite mit falscher Laenge wird gar
// nicht erst nach lp-preview/ geschrieben (siehe index.js, SEO Gate laeuft vor "Vorschau
// schreiben"). Der Lauf bricht ab und die Zeile bleibt in der Warteschlange fuer den naechsten
// stuendlichen Versuch mit neu generiertem KI-Text.
if (title && (title.length < 45 || title.length > 60)) hardErrors.push('TITLE_LENGTH_OUTSIDE_45_60');
if (description && (description.length < 140 || description.length > 155)) hardErrors.push('META_DESCRIPTION_LENGTH_OUTSIDE_140_155');
if (h1Count > 1) warnings.push('MULTIPLE_LANGUAGE_H1_ELEMENTS_PRESENT');
if (hardErrors.length) throw new Error('SEO_GATE_BLOCKED: ' + hardErrors.join(','));
return { json: { ...data, seo_gate: warnings.length ? 'warning' : 'pass', seo_warnings: warnings, canonical_url: canonical } };
