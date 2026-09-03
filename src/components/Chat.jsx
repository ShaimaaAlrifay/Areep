import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../lib/site'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { ThinkingIndicator } from './ThinkingIndicator'

/* One line per AI Gateway quota code (see supabase/functions/_shared/quota.ts's
   ERROR_COPY, which supplies the sentence itself) — this is only the
   banner's headline, kept apart from the message so "you're rate limited"
   and "you're out of tokens for the month" don't read as the same event. */
const QUOTA_BANNER_TITLES = {
  QUOTA_EXCEEDED: 'وصلتِ للحد الشهري',
  DAILY_LIMIT_EXCEEDED: 'وصلتِ للحد اليومي',
  REQUEST_TOO_LARGE: 'الطلب كبير جدًا',
  AI_RATE_LIMITED: 'أريب مشغول حاليًا',
}

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
  limitReached = null,
  quotaBanner = null,
  readyForReview = false,
  reviewHref = null,
  onGeneratePrd = null,
  generatingPrd = false,
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
          {/* A configured business rule, not a technical failure — a
              distinct banner instead of the generic error paragraph above,
              so it reads as "this is a limit you can act on" rather than
              "something broke." The CTA only appears when a real contact
              address is configured (see src/lib/site.js's CONTACT_EMAIL) —
              same rule as everywhere else in this app: no invented contact
              channel nobody actually reads. */}
          {limitReached && (
            <div className="project-limit-banner chat-inline-error" role="alert">
              <p className="project-limit-title">وصلت للحد الأقصى من المشاريع</p>
              <p className="project-limit-text">لقد وصلت إلى الحد المسموح لك بإنشائه حاليًا.</p>
              {limitReached.limit !== null && (
                <p className="project-limit-current">
                  الحد الحالي: <strong>{limitReached.limit}</strong> {limitReached.limit === 1 ? 'مشروع' : 'مشاريع'}
                </p>
              )}
              {CONTACT_EMAIL && (
                <a className="btn btn-secondary btn-sm" href={`mailto:${CONTACT_EMAIL}`}>
                  تواصل مع الإدارة لزيادة الحد
                </a>
              )}
            </div>
          )}
          {/* Same treatment as the project-limit banner above: a
              configured quota, not a bug, so it gets its own banner
              instead of the generic error paragraph. Reuses that banner's
              CSS class rather than a parallel one. */}
          {quotaBanner && (
            <div className="project-limit-banner chat-inline-error" role="alert">
              <p className="project-limit-title">{QUOTA_BANNER_TITLES[quotaBanner.code] ?? 'تنبيه بخصوص الاستخدام'}</p>
              <p className="project-limit-text">{quotaBanner.message}</p>
            </div>
          )}
          {readyForReview && (reviewHref || onGeneratePrd) && (
            <div className="discovery-ready-banner" role="status">
              {/* Once the discovery agent reports `ready` (Sections 24, 27),
                  building the document is the primary action — reviewing the
                  extracted requirements first stays available beside it, but
                  the user shouldn't have to go hunting for a second button on
                  another page to get the thing they came for. */}
              <p className="discovery-ready-text">أريب فهم فكرتك — جاهزين نجهّز وثيقة المتطلبات.</p>
              <div className="discovery-ready-actions">
                {onGeneratePrd && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={onGeneratePrd} disabled={generatingPrd}>
                    {generatingPrd ? 'أريب يبني وثيقتك…' : 'جهّز وثيقة PRD'}
                  </button>
                )}
                {reviewHref && (
                  <Link to={reviewHref} className="btn btn-secondary btn-sm">
                    راجع المتطلبات
                  </Link>
                )}
              </div>
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
