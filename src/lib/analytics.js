/* ============================================================
   Privacy-first product analytics.

   Deliberately vendor-free. This is an event *interface*, not an
   analytics library: nothing is loaded, no third-party script runs, no
   cookie is written, and no identifier that could follow a person across
   sites is ever created. That is what keeps this app outside the scope of
   a tracking-consent banner — see the "الكوكيز والتخزين المحلي" section
   of the privacy policy, which states exactly this to users.

   Until VITE_ANALYTICS_URL is set, track() is a no-op in production and a
   console line in development, so the call sites can be written, reviewed
   and shipped now without committing the project to a vendor.

   When a collector is chosen (a self-hosted Plausible/Umami endpoint, or
   an own API route), setting VITE_ANALYTICS_URL turns these into
   fire-and-forget beacons. sendBeacon is used so a click that navigates
   away still reports, and so analytics can never delay a user action.
   ============================================================ */

const ENDPOINT = (import.meta.env.VITE_ANALYTICS_URL || '').trim()
const DEV = import.meta.env.DEV

/**
 * The complete set of events this app reports. Kept as a closed list
 * rather than free-form strings so the funnel stays legible and a typo
 * can't silently create a parallel event nobody notices.
 */
export const EVENTS = {
  CTA_CLICK: 'cta_click',
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  PROJECT_CREATED: 'project_created',
  PRD_GENERATED: 'prd_generated',
  PRD_EXPORTED: 'prd_exported',
}

/**
 * Reports a product event.
 *
 * `props` must stay non-identifying: counts, enum values, which button.
 * Never pass an email, a project name, a client name, or message content —
 * the privacy policy promises this data never leaves for analytics, and
 * that promise is only as good as the call sites.
 */
export function track(event, props = {}) {
  if (!ENDPOINT) {
    if (DEV) console.debug('[areep-analytics]', event, props)
    return
  }

  try {
    const payload = JSON.stringify({
      event,
      props,
      /* Path only — never the full URL with its query string, which on
         auth routes can carry recovery tokens. */
      path: window.location.pathname,
      ts: Date.now(),
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
    } else {
      /* keepalive lets the request outlive the page the same way a beacon
         does; the catch keeps a blocked or failed request from surfacing to users. */
      fetch(ENDPOINT, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
        () => {},
      )
    }
  } catch {
    /* Analytics must never break a user flow. */
  }
}
