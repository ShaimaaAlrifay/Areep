// Shared helpers ported as-is from the sibling portfolio's server.js
// (/Users/shaimaaalrifay/Desktop/ShPortfolio/server.js) — both are already
// debugged against real Gemini/Groq JSON-mode quirks (```json fences,
// occasional malformed output on the first try).

/** Strips ```json ... ``` fences models sometimes wrap JSON output in. */
export function stripJsonFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/** Retries `fn` up to `attempts` times, waiting `delayMs` between tries. */
export async function withRetries(fn, attempts, delayMs) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        console.warn(`[areep-discovery] attempt ${i + 1}/${attempts} failed, retrying in ${delayMs}ms:`, err.message)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  throw lastErr
}
