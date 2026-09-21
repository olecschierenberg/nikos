// Einfache Ergebnis-Seiten (Design wie bisher in n8n)
import { esc } from './util.mjs';

/**
 * @param {{icon:string,title:string,heading:string,bodyHtml:string,button?:{label:string,href:string}}} o
 * bodyHtml darf HTML enthalten – dynamische Werte vorher mit esc() behandeln!
 */
export function card({ icon, title, heading, bodyHtml, button, extraHtml = '' }) {
  const btn = button
    ? `<a href="${esc(button.href)}" style="display:inline-block;background:#FF6600;color:#fff;padding:12px 28px;border-radius:4px;font-size:15px;font-weight:600;text-decoration:none;">${esc(button.label)}</a>`
    : '';
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} – NIKOS</title><meta name="robots" content="noindex"></head><body style="margin:0;font-family:'Source Sans 3',system-ui,Segoe UI,sans-serif;background:#E3E6EA;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;"><div style="background:#fff;border-radius:4px;border-top:4px solid #FF6600;box-shadow:0 8px 32px rgba(30,42,53,.14);max-width:520px;width:100%;padding:48px 40px;text-align:center;"><div style="font-size:52px;line-height:1;">${icon}</div><h1 style="font-size:24px;color:#1E2A35;margin:20px 0 12px;">${esc(heading)}</h1><p style="font-size:16px;color:#595959;line-height:1.6;margin:0 0 28px;">${bodyHtml}</p>${extraHtml}${btn}</div></body></html>`;
}

export const OK = '✅';
export const WARN = '⚠️';
