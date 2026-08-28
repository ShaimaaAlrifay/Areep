// Groq HTTP-calling logic, ported from the sibling portfolio's server.js
// (/Users/shaimaaalrifay/Desktop/ShPortfolio/server.js — callGroq /
// callGroqJSON) and merged the same way GeminiProvider.js is: full
// multi-turn message history PLUS forced JSON output
// (response_format: json_object).
//
// Two callers: routes/discovery.js uses this as a resilience fallback when
// Gemini is fully exhausted (both API keys, all retries) — same discovery
// prompt/persona/JSON contract, just a different model for that turn, not
// a role swap. Groq's own documented role per the product spec (section
// 20) is PRD generation in a later phase, which will also call this same
// generateJSON with a different (PRD) system prompt.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-120b'

/**
 * @param {string} systemPrompt
 * @param {{role: 'user'|'assistant', content: string}[]} messages
 * @returns {Promise<string>} raw text response — caller is responsible for
 *   stripping JSON fences, parsing, and shape-validating it.
 */
export async function generateJSON(systemPrompt, messages) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  const groqMessages = [{ role: 'system', content: systemPrompt }, ...messages.map((message) => ({ role: message.role, content: message.content }))]

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: groqMessages,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Groq responded with ${response.status}: ${detail}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''

  if (!text) throw new Error('Groq returned no text content')
  return text
}
