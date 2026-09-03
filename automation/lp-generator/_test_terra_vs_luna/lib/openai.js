'use strict';
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
    return { json: { text: text || '', usage: data && data.usage } };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatCompletion };
