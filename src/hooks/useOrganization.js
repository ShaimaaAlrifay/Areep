import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

/**
 * Every signed-up user already has exactly one organization membership
 * (schema.sql's bootstrap trigger creates it on signup). This just looks
 * that membership up so pages can scope their queries to it.
 */
export function useOrganization(user) {
  const [organizationId, setOrganizationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      setOrganizationId(null)
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    setError(null)

    supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (!mounted) return
        if (fetchError) {
          setError(fetchError)
          setOrganizationId(null)
        } else {
          setOrganizationId(data?.organization_id ?? null)
        }
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [user])

  return { organizationId, loading, error }
}
