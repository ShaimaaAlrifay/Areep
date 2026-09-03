/* ============================================================
   Gemini caller. Ported from server/providers/GeminiProvider.js.

   The HTTP shape is unchanged and deliberately so — the URL, the
   system_instruction + multi-turn `contents` body, and the
   responseMimeType that forces JSON are all already proven against real
   Gemini behaviour. Do not "tidy" them without re-testing live.

   Three things differ from the Node original:

   1. process.env -> Deno.env.get. The keys now come from Supabase
      Secrets and never reach the browser.
   2. Key rotation no longer loops internally. The caller composes one
      Attempt per key (see chain.ts) so that each key gets its own slice
      of the time budget and the whole chain stays bounded. Rotation that
      hid inside this function could silently double a request's duration.
   3. Every call takes an AbortSignal, so a hung request is cut off
      instead of consuming the function's 150s wall clock.
   ============================================================ */

export const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProviderUsage {
  promptTokens: number | null
  outputTokens: number | null
}

export interface ProviderResult {
  text: string
  usage: ProviderUsage | null
}

/** Thrown on a non-2xx response, carrying the HTTP status so callers can
 *  tell a rate limit (429) apart from any other failure without parsing
 *  the message string. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

/**
 * Free-tier Gemini keys are capped per day, so a second key (a separate
 * AI Studio project, same owner and model) doubles the ceiling.
 * GEMINI_API_KEY2 is optional — the list simply gets shorter without it.
 */
export function geminiKeys(): string[] {
  return [Deno.env.get('GEMINI_API_KEY'), Deno.env.get('GEMINI_API_KEY2')].filter(
    (key): key is string => Boolean(key && key.trim()),
  )
}

/** @returns the raw text (the caller parses, de-fences and shape-validates
 *  it) plus token usage, when Gemini reported it. */
export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResult> {
  const contents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ProviderError(`Gemini responded with ${response.status}: ${detail.slice(0, 200)}`, response.status)
  }

  const data = await response.json()
  const text = (data.candidates || [])
    .flatMap((candidate: { content?: { parts?: { text?: string }[] } }) => candidate?.content?.parts || [])
    .map((part: { text?: string }) => part?.text || '')
    .filter(Boolean)
    .join('\n')

  if (!text) throw new Error('Gemini returned no text content')

  // usageMetadata is present on every real Gemini response; absent only
  // if the API shape ever changes, in which case null (not 0) is what
  // this table's "null is not zero" rule expects.
  const meta = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined
  const usage: ProviderUsage | null = meta
    ? { promptTokens: meta.promptTokenCount ?? null, outputTokens: meta.candidatesTokenCount ?? null }
    : null

  return { text, usage }
}
