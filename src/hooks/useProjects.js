import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProjects } from '../services/projectsService'

/**
 * The signed-in org's projects, most-recently-updated first — backs both
 * the sidebar list and the /chat index redirect-to-most-recent behavior.
 * Owned once by <AppShell> and shared with routed pages via Outlet context
 * so a newly-created project shows up in the sidebar without a duplicate
 * fetch.
 */
export function useProjects(organizationId) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured || !organizationId) {
      setProjects([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: fetchError } = await listProjects(organizationId)
    if (fetchError) {
      setError(fetchError)
    } else {
      setError(null)
      setProjects(data || [])
    }
    setLoading(false)
  }, [organizationId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!isSupabaseConfigured || !organizationId) {
        if (mounted) {
          setProjects([])
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const { data, error: fetchError } = await listProjects(organizationId)
      if (!mounted) return
      if (fetchError) {
        setError(fetchError)
      } else {
        setError(null)
        setProjects(data || [])
      }
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [organizationId])

  return { projects, loading, error, refetch }
}
