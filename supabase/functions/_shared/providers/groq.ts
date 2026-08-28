/* ============================================================
   Groq caller. Ported from server/providers/GroqProvider.js with the
   same three changes as gemini.ts: Deno.env for the key, an AbortSignal
   for the call, and no internal retrying (chain.ts owns that now).

   The model and the forced json_object response format are unchanged.
   ============================================================ */
import type { ChatMessage } from './gemini.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-120b'

export function groqKey(): string | undefined {
  const key = Deno.env.get('GROQ_API_KEY')
  return key && key.trim() ? key : undefined
}

/** @returns raw text — the caller parses, de-fences and shape-validates it. */
export async function callGroq(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Groq responded with ${response.status}: ${detail.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('Groq returned no text content')
  return text
}
