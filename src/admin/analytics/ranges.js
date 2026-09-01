/* Date-range presets and the comparison window (spec §02).
   Ranges are half-open [from, to) so a day never lands in two buckets. */

export const PRESETS = [
  { id: 'today', label: 'اليوم', days: 1 },
  { id: '7d', label: '7 أيام', days: 7 },
  { id: '30d', label: '30 يوم', days: 30 },
  { id: '90d', label: '90 يوم', days: 90 },
  { id: '12m', label: '12 شهر', days: 365 },
]

export const COMPARE_MODES = [
  { id: 'previous', label: 'الفترة السابقة' },
  { id: 'year', label: 'العام الماضي' },
  { id: 'none', label: 'بدون مقارنة' },
]

/**
 * @param {string} presetId one of PRESETS, ignored when `custom` is set
 * @param {string} compareMode one of COMPARE_MODES
 * @param {{from: string, to: string}|null} custom two yyyy-mm-dd values —
 *   `to` is treated as inclusive (end of that day), matching how a date
 *   picker reads to an owner, then converted to the half-open bound the
 *   query actually needs.
 */
export function resolveRange(presetId, compareMode, custom = null) {
  let preset
  let from
  let to

  if (custom?.from && custom?.to) {
    from = new Date(`${custom.from}T00:00:00`)
    to = new Date(new Date(`${custom.to}T00:00:00`).getTime() + 86400000)
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))
    preset = { id: 'custom', label: 'مخصّص', days }
  } else {
    preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2]
    to = new Date()
    from = new Date(to.getTime() - preset.days * 86400000)
  }

  let compareFrom = null
  let compareTo = null
  if (compareMode === 'previous') {
    compareTo = from
    compareFrom = new Date(from.getTime() - preset.days * 86400000)
  } else if (compareMode === 'year') {
    compareFrom = new Date(from.getTime() - 365 * 86400000)
    compareTo = new Date(to.getTime() - 365 * 86400000)
  }

  return {
    preset,
    from: from.toISOString(),
    to: to.toISOString(),
    compareFrom: compareFrom ? compareFrom.toISOString() : null,
    compareTo: compareTo ? compareTo.toISOString() : null,
  }
}
