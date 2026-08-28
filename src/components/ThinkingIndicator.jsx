/**
 * Extremely minimal "thinking" state (Section 19) — a few pulsing dots and
 * a text label. No AI-avatar animation, no orb, no glow. This phase has no
 * async AI call to attach it to (Gemini discovery lands next phase); it's
 * only wired into the new-project creation gap for now (see ChatPage's
 * `thinking`/`thinkingLabel` usage), so the component itself is ready for
 * the next phase to reuse for a real "أريب يحلل إجابتك..." moment.
 */
export function ThinkingIndicator({ label = 'أريب يحلل إجابتك...' }) {
  return (
    <div className="thinking-indicator" role="status" aria-live="polite">
      <span className="thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="thinking-label">{label}</span>
    </div>
  )
}
