// Shared PRD-generation helpers. sanitizeProjectSlug is ported verbatim
// (same regex, same fallback) from the sibling portfolio's server.js —
// never trust raw model output for something that becomes a downloaded
// filename: strip anything that isn't [A-Za-z0-9_], collapse/trim
// underscores, and fall back to a generic slug if the result is empty
// (e.g. the model returned Arabic, punctuation-only, or omitted the
// field entirely).
export function sanitizeProjectSlug(raw) {
  const stripped = typeof raw === 'string' ? raw.replace(/[^A-Za-z0-9_]+/g, '_') : ''
  const collapsed = stripped.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return collapsed || 'Areeb_PRD'
}
