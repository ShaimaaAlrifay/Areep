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

export function resolveRange(presetId, compareMode) {
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2]
  const to = new Date()
  const from = new Date(to.getTime() - preset.days * 86400000)

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
