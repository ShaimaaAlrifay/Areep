import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { insertMessage, isMissingTableError, listMessages } from '../services/messagesService'

/**
 * Persisted chat history for one project. Degrades gracefully instead of
 * crashing the page when the `messages` table hasn't been created yet
 * (see supabase/schema.sql's "messages" section, and the isMissingTable
 * flag this hook surfaces so the UI can show a small inline notice) — same
 * defensive spirit as `isSupabaseConfigured` elsewhere in this codebase.
 *
 * `seedMessages`, if given, is used as the initial message list ONLY when
 * the real fetch comes back empty (missing table, or a genuinely-empty
 * project). This exists for the redirect straight out of the new-project
 * wizard: the wizard's closing message is written to `messages` best-effort,
 * but on a not-yet-migrated table that write silently no-ops — without a
 * seed, that closing message would vanish the instant this hook's own fetch
 * (against a different, database-backed source) replaces it with `[]`,
 * making a chat that just finished setup look completely dead on arrival.
 */
export function useMessages(projectId, seedMessages = null) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isMissingTable, setIsMissingTable] = useState(false)

  useEffect(() => {
    let mounted = true
    setMessages([])
    setIsMissingTable(false)
    setError(null)

    if (!isSupabaseConfigured || !projectId) {
      setLoading(false)
      return () => {
        mounted = false
      }
    }

    setLoading(true)
    listMessages(projectId).then(({ data, error: fetchError }) => {
      if (!mounted) return
      if (fetchError) {
        if (isMissingTableError(fetchError)) {
          setIsMissingTable(true)
          if (seedMessages && seedMessages.length) setMessages(seedMessages)
        } else {
          setError(fetchError)
        }
      } else {
        setMessages(data && data.length ? data : seedMessages || [])
      }
      setLoading(false)
    })

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seedMessages is only meant to apply once, on the render this hook first mounts for a given projectId (i.e. the redirect out of the wizard); it deliberately isn't a re-trigger.
  }, [projectId])

  /**
   * Appends a message immediately (so the UI never waits on a round trip)
   * and tries to persist it in the background. On a missing-messages-table
   * project the message just stays local-only for this session — that's an
   * accepted, expected degradation for this phase, not an error state.
   */
  const addMessage = useCallback(
    (role, content) => {
      const localMessage = { id: `local-${Date.now()}-${Math.random()}`, role, content, created_at: new Date().toISOString() }
      setMessages((current) => [...current, localMessage])

      if (!isSupabaseConfigured || !projectId || isMissingTable) return localMessage

      insertMessage(projectId, role, content).then(({ data, error: insertError }) => {
        if (insertError) {
          if (isMissingTableError(insertError)) setIsMissingTable(true)
          return
        }
        if (data) {
          setMessages((current) => current.map((message) => (message.id === localMessage.id ? data : message)))
        }
      })

      return localMessage
    },
    [projectId, isMissingTable],
  )

  return { messages, loading, error, isMissingTable, addMessage }
}
