/* ============================================================
   Resolves a public/-folder asset path against Vite's configured
   base. A plain "/assets/..." string always resolves to the
   *domain* root, which breaks if this app is ever deployed under a
   subpath (same class of bug the sibling portfolio hit on GitHub
   Pages — see its own src/lib/assetUrl.js). import.meta.env.BASE_URL
   already carries the right prefix in both dev and prod, so every
   public-asset reference in this codebase should go through this
   helper instead of a hardcoded leading-slash string.
   ============================================================ */
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\//, '')}`
}
