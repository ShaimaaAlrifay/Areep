import { Seo } from './Seo'
import { SiteFooter } from './SiteFooter'
import { TopNav } from './TopNav'

/**
 * Shared shell for every public page: nav, metadata, content, footer.
 *
 * Exists so a new public page cannot accidentally ship without a title, a
 * description, or the footer's legal links — the three things that were
 * missing everywhere before. `<main>` is the landmark screen readers jump
 * to, so it lives here once rather than being re-declared per page.
 */
export function PublicPage({ title, description, noindex, children, mainClassName = 'container legal-main' }) {
  return (
    <div className="page">
      <Seo title={title} description={description} noindex={noindex} />
      <TopNav />
      <main className={mainClassName} id="main">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
