/* ============================================================
   The one place the dashboard reads/writes system_settings from.

   Same shape as src/admin/analytics/client.js: nothing above this file
   knows Supabase exists, or that the setting is even called
   `max_projects_per_user` in the database. If this ever needs a second
   global setting, it is this file and the SQL functions behind it that
   grow — not the panel that renders it.
   ============================================================ */
import { supabase } from '../../lib/supabase'

function mapStatus(raw) {
  if (!raw) return null
  return {
    maxProjectsPerUser: Number(raw.maxProjectsPerUser),
    updatedAt: raw.updatedAt,
    usage: {
      atLimit: Number(raw.usage?.atLimit ?? 0),
      belowLimit: Number(raw.usage?.belowLimit ?? 0),
      totalUsers: Number(raw.usage?.totalUsers ?? 0),
    },
  }
}

export async function fetchProjectLimit() {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-settings', { body: { action: 'get' } })
  if (error) {
    const status = error?.context?.status
    return { data: null, error: status === 403 ? 'forbidden' : 'unavailable' }
  }
  return { data: mapStatus(data), error: null }
}

export async function setProjectLimit(maxProjectsPerUser) {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-settings', {
    body: { action: 'set', maxProjectsPerUser },
  })
  if (error) {
    const status = error?.context?.status
    if (status === 400) return { data: null, error: 'invalid_limit' }
    return { data: null, error: status === 403 ? 'forbidden' : 'unavailable' }
  }
  return { data: mapStatus(data), error: null }
}

function mapAiLimits(raw) {
  if (!raw) return null
  return {
    tokensPerMonth: Number(raw.tokensPerMonth),
    requestsPerDay: Number(raw.requestsPerDay),
    maxPrdGenerationsPerMonth: Number(raw.maxPrdGenerationsPerMonth),
    maxRegenerationsPerProject: Number(raw.maxRegenerationsPerProject),
    maxTokensPerRequest: Number(raw.maxTokensPerRequest),
    updatedAt: raw.updatedAt,
    usage: {
      overLimit: Number(raw.usage?.overLimit ?? 0),
      nearLimit: Number(raw.usage?.nearLimit ?? 0),
      healthy: Number(raw.usage?.healthy ?? 0),
      totalTrackedUsers: Number(raw.usage?.totalTrackedUsers ?? 0),
    },
  }
}

function aiSettingsError(error) {
  const status = error?.context?.status
  if (status === 400) return 'invalid_limit'
  return status === 403 ? 'forbidden' : 'unavailable'
}

export async function fetchAiLimits() {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-settings', { body: { action: 'get_ai_limits' } })
  if (error) return { data: null, error: aiSettingsError(error) }
  return { data: mapAiLimits(data), error: null }
}

export async function setAiLimits(limits) {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-settings', {
    body: { action: 'set_ai_limits', ...limits },
  })
  if (error) return { data: null, error: aiSettingsError(error) }
  return { data: mapAiLimits(data), error: null }
}

function mapUserLookup(raw) {
  if (!raw?.found) return { found: false }
  return {
    found: true,
    userId: raw.userId,
    email: raw.email,
    signedUpAt: raw.signedUpAt,
    hasOverride: Boolean(raw.hasOverride),
    limits: {
      tokensPerMonth: Number(raw.limits.tokensPerMonth),
      requestsPerDay: Number(raw.limits.requestsPerDay),
      maxProjectsPerUser: Number(raw.limits.maxProjectsPerUser),
      maxPrdGenerationsPerMonth: Number(raw.limits.maxPrdGenerationsPerMonth),
      maxRegenerationsPerProject: Number(raw.limits.maxRegenerationsPerProject),
      maxTokensPerRequest: Number(raw.limits.maxTokensPerRequest),
    },
    usage: {
      tokensUsed: Number(raw.usage.tokensUsed),
      requestsUsed: Number(raw.usage.requestsUsed),
      discoveryRequests: Number(raw.usage.discoveryRequests),
      prdGenerations: Number(raw.usage.prdGenerations),
      regenerations: Number(raw.usage.regenerations),
    },
    recentEvents: (raw.recentEvents ?? []).map((e) => ({
      createdAt: e.createdAt,
      kind: e.kind,
      provider: e.provider,
      model: e.model,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
      totalTokens: e.totalTokens,
      ok: Boolean(e.ok),
      fallback: Boolean(e.fallback),
      errorCode: e.errorCode,
    })),
  }
}

/** Resolves one user by email or id — never a browsable list. See Users.jsx. */
export async function lookupUserUsage(query) {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-settings', { body: { action: 'lookup_user', query } })
  if (error) return { data: null, error: aiSettingsError(error) }
  return { data: mapUserLookup(data), error: null }
}

export async function setUserLimits(userId, limits) {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-settings', {
    body: { action: 'set_user_limits', userId, ...limits },
  })
  if (error) return { data: null, error: aiSettingsError(error) }
  return { data: mapUserLookup(data), error: null }
}

export async function resetUserLimits(userId) {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-settings', { body: { action: 'reset_user_limits', userId } })
  if (error) return { data: null, error: aiSettingsError(error) }
  return { data: mapUserLookup(data), error: null }
}
