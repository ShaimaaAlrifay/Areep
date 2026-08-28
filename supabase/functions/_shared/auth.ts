/* ============================================================
   Requires a real signed-in user, not merely a valid credential.

   Why this exists on top of verify_jwt = true:

   verify_jwt only asserts that the caller presented a credential the
   project accepts. The publishable key (sb_publishable_...) is exactly
   such a credential — and it is *public*, shipped inside the frontend
   bundle for anyone to read. Confirmed against the deployed function:
   a request carrying only the publishable key passed verify_jwt and
   reached the handler.

   That is the quota-abuse hole this migration was meant to close. Anyone
   who viewed source could invoke discovery or PRD generation in a loop
   and spend the project's Gemini and Groq quota.

   A genuine user session token is a three-part JWT whose payload carries
   role = "authenticated" and a `sub` (the user id). The publishable key is
   not a JWT at all, so it fails the first check.

   The signature is deliberately NOT re-verified here: with verify_jwt on,
   the platform has already rejected any JWT that does not verify against
   the project's keys before this code runs. Re-checking would cost a
   network round-trip to prove something already proven. What is left to
   decide — and what only the application can decide — is whether these
   verified claims describe a signed-in user or a public key.
   ============================================================ */

export interface UserClaims {
  sub: string
  role: string
  email?: string
}

function decodeBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  /* The payload is UTF-8; atob yields Latin-1, so an Arabic email or name
     in a claim would otherwise come back mangled. */
  const binary = atob(withPadding)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * @returns the caller's claims, or null when the request is not from a
 *   signed-in user. Callers must treat null as 401 and must not run any
 *   provider call for it.
 */
export function authenticatedUser(req: Request): UserClaims | null {
  const header = req.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()

  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const claims = JSON.parse(decodeBase64Url(parts[1]))
    if (claims?.role !== 'authenticated') return null
    if (typeof claims.sub !== 'string' || !claims.sub) return null
    return claims as UserClaims
  } catch {
    return null
  }
}
