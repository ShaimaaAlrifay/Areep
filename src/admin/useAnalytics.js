import { useCallback, useEffect, useState } from 'react'
import { fetchAnalytics, selectMetrics } from './analytics/client'
import { resolveRange } from './analytics/ranges'

/* One fetch for the whole dashboard, owned by the shell and shared with
   every page through Outlet context. Sections read the same snapshot, so
   two pages can never show numbers computed seconds apart. */
export function useAnalytics(presetId, compareMode, customRange = null) {
  const [state, setState] = useState({ loading: true, metrics: null, error: null, range: null })
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    const range = resolveRange(presetId, compareMode, customRange)
    setState((prev) => ({ ...prev, loading: true, error: null, range }))

    fetchAnalytics(range).then(({ data, error }) => {
      if (!active) return
      if (error) {
        setState({ loading: false, metrics: null, error, range })
        return
      }
      setState({ loading: false, metrics: selectMetrics(data), error: null, range })
    })

    return () => {
      active = false
    }
  }, [presetId, compareMode, customRange?.from, customRange?.to, nonce])

  return { ...state, refresh }
}
