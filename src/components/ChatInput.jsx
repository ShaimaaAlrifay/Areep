import { useEffect, useRef, useState } from 'react'

const MAX_HEIGHT_PX = 200

/**
 * Rounded, dark, auto-growing chat input (Section 17). Enter sends,
 * Shift+Enter inserts a newline. Structured so an attachment affordance
 * can slot in later without a rewrite — see the commented slot below.
 */
export function ChatInput({ onSend, placeholder = 'اكتب رسالتك...', disabled = false }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`chat-input ${disabled ? 'chat-input-disabled' : ''}`}>
      {/* Attachment slot (Section 17: "attachment-ready architecture") —
          intentionally unbuilt this phase. A future phase can render an
          upload/attach button here (e.g. <AttachmentButton onAttach={...} />)
          without restructuring ChatInput or its callers. */}
      <textarea
        ref={textareaRef}
        className="chat-input-textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button
        type="button"
        className="chat-input-send"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="إرسال"
      >
        <SendIcon />
      </button>
    </div>
  )
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12L20 4L13 20L11 13L4 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
