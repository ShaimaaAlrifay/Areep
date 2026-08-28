/* ============================================================
   Font registration for the PRD PDF generator.

   @react-pdf/renderer needs real embeddable font files (TTF/OTF —
   not the WOFF2 this project links from Google Fonts in index.html
   for the live page). These TTFs live in src/assets/fonts and are
   pulled in as build-time asset URLs via Vite's `?url` suffix, so
   they work identically in dev and in a production build.

   Families mirror what's already used elsewhere in this codebase
   (see src/style.css / HeroArch.css for Archivo, Inter Tight,
   JetBrains Mono; AreebLanding's GLOBAL_CSS for IBM Plex Sans
   Arabic) so the PDF's typography reads as the same design system,
   not an unrelated import.
   ============================================================ */
import { Font } from "@react-pdf/renderer";

// NOTE: path updated for areep's location (src/templates/areep/ instead of
// src/lib/) — fonts live at src/assets/fonts, two levels up from here.
import archivo400 from "../../assets/fonts/archivo-400.ttf?url";
import archivo600 from "../../assets/fonts/archivo-600.ttf?url";
import archivo700 from "../../assets/fonts/archivo-700.ttf?url";
import archivo800 from "../../assets/fonts/archivo-800.ttf?url";
import interTight400 from "../../assets/fonts/intertight-400.ttf?url";
import interTight500 from "../../assets/fonts/intertight-500.ttf?url";
import jetbrainsMono400 from "../../assets/fonts/jetbrainsmono-400.ttf?url";
import jetbrainsMono500 from "../../assets/fonts/jetbrainsmono-500.ttf?url";
import plexArabic400 from "../../assets/fonts/ibm-plex-sans-arabic-400.ttf?url";
import plexArabic600 from "../../assets/fonts/ibm-plex-sans-arabic-600.ttf?url";
import plexArabic700 from "../../assets/fonts/ibm-plex-sans-arabic-700.ttf?url";

export const FONT = {
  display: "Archivo",
  body: "Inter Tight",
  mono: "JetBrains Mono",
  arabic: "IBM Plex Sans Arabic",
};

let registered = false;

/** Idempotent — safe to call every time before rendering the PDF. */
export function registerPRDFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: FONT.display,
    fonts: [
      { src: archivo400, fontWeight: 400 },
      { src: archivo600, fontWeight: 600 },
      { src: archivo700, fontWeight: 700 },
      { src: archivo800, fontWeight: 800 },
    ],
  });
  Font.register({
    family: FONT.body,
    fonts: [
      { src: interTight400, fontWeight: 400 },
      { src: interTight500, fontWeight: 500 },
    ],
  });
  Font.register({
    family: FONT.mono,
    fonts: [
      { src: jetbrainsMono400, fontWeight: 400 },
      { src: jetbrainsMono500, fontWeight: 500 },
    ],
  });
  Font.register({
    family: FONT.arabic,
    fonts: [
      { src: plexArabic400, fontWeight: 400 },
      { src: plexArabic600, fontWeight: 600 },
      { src: plexArabic700, fontWeight: 700 },
    ],
  });

  // react-pdf's default hyphenation callback breaks words at arbitrary
  // points, which corrupts Arabic letter joining across a line wrap.
  // Disable it — words wrap whole, never mid-word.
  Font.registerHyphenationCallback((word) => [word]);
}
