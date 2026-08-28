import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const NOT_CONFIGURED_ERROR = {
  message: 'قاعدة البيانات غير مهيأة بعد. الرجاء إضافة بيانات الاتصال بـ Supabase أولاً.',
}

/**
 * Wraps Supabase auth (getSession + onAuthStateChange) and exposes the
 * actions the auth pages need. Safe to call even when Supabase isn't
 * configured yet — actions resolve with a clear error instead of throwing.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED_ERROR }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }, [])

  const signUp = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED_ERROR }
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR }
    const { error } = await supabase.auth.signOut()
    return { error }
  }, [])

  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    return { error }
  }, [])

  return {
    user: session?.user ?? null,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}
