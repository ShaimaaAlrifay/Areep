import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const ROUTES = ['/', '/faq', '/privacy', '/terms', '/login', '/register', '/forgot-password', '/reset-password', '/this-page-does-not-exist']
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280]

const browser = await chromium.launch()
const results = []

for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`))
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`) })

  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)

  const meta = await page.evaluate(() => {
    const get = (sel, attr = 'content') => document.head.querySelector(sel)?.getAttribute(attr) || null
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => ({ level: +h.tagName[1], text: h.textContent.trim().slice(0, 40) }))
    return {
      title: document.title,
      titleCount: document.querySelectorAll('title').length,
      description: get('meta[name="description"]'),
      descCount: document.head.querySelectorAll('meta[name="description"]').length,
      canonical: get('link[rel="canonical"]', 'href'),
      canonicalCount: document.head.querySelectorAll('link[rel="canonical"]').length,
      robots: get('meta[name="robots"]'),
      ogTitle: get('meta[property="og:title"]'),
      ogImage: get('meta[property="og:image"]'),
      ogUrl: get('meta[property="og:url"]'),
      twitterCard: get('meta[name="twitter:card"]'),
      h1s: headings.filter((h) => h.level === 1).length,
      headings,
      landmarks: {
        main: document.querySelectorAll('main').length,
        nav: document.querySelectorAll('nav').length,
        footer: document.querySelectorAll('footer').length,
        header: document.querySelectorAll('header').length,
      },
      imagesWithoutAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src),
      emptyLinks: [...document.querySelectorAll('a')].filter((a) => {
        const href = a.getAttribute('href')
        return !href || href === '#' || href.startsWith('http://localhost')
      }).map((a) => a.getAttribute('href') + ' :: ' + a.textContent.trim().slice(0, 30)),
      buttonsWithoutName: [...document.querySelectorAll('button')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
      inputsWithoutLabel: [...document.querySelectorAll('input,select,textarea')].filter((el) => {
        if (el.type === 'hidden') return false
        return !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
      }).map((el) => el.id || el.name || el.type),
    }
  })

  // responsive: horizontal overflow at each width
  const overflow = []
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(120)
    const r = await page.evaluate(() => {
      const de = document.documentElement
      const scrollW = Math.max(de.scrollWidth, document.body.scrollWidth)
      const offenders = []
      if (scrollW > de.clientWidth + 1) {
        for (const el of document.querySelectorAll('*')) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 && (rect.right > de.clientWidth + 1 || rect.left < -1)) {
            offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(rect.right)}`)
          }
        }
      }
      return { scrollW, clientW: de.clientWidth, offenders: offenders.slice(0, 5) }
    })
    if (r.scrollW > r.clientW + 1) overflow.push({ width: w, ...r })
  }

  results.push({ route, meta, overflow, consoleErrors, failedRequests })
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 1))
