/* ============================================================
   Brand mark assets, chosen by the surface they sit on.

   Four files, two axes: mark-only vs. the horizontal lockup (mark +
   أريب/AREEB), each in a white and a black cut. The rule is simply
   which one stays legible:

     dark surface  → the WHITE cut
     light surface → the BLACK cut

   Everything in the web app is a dark surface — the design system is
   dark-first (`--color-bg: #0a0a0b`, `color-scheme: dark` in
   index.css) and ships no light mode. The generated PDF is the one
   light surface in the product: white A4 paper, so it takes the black
   cut.

   Going through this module instead of writing paths inline is what
   keeps that rule checkable in one place — and it is how the bug this
   replaced is kept from recurring. The PDF template used to draw a file
   called `logo.png` (since deleted) that was byte-identical to the white
   cut: a white mark on white paper, invisible in every document the
   product had ever generated. A filename that says nothing about its own
   colour is exactly how that goes unnoticed, which is why every name
   here ends in the colour it actually is.
   ============================================================ */
import { assetUrl } from './assetUrl'

/** Mark only — for tight chrome where the name is already set in type. */
export const LOGO_MARK_WHITE = assetUrl('assets/areeb/logo-white.png')
export const LOGO_MARK_BLACK = assetUrl('assets/areeb/logo-black.png')

/** Horizontal lockup: mark + أريب / AREEB, as one locked-up unit. */
export const LOGO_LOCKUP_WHITE = assetUrl('assets/areeb/logo-withname-white.png')
export const LOGO_LOCKUP_BLACK = assetUrl('assets/areeb/logo-withname-black.png')

/** Intrinsic aspect ratios, so a caller sets one dimension and derives
 *  the other rather than guessing a box and squashing the mark. */
export const LOGO_MARK_RATIO = 1265 / 1140
export const LOGO_LOCKUP_RATIO = 2831 / 1140
