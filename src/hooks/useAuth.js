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

  /* OAuth leaves the app entirely: Supabase redirects to Google, Google
     redirects back to `redirectTo`, and only then does a session exist. So
     there is no session to return here — a successful call resolves while
     the browser is already navigating away, and the caller's job is only to
     surface an error if the redirect never starts.

     redirectTo is /chat because that is where a signed-in user belongs;
     it must also be listed in Supabase's allowed redirect URLs, and Google
     must be enabled as a provider in the project, or this returns a
     configuration error rather than silently doing nothing. */
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/chat` },
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR }
    const { error } = await supabase.auth.signOut()
    return { error }
  }, [])

  /* redirectTo must be /reset-password, not /login. Supabase signs the
     user in when they open a recovery link; landing them on /login meant
     the page's "already signed in" guard immediately forwarded them to
     /chat, so the password was never actually changed and the user was
     left with the old one. The dedicated route below collects the new
     password instead. */
  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }, [])

  /* Completes the recovery flow. Works on the session Supabase created
     from the emailed link, which is why /reset-password must stay a
     public route — the user is technically authenticated by the time
     they arrive, but only for this one purpose. */
  const updatePassword = useCallback(async (password) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR }
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }, [])

  return {
    user: session?.user ?? null,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
  }
}
