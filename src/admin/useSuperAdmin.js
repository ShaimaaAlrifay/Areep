import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../contexts/AuthContext'

/* ============================================================
   Is the signed-in user an owner?

   The honest framing: this hook decides what to RENDER, not what to
   ALLOW. The real gate is `admin-analytics` refusing to answer anyone
   whose id is not in `app_admins` — that check runs on a server with the
   service role and cannot be reached from a devtools console. If this
   file were deleted entirely, a curious user would get a prettier route
   and exactly the same 403.

   That ordering is what keeps it safe to be permissive while loading:
   nothing sensitive has been fetched yet, because the only thing that
   could fetch it is the very call that does the checking.
   ============================================================ */
export function useSuperAdmin() {
  const { user, loading: authLoading } = useAuthContext()
  const [state, setState] = useState({ loading: true, isAdmin: false, error: null })

  useEffect(() => {
    if (authLoading) return
    if (!user || !supabase) {
      setState({ loading: false, isAdmin: false, error: null })
      return
    }

    let active = true
    supabase.functions
      .invoke('admin-analytics', { body: { probe: true } })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          const status = error?.context?.status
          /* 403 is a decided "no". Anything else — the function not
             deployed yet, a network failure — is an unknown, and it is
             reported as such rather than silently denying access to the
             one person who is supposed to have it. */
          setState({ loading: false, isAdmin: false, error: status === 403 ? null : 'unavailable' })
          return
        }
        setState({ loading: false, isAdmin: data?.ok === true, error: null })
      })

    return () => {
      active = false
    }
  }, [user, authLoading])

  return state
}
