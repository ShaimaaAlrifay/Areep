/**
 * Editorial message block (Section 18) — deliberately not a WhatsApp-style
 * bubble. Assistant turns are plain text with a small label and a quiet
 * inline-start accent border; user turns get a subtle surface tint. Reads
 * like a workspace document, not a messaging app.
 */
export function Message({ role, content }) {
  const isAssistant = role === 'assistant'
  return (
    <div className={`message message-${isAssistant ? 'assistant' : 'user'}`}>
      {isAssistant && <span className="message-label">أريب</span>}
      <p className="message-content">{content}</p>
    </div>
  )
}
