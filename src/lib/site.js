/* ============================================================
   Single source of truth for everything that needs to know the
   site's public identity: <title>s, meta descriptions, canonical
   URLs, Open Graph tags, robots.txt and sitemap.xml.

   SITE_URL comes from VITE_SITE_URL so the production domain is set
   once, at deploy time, and never hardcoded. A wrong value here is
   worse than a missing one — a canonical or og:url pointing at the
   wrong host actively deindexes the real site — so nothing in this
   file invents a fallback domain. At runtime we can honestly use the
   origin the app is actually being served from; at build time (see
   vite/seoPlugin.js) there is no such origin, and the plugin refuses
   to emit absolute URLs rather than guess.
   ============================================================ */

export const SITE_NAME = 'أريب'

/** Trailing slashes are stripped so `${SITE_URL}${path}` never doubles up. */
function normalize(url) {
  return typeof url === 'string' ? url.trim().replace(/\/+$/, '') : ''
}

const configured = normalize(import.meta.env.VITE_SITE_URL)

export const SITE_URL =
  configured || (typeof window !== 'undefined' ? normalize(window.location.origin) : '')

/**
 * Absolute URL for a route.
 *
 * Canonical URLs are normalized to a no-trailing-slash form (except the
 * root, which is "/" by definition) so that /privacy and /privacy/ can
 * never be indexed as two competing pages.
 */
export function absoluteUrl(path = '/') {
  const clean = path === '/' ? '/' : `/${String(path).replace(/^\/+|\/+$/g, '')}`
  return `${SITE_URL}${clean}`
}

/* The Open Graph preview. Regenerate with scripts/generate-og-image.mjs. */
export const OG_IMAGE_PATH = '/assets/areeb/og-image.png'
export const OG_IMAGE_ALT = 'أريب — من فكرة مبعثرة إلى منتج واضح'

/* Contact address for the privacy/terms pages. Env-driven for the same
   reason as SITE_URL: an invented address on a legal page is worse than
   an absent one, so the pages render without a mailto link until this
   is set rather than pointing users at a mailbox nobody reads. */
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL || '').trim()

export const DEFAULT_DESCRIPTION =
  'قل لأريب فكرتك زي ما هي. يسألك عن اللي ناقص، يرتّب كلامك، ويطلّع لك وثيقة PRD عربية مرتّبة تقدر تراجعها وتصدّرها PDF أو Markdown.'

/* The route inventory lives in ./routes.js as env-free data so the Vite
   build can import the same list — re-exported here so app code has one
   import for everything site-identity related. */
export { INDEXABLE_ROUTES, DISALLOWED_PATHS } from './routes'
