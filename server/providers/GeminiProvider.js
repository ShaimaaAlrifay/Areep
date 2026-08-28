// Gemini HTTP-calling logic, ported from the sibling portfolio's
// server.js (/Users/shaimaaalrifay/Desktop/ShPortfolio/server.js —
// callGemini / callGeminiJSON) and merged into one generateJSON() call:
// it keeps callGemini's system_instruction + multi-turn `contents` shape,
// but forces JSON output the way callGeminiJSON does
// (generationConfig.responseMimeType). The discovery contract needs both
// at once — real conversation history AND strict JSON back.
//
// GEMINI_URL is intentionally identical to the already-working portfolio
// proxy — do not change without confirming against real 429/404 history
// there (see server.js's own comments).

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'

// Free-tier Gemini keys are capped at 20 requests/day each. GEMINI_API_KEY2
// is a second key (separate Google AI Studio project) used purely to double
// that daily ceiling during development — same account owner, same model,
// no behavioral difference. Both live in server/.env; GEMINI_API_KEY2 is
// optional (rotation silently no-ops down to one key if it's unset).
const API_KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean)

async function callWithKey(apiKey, systemPrompt, messages) {
  const contents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Gemini responded with ${response.status}: ${detail}`)
  }

  const data = await response.json()
  const text = (data.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('\n')

  if (!text) throw new Error('Gemini returned no text content')
  return text
}

/**
 * @param {string} systemPrompt
 * @param {{role: 'user'|'assistant', content: string}[]} messages
 * @returns {Promise<string>} raw text response — caller is responsible for
 *   stripping JSON fences, parsing, and shape-validating it.
 *
 * Tries each configured key in order (key rotation, not retries-with-delay
 * — that's still routes/discovery.js's job on top of this). A quota error
 * (429) on key 1 falls straight through to key 2 with no wait; any other
 * per-key error also just moves on to the next key rather than failing
 * the whole call outright.
 */
export async function generateJSON(systemPrompt, messages) {
  if (API_KEYS.length === 0) throw new Error('GEMINI_API_KEY is not set')

  let lastErr
  for (const apiKey of API_KEYS) {
    try {
      return await callWithKey(apiKey, systemPrompt, messages)
    } catch (err) {
      lastErr = err
      console.warn(`[areep-discovery] Gemini key ending in …${apiKey.slice(-6)} failed:`, err.message)
    }
  }
  throw lastErr
}
