import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* ============================================================
   Ships Netlify's SPA-fallback rule into Netlify's build only.

   The file used to sit in public/ and rode Vite's automatic static-copy
   into every build's dist/, Cloudflare's included. That broke Cloudflare
   deploys: `_redirects` is a reserved filename its build pipeline scans
   and validates on its own — confirmed on a live deploy — and this
   project's rule (valid, standard Netlify syntax: `/* /index.html 200`)
   trips Cloudflare's loop detector, because Cloudflare's asset server
   separately auto-redirects `/index.html` to `/`, and our rule's `/*`
   catches that redirected request right back to `/index.html` again.

   Excluding the filename from Cloudflare's upload (via .assetsignore) does
   NOT dodge this — that mechanism governs what gets served, not this
   earlier validation pass, so the file must not exist in the output at
   all for any build that isn't Netlify's own.

   NETLIFY is Netlify's own documented build-environment flag (set to
   `true` in every Netlify build), so this gates on the one host that
   actually needs the file, rather than guessing at every other host's
   env vars. Cloudflare's build — and a plain local `npm run build` —
   both simply omit it, which is exactly what each of them wants.
   ============================================================ */
export function netlifyRedirectsPlugin() {
  const sourcePath = fileURLToPath(new URL('../netlify/_redirects', import.meta.url))

  return {
    name: 'areep-netlify-redirects',
    generateBundle() {
      if (!process.env.NETLIFY) return
      this.emitFile({ type: 'asset', fileName: '_redirects', source: readFileSync(sourcePath, 'utf8') })
    },
  }
}
