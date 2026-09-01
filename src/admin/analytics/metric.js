/* ============================================================
   The shape every number on the dashboard arrives in.

   The important field is `available`. A dashboard that renders a missing
   measurement as 0 is worse than one that renders nothing: it answers the
   owner's question with a number nobody measured. So there are three
   distinct states, and they look different on screen:

     available: true,  value: 0     → a real zero. Nothing happened.
     available: false               → not tracked. Says what is missing.
     value: null, available: true   → tracked, but no sample yet.

   `status` is about direction, not colour: a metric where down is good
   (cost, error rate, time-to-value) passes `lowerIsBetter` and gets the
   same reading as one where up is good.
   ============================================================ */

export const NOT_TRACKED = 'not_tracked'

/**
 * @param {object} input
 * @param {number|null} input.value
 * @param {number|null} [input.previousValue]
 * @param {number[]}    [input.trend]
 * @param {boolean}     [input.lowerIsBetter]
 * @param {string}      [input.unavailableReason] what tracking is missing
 */
export function metric({
  value,
  previousValue = null,
  trend = [],
  lowerIsBetter = false,
  unavailableReason = null,
  sampleSize = null,
  note = null,
}) {
  if (unavailableReason) {
    return { available: false, reason: unavailableReason, value: null, previousValue: null, change: null, trend: [], status: 'unknown', note }
  }

  const hasBoth = typeof value === 'number' && typeof previousValue === 'number' && previousValue !== 0
  const change = hasBoth ? ((value - previousValue) / previousValue) * 100 : null

  let status = 'neutral'
  if (change !== null && Math.abs(change) >= 0.5) {
    const rising = change > 0
    status = rising === !lowerIsBetter ? 'positive' : 'negative'
  }

  return { available: true, reason: null, value, previousValue, change, trend, status, sampleSize, note, lowerIsBetter }
}

/** A metric the product has no way to measure yet. */
export function notTracked(reason, note = null) {
  return metric({ value: null, unavailableReason: reason, note })
}

const AR_UNITS = ['', ' ألف', ' مليون']

export function formatValue(value, kind = 'number') {
  if (value === null || value === undefined) return '—'
  if (kind === 'percent') return `${Number(value).toFixed(1)}٪`
  if (kind === 'money') return `$${Number(value).toFixed(2)}`
  if (kind === 'duration') {
    const s = Math.max(0, Math.round(value))
    if (s < 60) return `${s}ث`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}د ${String(s % 60).padStart(2, '0')}ث`
    return `${Math.floor(m / 60)}س ${String(m % 60).padStart(2, '0')}د`
  }
  if (kind === 'decimal') return Number(value).toFixed(2)
  const n = Number(value)
  if (n < 1000) return String(n)
  let unit = 0
  let scaled = n
  while (scaled >= 1000 && unit < AR_UNITS.length - 1) {
    scaled /= 1000
    unit += 1
  }
  return `${scaled.toFixed(scaled < 10 ? 1 : 0)}${AR_UNITS[unit]}`
}

export function formatChange(change) {
  if (change === null || change === undefined) return null
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→'
  return `${arrow} ${Math.abs(change).toFixed(1)}٪`
}
