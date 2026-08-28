import { Router } from 'express'
import { stripJsonFences, withRetries } from '../lib/jsonUtils.js'
import { validateDiscoveryResponse } from '../lib/validateDiscoveryResponse.js'
import { DISCOVERY_SYSTEM_PROMPT } from '../prompts/gemini/discovery.system.js'
import { generateJSON as generateGeminiJSON } from '../providers/GeminiProvider.js'
import { generateJSON as generateGroqJSON } from '../providers/GroqProvider.js'

// Spec section 48's exact copy for "we couldn't make sense of the AI's
// reply" — never leak a raw stack trace or parse error to the client.
const GENERIC_ERROR_MESSAGE = 'ما قدرت أحلل الإجابة حالياً. حاول مرة ثانية.'

export const discoveryRouter = Router()

/**
 * Runs `generateFn` (a provider's generateJSON) through the parse +
 * shape-validate + retry pipeline. Gemini/Groq occasionally return
 * malformed or off-shape JSON on the first try (confirmed live in the
 * sibling portfolio's PRD-generation path) — retry the whole call (fresh
 * generation, not just parsing) before giving up on that provider.
 */
async function runProvider(generateFn, messages, attempts) {
  return withRetries(
    async () => {
      const raw = await generateFn(DISCOVERY_SYSTEM_PROMPT, messages)
      const candidate = JSON.parse(stripJsonFences(raw))
      if (!validateDiscoveryResponse(candidate)) {
        throw new Error('Discovery response failed shape validation')
      }
      return candidate
    },
    attempts,
    2000,
  )
}

/**
 * POST /api/discovery
 * Body: { projectId, history: [{ role: 'user'|'assistant', content }, ...] }
 * (the just-sent user message is the last entry).
 *
 * Gemini (rotating across GEMINI_API_KEY / GEMINI_API_KEY2, see
 * GeminiProvider.js) is tried first — it's the spec's designated Discovery
 * Agent (section 20) and the one the prompt/persona is tuned for. Groq only
 * steps in if Gemini is completely exhausted (both keys, both retries) —
 * a resilience fallback, not a role swap: same discovery system prompt,
 * same JSON contract, same persona, just a different model behind it for
 * that one turn.
 */
discoveryRouter.post('/discovery', async (req, res) => {
  const { projectId, history } = req.body || {}

  const messages = Array.isArray(history)
    ? history
        .filter((entry) => entry && typeof entry.content === 'string' && entry.content.trim() && (entry.role === 'user' || entry.role === 'assistant'))
        .map((entry) => ({ role: entry.role, content: entry.content }))
    : []

  if (messages.length === 0) {
    res.status(400).json({ error: 'invalid_request', message: 'المحادثة فارغة.' })
    return
  }

  try {
    const parsed = await runProvider(generateGeminiJSON, messages, 2)
    res.status(200).json(parsed)
    return
  } catch (geminiErr) {
    console.warn(`[areep-discovery] Gemini failed for project ${projectId ?? '(unknown)'}, falling back to Groq:`, geminiErr.message)
  }

  try {
    const parsed = await runProvider(generateGroqJSON, messages, 2)
    res.status(200).json(parsed)
  } catch (groqErr) {
    console.warn(`[areep-discovery] Groq fallback also failed for project ${projectId ?? '(unknown)'}:`, groqErr.message)
    res.status(502).json({ error: 'discovery_failed', message: GENERIC_ERROR_MESSAGE })
  }
})
