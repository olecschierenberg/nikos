import fs from 'node:fs/promises';
import path from 'node:path';

const [sitemapPath = 'sitemap.xml'] = process.argv.slice(2);
const siteRoot = process.cwd();
const baseUrl = 'https://nikos.info/';
const xml = await fs.readFile(path.resolve(siteRoot, sitemapPath), 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());

if (!urls.length) {
  throw new Error('Die Sitemap enthält keine <loc>-Einträge.');
}

const toTargetFile = (url) => {
  if (!url.startsWith(baseUrl)) throw new Error(`Ungültige oder externe Sitemap-URL: ${url}`);
  const relativeUrl = decodeURIComponent(url.slice(baseUrl.length));
  if (relativeUrl.includes('..') || relativeUrl.startsWith('lp-preview/')) {
    throw new Error(`Nicht indexierbarer oder unsicherer Sitemap-Pfad: ${url}`);
  }
  const relativeFile = !relativeUrl || relativeUrl.endsWith('/')
    ? path.join(relativeUrl, 'index.html')
    : relativeUrl;
  return path.resolve(siteRoot, relativeFile);
};

const issues = [];
for (const url of urls) {
  try {
    const target = toTargetFile(url);
    if (!target.startsWith(siteRoot + path.sep) && target !== siteRoot) {
      throw new Error(`Pfad verlässt das Repository: ${url}`);
    }
    let html;
    try {
      html = await fs.readFile(target, 'utf8');
    } catch {
      throw new Error(`Verwaiste Sitemap-URL ohne HTML-Ziel: ${url}`);
    }
    const robotTags = html.match(/<meta\b[^>]*>/gi) || [];
    if (robotTags.some((tag) => /\bname\s*=\s*["']robots["']/i.test(tag) && /\bcontent\s*=\s*["'][^"']*\bnoindex\b/i.test(tag))) {
      throw new Error(`Noindex-Seite darf nicht in der Sitemap stehen: ${url}`);
    }
  } catch (error) {
    issues.push(error.message);
  }
}

if (issues.length) {
  console.error(`Sitemap-Prüfung fehlgeschlagen (${issues.length} Problem(e)):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Sitemap-Prüfung erfolgreich: ${urls.length} vorhandene, indexierbare URLs; keine Preview- oder verwaisten Landingpage-URLs.`);
