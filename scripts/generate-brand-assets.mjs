/**
 * Renders the social sharing preview (og:image) to public/assets/areeb/og-image.png.
 *
 * Playwright is intentionally NOT a dependency of this project — it is a
 * ~300MB browser download that no part of the app or its build needs, and
 * this script runs perhaps twice a year. Run it through npx instead:
 *
 *   npm install --no-save playwright   # not added to package.json
 *   npx playwright install chromium     # once, downloads the browser
 *   npm run brand
 *
 * The image is a committed static asset — this script exists so it can be
 * regenerated on brand or headline changes instead of being a mystery binary
 * nobody can reproduce. Run it with `npm run og`.
 *
 * It is deliberately built from the same sources the app itself uses: the
 * brand mark from public/assets/areeb/, the palette tokens from src/index.css,
 * and the self-hosted IBM Plex Sans Arabic woff2. Nothing here is a second
 * copy of the visual identity that could drift.
 *
 * 1200x630 is the size Open Graph consumers (WhatsApp, LinkedIn, X, Facebook,
 * Slack) crop from; deviating from it gets the image letterboxed or rejected.
 */
let chromium
try {
  ({ chromium } = await import('playwright'))
} catch {
  console.error(
    'playwright is not resolvable. Install it without adding a dependency:\n' +
      '  npm install --no-save playwright && npx playwright install chromium\n' +
      'then re-run: npm run brand',
  )
  process.exit(1)
}
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/* The WHITE cuts of the real Areeb logo, inlined as data URIs.
   This used to read public/favicon.svg — which is still Vite's default
   lightning-bolt mark, so every asset this script produced (the social
   preview and both raster icons) shipped the wrong logo entirely.
   Everything here renders on the brand's near-black, so the white cut is
   the legible one; see src/lib/brand.js for that rule. */
const dataUri = (rel) =>
  `data:image/png;base64,${readFileSync(resolve(root, rel)).toString('base64')}`
const lockup = dataUri('public/assets/areeb/logo-withname-white.png')
const mark = dataUri('public/assets/areeb/logo-white.png')
const font = readFileSync(resolve(root, 'src/assets/fonts/ibm-plex-sans-arabic-600.woff2')).toString('base64')
const fontRegular = readFileSync(resolve(root, 'src/assets/fonts/ibm-plex-sans-arabic-400.woff2')).toString('base64')

const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Plex'; src: url(data:font/woff2;base64,${fontRegular}) format('woff2'); font-weight: 400 }
  @font-face { font-family: 'Plex'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 600 }
  * { margin: 0; padding: 0; box-sizing: border-box }
  body {
    width: 1200px; height: 630px; background: #0a0a0b; color: #f4f4f5;
    font-family: 'Plex', sans-serif; display: flex; flex-direction: column;
    justify-content: space-between; padding: 72px 80px;
    /* one restrained accent wash, matching the design system's rule that the
       accent is never a gradient field — this stays under 8% opacity */
    background-image: radial-gradient(900px 500px at 88% -10%, rgba(134,59,255,.13), transparent 60%);
  }
  .top { display: flex; align-items: center }
  /* The lockup already sets the name beside the mark with the brand's own
     spacing — height only, so it is never squashed. */
  .lockup { height: 62px; width: auto; display: block }
  h1 { font-size: 68px; font-weight: 600; line-height: 1.28; letter-spacing: -.02em; max-width: 17ch }
  .sub { font-size: 27px; color: #a1a1aa; line-height: 1.6; max-width: 44ch; margin-top: 26px }
  .foot { display: flex; align-items: center; gap: 14px; font-size: 22px; color: #6b6b74 }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #863bff }
  .rule { height: 1px; background: #232326; margin-bottom: 30px }
</style></head><body>
  <div class="top"><img class="lockup" src="${lockup}" alt="أريب"></div>
  <div>
    <h1>من فكرة مبعثرة إلى منتج واضح.</h1>
    <p class="sub">قل لأريب فكرتك زي ما هي، ويطلّع لك متطلبات واضحة ووثيقة PRD عربية مرتّبة.</p>
  </div>
  <div><div class="rule"></div><div class="foot"><span class="dot"></span><span>من كلام العميل إلى متطلبات واضحة</span></div></div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
const out = resolve(root, 'public/assets/areeb/og-image.png')
await page.screenshot({ path: out })
console.log(`og-image.png written (${(readFileSync(out).length / 1024).toFixed(0)}KB)`)

/* ---- raster icons ----
   The SVG favicon covers modern browsers, but iOS/Safari ignores it for
   "Add to Home Screen" and falls back to a screenshot, and a few contexts
   still want a raster icon. Apple composites its icon onto an opaque
   background, so these are rendered on the brand's own near-black rather
   than shipped transparent and getting an arbitrary one.

   0.88 matches the fill in public/favicon.svg, and is set by the smallest
   size rather than the largest: at 0.58 the 32px tab icon lost the mark
   to padding. See that file's comment. */
const icon = (size) => `<!doctype html><html><head><style>
  * { margin:0; padding:0 }
  body { width:${size}px; height:${size}px; background:#0a0a0b; display:flex;
         align-items:center; justify-content:center }
  img { width:${Math.round(size * 0.88)}px; height:auto; display:block }
</style></head><body><img src="${mark}" alt=""></body></html>`

for (const [size, name] of [[180, 'apple-touch-icon.png'], [32, 'favicon-32.png']]) {
  const iconPage = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await iconPage.setContent(icon(size), { waitUntil: 'networkidle' })
  const path = resolve(root, 'public', name)
  await iconPage.screenshot({ path, omitBackground: false })
  await iconPage.close()
  console.log(`${name} written (${size}x${size})`)
}

await browser.close()
