/* ============================================================
   Font registration for the PRD PDF generator — Arabic-first.

   @react-pdf/renderer needs real embeddable font files (TTF/OTF —
   not the WOFF2 this project links from Google Fonts in index.html
   for the live page). These TTFs live in src/assets/fonts and are
   pulled in as build-time asset URLs via Vite's `?url` suffix, so
   they work identically in dev and in a production build.

   ---------- why the Arabic family is the DEFAULT ----------
   This document is Arabic. Its body font therefore has to be a
   family that carries BOTH scripts, because react-pdf performs no
   font fallback: a codepoint with no glyph in the active font does
   not render a missing-glyph box, it renders .notdef or garbage.

   The previous build shipped an Arabic-only SUBSET of IBM Plex Sans
   Arabic (682 codepoints, zero Latin coverage — verified with
   fontkit: every character of "Excel", "FR-001", "v1.0" resolved to
   glyph id 0). Body text was consequently set in Inter Tight, and a
   helper split every string into per-script <Text> spans so the
   Arabic parts could switch fonts.

   That split is what destroyed the Arabic layout. react-pdf resolves
   bidi *within* a single Text node; sibling Text spans are laid out
   sequentially in the parent's flex direction instead, so any Arabic
   sentence containing a Latin term (WhatsApp, Excel, QR, API — i.e.
   most sentences this product generates) reordered its own clauses
   once it wrapped to a second line. Real rendered output read
   "كقناة تواصل أساسية ... WhatsApp المدعوون يستخدمون" for an input of
   "المدعوون يستخدمون WhatsApp كقناة تواصل أساسية ...".

   The fix is the full IBM Plex Sans Arabic (1669 glyphs, Latin +
   Arabic + Arabic-Indic punctuation + em dash, all verified present),
   so mixed-script text is ONE Text node and react-pdf's own bidi
   handles it correctly — which it demonstrably already did for the
   pure-Arabic story quotes that were the only strings in the old
   build not routed through the splitter, and the only ones that
   rendered correctly.

   Latin faces are kept for exactly two jobs, both genuinely Latin
   and never mixed into Arabic prose:
     - FONT.mark    (Archivo)      — the "AREEB" wordmark only.
     - FONT.mono    (JetBrains Mono) — technical identifiers rendered
       through <Ltr> (FR-001 / v1.0 / PRD-2026-833 / page numbers).
   ============================================================ */
import { Font } from "@react-pdf/renderer";

import archivo600 from "../../assets/fonts/archivo-600.ttf?url";
import archivo700 from "../../assets/fonts/archivo-700.ttf?url";
import archivo800 from "../../assets/fonts/archivo-800.ttf?url";
import jetbrainsMono400 from "../../assets/fonts/jetbrainsmono-400.ttf?url";
import jetbrainsMono500 from "../../assets/fonts/jetbrainsmono-500.ttf?url";
import plexArabic400 from "../../assets/fonts/ibm-plex-sans-arabic-400.ttf?url";
import plexArabic500 from "../../assets/fonts/ibm-plex-sans-arabic-500.ttf?url";
import plexArabic600 from "../../assets/fonts/ibm-plex-sans-arabic-600.ttf?url";
import plexArabic700 from "../../assets/fonts/ibm-plex-sans-arabic-700.ttf?url";

export const FONT = {
  /** The document font. Arabic + Latin in one family — used for all prose,
   *  headings, labels, and table content. */
  arabic: "IBM Plex Sans Arabic",
  /** Latin-only, technical identifiers via <Ltr> and page numbers. */
  mono: "JetBrains Mono",
  /** Latin-only, the AREEB wordmark and the giant section numerals. */
  mark: "Archivo",
};

let registered = false;

/** Idempotent — safe to call every time before rendering the PDF. */
export function registerPRDFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: FONT.arabic,
    fonts: [
      { src: plexArabic400, fontWeight: 400 },
      { src: plexArabic500, fontWeight: 500 },
      { src: plexArabic600, fontWeight: 600 },
      { src: plexArabic700, fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONT.mark,
    fonts: [
      { src: archivo600, fontWeight: 600 },
      { src: archivo700, fontWeight: 700 },
      { src: archivo800, fontWeight: 800 },
    ],
  });
  Font.register({
    family: FONT.mono,
    fonts: [
      { src: jetbrainsMono400, fontWeight: 400 },
      { src: jetbrainsMono500, fontWeight: 500 },
    ],
  });

  // react-pdf's default hyphenation callback breaks words at arbitrary
  // points, which corrupts Arabic letter joining across a line wrap.
  // Disable it — words wrap whole, never mid-word.
  Font.registerHyphenationCallback((word) => [word]);
}
