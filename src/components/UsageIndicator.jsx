import { useEffect, useState } from 'react'
import { fetchMyUsage } from '../services/usageService'

/* Only the bands above "healthy" get a note — quiet most of the time is
   the point (spec: the quota should be invisible until it actually
   matters). The bar itself is always drawn once usage has loaded; only
   this line of text and the `is-warning` colour turn on above it. */
const STATUS_NOTE = {
  warning: 'اقتربتِ من الحد الشهري',
  near_limit: 'قريبة جدًا من الحد الشهري',
  critical: 'قريبة جدًا من الحد الشهري — استخدام محدود متبقٍّ',
  limit_reached: 'وصلتِ للحد الشهري لهذا الشهر',
}

/**
 * Compact usage bar for the sidebar footer, next to the account email.
 * Fetches once per mount from get-my-usage (server-computed — never a
 * number this component invents or derives itself) and renders nothing
 * at all if that fails or hasn't configured Supabase: this is a
 * convenience readout, not something worth an error state of its own.
 */
export function UsageIndicator() {
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchMyUsage().then(({ data }) => {
      if (mounted && data) setUsage(data)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (!usage) return null

  const percentage = Math.min(100, Math.max(0, usage.usagePercentage))
  const isWarning = usage.status !== 'healthy'

  return (
    <div className={`usage-indicator${isWarning ? ' is-warning' : ''}`}>
      <div className="usage-indicator-row">
        <span>استخدام أريب</span>
        {/* <bdi> isolates this fragment from the surrounding RTL paragraph
            direction. Without it, the browser's bidi algorithm treats "٠ / ١٠٠،٠٠٠"
            as needing reversal for RTL flow and visually swaps the two
            numbers around the slash — the DOM order stays "used / limit"
            but it renders as "limit / used", which reads as nonsense. */}
        <bdi>
          {usage.tokensUsed.toLocaleString('en-US')} / {usage.tokensLimit.toLocaleString('en-US')}
        </bdi>
      </div>
      <div className="usage-indicator-bar" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}>
        <div className="usage-indicator-fill" style={{ width: `${percentage}%` }} />
      </div>
      {isWarning && <p className="usage-indicator-note">{STATUS_NOTE[usage.status]}</p>}
    </div>
  )
}
