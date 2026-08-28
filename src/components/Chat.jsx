import { Link } from 'react-router-dom'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { ThinkingIndicator } from './ThinkingIndicator'

/**
 * The shared chat layout (Section 16) — sidebar lives in <AppShell>, this
 * is just the message column + pinned input. Used for both the scripted
 * new-project flow and an existing project's persisted conversation.
 */
export function Chat({
  messages,
  onSend,
  quickReplies = null,
  onQuickReply,
  placeholder,
  disabled = false,
  thinking = false,
  thinkingLabel,
  error = null,
  onRetry,
  readyForReview = false,
  reviewHref = null,
}) {
  return (
    <div className="chat">
      <div className="chat-scroll">
        <div className="chat-column">
          <MessageList messages={messages} />
          {thinking && <ThinkingIndicator label={thinkingLabel} />}
          {error && (
            <div className="chat-inline-error-wrap">
              <p className="form-error chat-inline-error">{error}</p>
              {onRetry && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                  حاول مرة ثانية
                </button>
              )}
            </div>
          )}
          {readyForReview && reviewHref && (
            <div className="discovery-ready-banner" role="status">
              <Link to={reviewHref} className="btn btn-secondary btn-sm">
                راجع المتطلبات
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="chat-input-area">
        <div className="chat-column">
          {quickReplies && quickReplies.length > 0 && (
            <div className="quick-replies" role="group" aria-label="خيارات سريعة">
              {quickReplies.map((option) => (
                <button
                  key={option.value || 'skip'}
                  type="button"
                  className="quick-reply-chip"
                  onClick={() => onQuickReply?.(option.value)}
                  disabled={disabled}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <ChatInput onSend={onSend} placeholder={placeholder} disabled={disabled} />
        </div>
      </div>
    </div>
  )
}
