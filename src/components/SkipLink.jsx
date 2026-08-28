/**
 * "Skip to content" — the first thing in the tab order.
 *
 * Every layout in this app puts a nav or a sidebar full of links before
 * its content, which a keyboard or screen-reader user would otherwise
 * have to tab through on every single page. Rendered once at the root so
 * no layout can forget it; each layout only has to mark its <main> with
 * id="main".
 */
export function SkipLink() {
  return (
    <a className="skip-link" href="#main">
      تخطَّ إلى المحتوى
    </a>
  )
}
