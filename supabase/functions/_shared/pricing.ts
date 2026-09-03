/* ============================================================
   Cost estimation, kept out of business logic on purpose.

   Both providers run on free-tier keys today and neither has an
   authoritative $/token figure attached to this project's actual billing
   — filling PRICING in with a guessed number would put an invented
   dollar figure in front of an admin who would reasonably read it as
   real. calculateEstimatedCost() is a real abstraction so a later PR that
   *does* have real prices only ever has to fill in this table; nothing
   that calls it needs to change.
   ============================================================ */

interface ModelPrice {
  /** USD per 1,000 input tokens. */
  input: number
  /** USD per 1,000 output tokens. */
  output: number
}

/** Empty on purpose — see the file header. Add a model here once a real,
 *  current price is known for it. */
const PRICING: Record<string, Record<string, ModelPrice>> = {
  gemini: {},
  groq: {},
}

/**
 * @returns the estimated cost in USD, or null when no reliable price is
 *   configured for this provider/model — never a guessed number.
 */
export function calculateEstimatedCost(
  provider: string,
  model: string | null,
  promptTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!model || promptTokens === null || outputTokens === null) return null
  const price = PRICING[provider]?.[model]
  if (!price) return null
  return (promptTokens / 1000) * price.input + (outputTokens / 1000) * price.output
}
