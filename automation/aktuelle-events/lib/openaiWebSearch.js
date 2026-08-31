'use strict';
/**
 * OpenAI-Responses-API-Aufruf MIT Websuche, als Ersatz fuer den n8n-Node
 * "Message a model" (@n8n/n8n-nodes-langchain.openAi, Modell gpt-5.4-mini,
 * builtInTools.webSearch.searchContextSize="medium", reasoning.effort="low",
 * maxTokens=32768). n8n nutzt dafuer intern die Responses-API mit dem
 * eingebauten "web_search"-Tool -- das bilden wir hier direkt per REST-Call
 * gegen POST /v1/responses nach (kein Chat-Completions-Aufruf wie in den
 * anderen automation/*-Skripten, weil Chat Completions keine eingebaute
 * Websuche kennt).
 *
 * Rueckgabe: der rohe Antworttext (String) -- das Parsen/Validieren gegen
 * das erwartete JSON-Schema passiert wie im n8n-Original im nachgelagerten
 * Code-Node (siehe index.js, Funktion parseUpdatesJson, 1:1 Port von
 * "JSON parsen").
 */

async function webSearchCompletion({ apiKey, model, system, user, maxOutputTokens, timeoutMs, maxRetries }) {
  const attempts = Math.max(1, (maxRetries || 0) + 1);
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callOnce({ apiKey, model, system, user, maxOutputTokens, timeoutMs });
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

async function callOnce({ apiKey, model, system, user, maxOutputTokens, timeoutMs, toolType, withReasoning }) {
  const tt = toolType || 'web_search';
  const wr = withReasoning === undefined ? true : withReasoning;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 240000);
  try {
    const body = {
      model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      tools: [{ type: tt, search_context_size: 'medium' }],
      max_output_tokens: maxOutputTokens || 32768,
    };
    if (wr) body.reasoning = { effort: 'low' };
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
      // Defensive Fallbacks: manche Modelle/API-Versionen lehnen "reasoning" oder
      // den Tool-Typ "web_search" ab (aeltere Bezeichnung "web_search_preview").
      if (wr && /reasoning/i.test(msg)) {
        return await callOnce({ apiKey, model, system, user, maxOutputTokens, timeoutMs, toolType: tt, withReasoning: false });
      }
      if (tt === 'web_search' && /(tool|web_search)/i.test(msg)) {
        return await callOnce({ apiKey, model, system, user, maxOutputTokens, timeoutMs, toolType: 'web_search_preview', withReasoning: wr });
      }
      throw new Error(`OpenAI-Fehler (${model}, Responses API): ${msg}`);
    }
    return extractText(data);
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const out = Array.isArray(data.output) ? data.output : [];
  let text = '';
  for (const item of out) {
    if (item && item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c && (c.type === 'output_text' || c.type === 'text') && typeof c.text === 'string') text += c.text;
      }
    }
  }
  return text;
}

module.exports = { webSearchCompletion };
