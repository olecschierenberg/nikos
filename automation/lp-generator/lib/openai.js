'use strict';
/**
 * Direkter OpenAI-Chat-Completions-Aufruf als Ersatz für die drei
 * n8n-LangChain-Nodes ("OpenAI Modell B" / "AI Texte (DE+EN)", "OpenAI Chat
 * Model" / "QA-Agent", "OpenAI Modell Nachbesserung" / "Nachbesserung").
 * Gleiche Modelle, gleiche System-/User-Prompts (siehe lib/prompts/*.txt),
 * gleiche maxTokens/Timeout/Retry-Werte wie im n8n-Workflow konfiguriert.
 *
 * Die n8n-chainLlm-Node liefert bei "promptType: define" ohne Output-Parser
 * ein Objekt mit Feld "text" (Rohtext der Modell-Antwort) zurück — das
 * bilden wir hier bewusst identisch nach, weil der nachgelagerte Code
 * (lib/nodes/texte_json.js, qa_json.js, nachbesserung_json.js) genau dieses
 * Format als Fallback erwartet (parsing von ```json-Codeblöcken o. ä.).
 */

async function chatCompletion({ apiKey, model, system, user, maxTokens, timeoutMs, maxRetries }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const attempts = Math.max(1, (maxRetries || 0) + 1);
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callOnce({ apiKey, model, messages, maxTokens, timeoutMs });
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastErr;
}

async function callOnce({ apiKey, model, messages, maxTokens, timeoutMs, tokenParam }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 180000);
  try {
    const body = {
      model,
      messages,
      [tokenParam || 'max_tokens']: maxTokens || 2600,
    };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
      // Manche Modell-Familien akzeptieren nur "max_completion_tokens" statt
      // "max_tokens" — einmalig mit dem jeweils anderen Parameter erneut
      // versuchen, bevor der Fehler weitergereicht wird.
      if (!tokenParam && /max_tokens/i.test(msg)) {
        return await callOnce({
          apiKey, model, messages, maxTokens, timeoutMs, tokenParam: 'max_completion_tokens',
        });
      }
      throw new Error(`OpenAI-Fehler (${model}): ${msg}`);
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    return { json: { text: text || '' } };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatCompletion };
