/* ============================================================
   Arabic-first RTL design system for the PRD PDF.

   Strict black / white / gray editorial palette — no color, no
   gradients. Hierarchy comes from scale, weight and whitespace,
   never from boxes or rules.

   ---------- the three rules this file is built on ----------

   1. RTL IS STRUCTURAL, NOT ALIGNMENT.
      Every page, row, list and table declares `direction: "rtl"` and
      lays its children out with `flexDirection: "row"` under that
      direction — so the FIRST child sits on the RIGHT. The old build
      used LTR containers with `row-reverse` to fake the same visual
      order; that reverses the paint order but leaves padding, text
      alignment and wrap behaviour on the Latin side, which is why
      header cells and body cells drifted apart column by column.
      Writing real RTL means a column's header and its cells derive
      their edge from the same origin.

   2. NO LETTER TRACKING ON ARABIC, EVER.
      letterSpacing on Arabic severs the cursive joins — the word
      renders as loose disconnected letterforms. Tracking appears in
      exactly two styles below, both applied to Latin-only strings
      (the AREEB wordmark and the page counter).

   3. ARABIC NEEDS AIR.
      Arabic sets larger than Latin at the same point size and its
      ascenders/descenders travel further, so body line-height here is
      1.9 (the previous 1.5 stacked lines into each other) and the
      type scale below is tuned for Plex Arabic's x-height, not for a
      Latin grotesque.
   ============================================================ */
import { StyleSheet } from "@react-pdf/renderer";
import { FONT } from "./prdFonts";

export const C = {
  black: "#000000",
  ink: "#111111",
  body: "#242424",
  gray700: "#3f3f3f",
  gray600: "#5c5c5c",
  gray500: "#7a7a7a",
  gray400: "#9c9c9c",
  gray300: "#c4c4c4",
  gray200: "#dedede",
  gray150: "#e9e9e9",
  gray100: "#f2f2f2",
  white: "#ffffff",
};

/* A4 = 595.28pt wide. Content width = 595.28 - 56 - 56 = 483.28pt. */
export const PAGE_PAD = { top: 96, bottom: 64, left: 56, right: 56 };
export const CONTENT_W = 483.28;

/* ---------- the Arabic type scale ----------
   Eight steps, each with its own size / weight / leading. Nothing in
   the document is allowed to invent a size outside this scale. */
export const T = {
  coverTitle: { size: 40, weight: 700, leading: 1.35 },
  coverLede: { size: 11.5, weight: 400, leading: 1.85 },
  sectionTitle: { size: 21, weight: 700, leading: 1.45 },
  sectionLede: { size: 9.75, weight: 400, leading: 1.75 },
  label: { size: 8.5, weight: 600, leading: 1.5 },
  body: { size: 10, weight: 400, leading: 1.9 },
  quote: { size: 11.5, weight: 500, leading: 1.85 },
  cell: { size: 9, weight: 400, leading: 1.75 },
  caption: { size: 7.5, weight: 400, leading: 1.6 },
};

export const prdStyles = StyleSheet.create({
  /* ---------- page shells ---------- */
  coverPage: {
    direction: "rtl",
    backgroundColor: C.white,
    color: C.black,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: FONT.arabic,
  },
  page: {
    direction: "rtl",
    backgroundColor: C.white,
    color: C.body,
    paddingTop: PAGE_PAD.top,
    paddingBottom: PAGE_PAD.bottom,
    paddingHorizontal: PAGE_PAD.left,
    fontFamily: FONT.arabic,
    fontSize: T.body.size,
    lineHeight: T.body.leading,
    textAlign: "right",
  },

  /* ---------- page chrome ----------
     Under `direction: rtl` the first child of a `row` lands on the
     RIGHT, so the brand mark is written first and needs no reversal
     trick. The wordmark and the page counter stay Latin/LTR — they
     are brand and technical identifiers, not prose (spec §9). */
  pageHeader: {
    position: "absolute",
    top: 38,
    left: 56,
    right: 56,
    direction: "rtl",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageHeaderMark: { flexDirection: "row", alignItems: "center", gap: 6 },
  pageHeaderLogo: { width: 11, height: 11 },
  pageHeaderWordmark: {
    fontFamily: FONT.mark,
    fontWeight: 700,
    fontSize: 7.5,
    letterSpacing: 2.2,
    color: C.black,
  },
  pageHeaderDoc: {
    fontFamily: FONT.arabic,
    fontWeight: 400,
    fontSize: T.caption.size,
    color: C.gray500,
  },
  pageHeaderRule: {
    position: "absolute",
    top: 60,
    left: 56,
    right: 56,
    height: 0.75,
    backgroundColor: C.gray200,
  },
  pageFooter: {
    position: "absolute",
    bottom: 34,
    left: 56,
    right: 56,
    direction: "rtl",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageFooterNote: {
    fontFamily: FONT.arabic,
    fontWeight: 400,
    fontSize: 7,
    color: C.gray500,
  },
  pageFooterCounter: {
    fontFamily: FONT.mono,
    fontSize: 6.75,
    letterSpacing: 1.4,
    color: C.gray500,
  },

  /* ---------- section heading ----------
     The giant numeral is a background element: it sits in its own
     absolutely-positioned layer behind the title, pinned to the right
     margin. The title/lede/rule then flow normally underneath with
     real margins — the previous build pulled the title up with a
     negative margin onto the numeral's own line, which collided the
     lede into the title on every single section page. */
  headingBlock: {
    position: "relative",
    marginBottom: 30,
    paddingTop: 30,
  },
  headingNumeral: {
    position: "absolute",
    top: -14,
    right: 0,
    fontFamily: FONT.mark,
    fontWeight: 800,
    fontSize: 86,
    lineHeight: 1,
    color: C.gray150,
  },
  headingTitle: {
    fontFamily: FONT.arabic,
    fontWeight: T.sectionTitle.weight,
    fontSize: T.sectionTitle.size,
    lineHeight: T.sectionTitle.leading,
    color: C.black,
    textAlign: "right",
  },
  headingLede: {
    fontFamily: FONT.arabic,
    fontWeight: T.sectionLede.weight,
    fontSize: T.sectionLede.size,
    lineHeight: T.sectionLede.leading,
    color: C.gray600,
    textAlign: "right",
    marginTop: 8,
    maxWidth: 340,
    alignSelf: "flex-start",
  },
  headingRule: {
    height: 1,
    width: 44,
    backgroundColor: C.black,
    marginTop: 18,
    alignSelf: "flex-start",
  },

  /* ---------- labels ----------
     Small caps-equivalent for Arabic: weight + color carry the label
     role, since Arabic has no case and tracking is forbidden. */
  label: {
    fontFamily: FONT.arabic,
    fontWeight: T.label.weight,
    fontSize: T.label.size,
    lineHeight: T.label.leading,
    color: C.black,
    textAlign: "right",
    marginBottom: 7,
  },
  labelMuted: {
    fontFamily: FONT.arabic,
    fontWeight: T.label.weight,
    fontSize: T.label.size,
    lineHeight: T.label.leading,
    color: C.gray500,
    textAlign: "right",
    marginBottom: 7,
  },
  groupLabel: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 11,
    color: C.black,
    textAlign: "right",
    marginBottom: 12,
  },

  /* ---------- prose ---------- */
  paragraph: {
    fontFamily: FONT.arabic,
    fontWeight: T.body.weight,
    fontSize: T.body.size,
    lineHeight: T.body.leading,
    color: C.body,
    textAlign: "right",
  },
  quote: {
    fontFamily: FONT.arabic,
    fontWeight: T.quote.weight,
    fontSize: T.quote.size,
    lineHeight: T.quote.leading,
    color: C.ink,
    textAlign: "right",
  },

  /* ---------- technical identifier ----------
     FR-001 / v1.0 / PRD-2026-833 / 2026-08-28. Rendered inside its own
     LTR Text node so the bidi algorithm treats it as one atomic
     left-to-right run and can never reorder its parts (spec §5). */
  ltr: {
    direction: "ltr",
    fontFamily: FONT.mono,
    fontSize: 8,
    color: C.gray600,
    textAlign: "right",
  },

  /* ---------- tables ----------
     Real RTL: the row is `direction: rtl` + `flexDirection: row`, so
     the first declared column renders rightmost and every cell shares
     the header's edge. Padding is expressed with paddingStart /
     paddingEnd (flow-relative) rather than left/right, so the gutter
     always falls on the reading-trailing side. */
  tableHeaderRow: {
    direction: "rtl",
    flexDirection: "row",
    backgroundColor: C.black,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 8,
    lineHeight: 1.4,
    color: C.white,
    textAlign: "right",
  },
  tableRow: {
    direction: "rtl",
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 0.75,
    borderBottomColor: C.gray200,
    borderBottomStyle: "solid",
    alignItems: "flex-start",
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableRowZebra: { backgroundColor: C.gray100 },
  tableCell: {
    fontFamily: FONT.arabic,
    fontWeight: T.cell.weight,
    fontSize: T.cell.size,
    lineHeight: T.cell.leading,
    color: C.body,
    textAlign: "right",
  },
  tableCellStrong: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: T.cell.size,
    lineHeight: T.cell.leading,
    color: C.ink,
    textAlign: "right",
  },
  tableCellId: {
    direction: "ltr",
    fontFamily: FONT.mono,
    fontSize: 7.5,
    lineHeight: 1.7,
    color: C.gray600,
    textAlign: "right",
  },

  /* ---------- priority pill ---------- */
  pill: {
    alignSelf: "flex-start",
    borderWidth: 0.75,
    borderColor: C.gray300,
    borderStyle: "solid",
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pillSolid: { backgroundColor: C.black, borderColor: C.black },
  pillText: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 7.5,
    lineHeight: 1.35,
    color: C.gray600,
    textAlign: "center",
  },
  pillTextSolid: { color: C.white },

  /* ---------- lists ----------
     Marker first (= rightmost under RTL), prose second, both inside a
     `direction: rtl` row so the marker gutter is on the reading side. */
  listRow: {
    direction: "rtl",
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "flex-start",
  },
  listMarkerNum: {
    direction: "ltr",
    fontFamily: FONT.mono,
    fontSize: 7.5,
    lineHeight: 2.5,
    color: C.gray400,
    width: 22,
    textAlign: "right",
    paddingEnd: 8,
  },
  listMarkerDash: {
    fontFamily: FONT.arabic,
    fontSize: 9,
    lineHeight: 2.1,
    color: C.gray400,
    width: 14,
    textAlign: "right",
    paddingEnd: 6,
  },
  listText: { flex: 1 },

  /* ---------- two-column band ---------- */
  twoCol: { direction: "rtl", flexDirection: "row", gap: 30 },
  col: { flex: 1 },
});
