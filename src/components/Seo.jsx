import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_ALT,
  OG_IMAGE_PATH,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from '../lib/site'

/* ============================================================
   Per-page document metadata.

   Why this is imperative instead of rendering <title>/<meta> as JSX:
   index.html already ships a complete, correct set of static tags, and
   it has to — Open Graph scrapers (WhatsApp, LinkedIn, Facebook, Slack)
   do not execute JavaScript, so the static markup is the *only* thing
   they ever see. React 19 hoists head tags rendered in components but
   does not replace the static ones already in the document, which would
   leave two <title>s and two descriptions fighting each other.

   So this updates the existing tags in place, creating one only when it
   is genuinely absent. The static defaults serve non-JS crawlers; these
   updates serve the browser tab, JS-rendering crawlers (Googlebot), and
   anything reading the live DOM.

   The honest limitation, stated plainly because it affects a checklist
   item: per-route og: tags set here are NOT visible to non-JS scrapers.
   Sharing https://site/faq previews the site-level card from index.html,
   not a FAQ-specific one. Fixing that properly needs prerendering or SSR,
   which is a deployment-architecture decision, not a metadata one.
   ============================================================ */

/** Updates a tag matched by `selector`, creating it from `attrs` if missing. */
function setTag(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(attrs.tagName || 'meta')
    for (const [k, v] of Object.entries(attrs)) {
      if (k !== 'tagName' && k !== 'content' && k !== 'href') el.setAttribute(k, v)
    }
    document.head.appendChild(el)
  }
  if ('content' in attrs) el.setAttribute('content', attrs.content)
  if ('href' in attrs) el.setAttribute('href', attrs.href)
}

/** Removes a managed tag entirely — used so `noindex` never lingers onto a public page. */
function removeTag(selector) {
  document.head.querySelector(selector)?.remove()
}

/**
 * @param title       Page title WITHOUT the brand suffix — this adds it.
 * @param description Unique, human meta description for the page.
 * @param noindex     True for private/utility routes that must stay out of search.
 * @param path        Canonical path override; defaults to the current location.
 */
export function Seo({ title, description = DEFAULT_DESCRIPTION, noindex = false, path }) {
  const location = useLocation()
  const routePath = path || location.pathname

  useEffect(() => {
    /* The brand goes in every title, but never twice — the landing page's
       own title already *is* the brand, so it opts out by passing no title. */
    const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — من كلام العميل إلى PRD جاهز للتنفيذ`
    document.title = fullTitle

    setTag('meta[name="description"]', { name: 'description', content: description })

    if (noindex) {
      /* noarchive/nosnippet too: a private route that somehow gets fetched
         should leave no cached copy or excerpt behind either. */
      setTag('meta[name="robots"]', { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet' })
      /* A noindex page must not advertise a canonical — that would invite
         the crawler to index the canonical target in its place. */
      removeTag('link[rel="canonical"]')
    } else {
      removeTag('meta[name="robots"]')
      /* Only emit absolute URLs when we actually know the origin. An empty
         SITE_URL means VITE_SITE_URL is unset and we are not being served
         from a browser origin — emitting "/faq" as a canonical would be
         invalid, and emitting a guessed host would be worse. */
      if (SITE_URL) {
        const url = absoluteUrl(routePath)
        setTag('link[rel="canonical"]', { tagName: 'link', rel: 'canonical', href: url })
        setTag('meta[property="og:url"]', { property: 'og:url', content: url })
      }
    }

    setTag('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    setTag('meta[property="og:description"]', { property: 'og:description', content: description })
    setTag('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    setTag('meta[name="twitter:description"]', { name: 'twitter:description', content: description })

    if (SITE_URL) {
      const image = `${SITE_URL}${OG_IMAGE_PATH}`
      setTag('meta[property="og:image"]', { property: 'og:image', content: image })
      setTag('meta[property="og:image:alt"]', { property: 'og:image:alt', content: OG_IMAGE_ALT })
      setTag('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
    }
  }, [title, description, noindex, routePath])

  return null
}
