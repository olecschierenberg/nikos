'use strict';
/**
 * Direkter OpenAI-Chat-Completions-Aufruf als Ersatz für die n8n-LangChain-
 * Kette "OpenAI Modell" (Chat-Model, gpt-5.4-mini, serviceTier "flex") +
 * "Kombinationen vorschlagen" (Agent, promptType "define") + "JSON-Parser"
 * (Structured-Output-Parser mit festem Schema
 * { kombinationen: [{ Problem, Einsatz, Region }] }).
 *
 * n8n injiziert bei einem konfigurierten Output-Parser automatisch eine
 * Formatierungsanweisung in den Prompt und parst die Modellantwort gegen
 * das Schema. Das lässt sich mit einem direkten API-Aufruf nicht
 * unsichtbar nachbilden — hier bewusst NICHT als "1:1 unveränderte Kopie"
 * deklariert (anders als die reinen Code-Nodes): die JSON-Ausgabeanweisung
 * steht explizit am Ende von lib/prompts/kombinationen-vorschlagen.system.txt,
 * und statt eines separaten Parsers erzwingt response_format:"json_object"
 * plus JSON.parse() direkt hier dasselbe Ergebnis (gleiches Modell,
 * gleicher inhaltlicher System-/User-Prompt, gleiches Zielschema).
 */

async function chatCompletionJson({ apiKey, model, system, user, timeoutMs, maxRetries }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const attempts = Math.max(1, (maxRetries || 0) + 1);
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callOnce({ apiKey, model, messages, timeoutMs });
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastErr;
}

async function callOnce({ apiKey, model, messages, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 120000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        service_tier: 'flex', // 1:1 aus n8n-Node-Option "serviceTier: flex"
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
      throw new Error(`OpenAI-Fehler (${model}): ${msg}`);
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`OpenAI-Antwort ist kein gültiges JSON: ${e.message}\nRohtext: ${text.slice(0, 500)}`);
    }
    if (!parsed || !Array.isArray(parsed.kombinationen)) {
      throw new Error('OpenAI-Antwort enthält kein Feld "kombinationen" (Array) — Schema-Abweichung.');
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatCompletionJson };
