/* ============================================================
   The site's route inventory, as plain data.

   This is deliberately free of `import.meta.env` and of any browser
   API: it is imported both by the running app (through src/lib/site.js)
   and by vite/seoPlugin.js in Node at build time, so sitemap.xml,
   robots.txt and the app can never disagree about which routes are
   public. A second hardcoded copy in the plugin is exactly the kind of
   thing that silently rots when a route is added.
   ============================================================ */

/**
 * Public routes that belong in sitemap.xml.
 *
 * Authenticated routes (/chat/**) are deliberately absent, and are also
 * disallowed in robots.txt and marked noindex at runtime — three
 * independent layers, because a user's client work is the single worst
 * thing to leak into a search index.
 *
 * /forgot-password and /reset-password are public but excluded on
 * purpose: transactional utility screens with nothing to rank.
 */
export const INDEXABLE_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/faq', priority: '0.8', changefreq: 'monthly' },
  { path: '/register', priority: '0.7', changefreq: 'monthly' },
  { path: '/login', priority: '0.4', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
]

/** Prefixes robots.txt disallows and <Seo> marks noindex. */
export const DISALLOWED_PATHS = ['/chat', '/forgot-password', '/reset-password']
