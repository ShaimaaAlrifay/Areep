import { INDEXABLE_ROUTES, DISALLOWED_PATHS } from '../src/lib/routes.js'

/* ============================================================
   Emits the crawler-facing files that only the build can produce,
   because only the build knows the production origin.

   Everything here keys off VITE_SITE_URL. If it is unset the plugin does
   NOT invent a domain: it emits a robots.txt with no Sitemap line, skips
   sitemap.xml entirely, and leaves the absolute-URL meta tags out of
   index.html — then says so loudly. A sitemap full of the wrong host, or
   a canonical pointing at localhost, does real and lasting damage to a
   site's indexing; a missing file does not.
   ============================================================ */

function normalize(url) {
  return typeof url === 'string' ? url.trim().replace(/\/+$/, '') : ''
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, (c) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[c]};`)
}

export function seoPlugin() {
  let siteUrl = ''
  let isBuild = false

  return {
    name: 'areep-seo',

    configResolved(config) {
      isBuild = config.command === 'build'
      siteUrl = normalize(config.env.VITE_SITE_URL)
      if (isBuild && !siteUrl) {
        config.logger.warn(
          '\n[areep-seo] VITE_SITE_URL is not set.\n' +
            '  robots.txt will ship without a Sitemap line, sitemap.xml will NOT be generated,\n' +
            '  and canonical/og:url/og:image will be omitted from index.html.\n' +
            '  Set VITE_SITE_URL to the production origin (e.g. https://areeb.example) and rebuild.\n',
        )
      }
    },

    /* Injected rather than written into index.html so that a build without
       a configured origin produces a page with *no* canonical, instead of
       one pointing somewhere wrong. */
    transformIndexHtml() {
      if (!siteUrl) return []
      const image = `${siteUrl}/assets/areeb/og-image.png`
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: `${siteUrl}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' },
        {
          tag: 'meta',
          attrs: { property: 'og:image:alt', content: 'أريب — من كلام العميل إلى PRD جاهز للتنفيذ' },
          injectTo: 'head',
        },
        { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' },
      ]
    },

    generateBundle() {
      /* Disallow the private areas explicitly rather than relying on the
         app's own noindex: robots.txt is the only signal a crawler reads
         before it fetches anything, and /chat/** requires a session it will
         never have — letting it crawl there only produces junk 404-ish hits. */
      const robots = [
        'User-agent: *',
        'Allow: /',
        '',
        ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
        ...(siteUrl ? ['', `Sitemap: ${siteUrl}/sitemap.xml`] : []),
        '',
      ].join('\n')

      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })

      if (!siteUrl) return

      /* lastmod is the build date. It is a real signal (the deployed content
         genuinely changed) and avoids the common mistake of a frozen date
         that tells crawlers the site is abandoned. */
      const lastmod = new Date().toISOString().slice(0, 10)
      const urls = INDEXABLE_ROUTES.map(
        ({ path, priority, changefreq }) =>
          '  <url>\n' +
          `    <loc>${xmlEscape(siteUrl + (path === '/' ? '/' : path))}</loc>\n` +
          `    <lastmod>${lastmod}</lastmod>\n` +
          `    <changefreq>${changefreq}</changefreq>\n` +
          `    <priority>${priority}</priority>\n` +
          '  </url>',
      ).join('\n')

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    },
  }
}
