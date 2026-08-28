/* ============================================================
   Shared style tokens + StyleSheet for the PRD PDF.

   Strict black / white / gray editorial system — no color,
   no gradients, anywhere. Confident scale contrast (giant
   section numbers vs. small body text) instead of boxes/cards.
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

export const PAGE_PAD = { top: 92, bottom: 60, left: 56, right: 56 };

export const prdStyles = StyleSheet.create({
  /* ---------- generic page shells ---------- */
  coverPage: {
    backgroundColor: C.white,
    color: C.black,
    padding: 56,
    fontFamily: FONT.body,
    direction: "rtl",
  },
  page: {
    backgroundColor: C.white,
    color: C.body,
    paddingTop: PAGE_PAD.top,
    paddingBottom: PAGE_PAD.bottom,
    paddingLeft: PAGE_PAD.left,
    paddingRight: PAGE_PAD.right,
    fontFamily: FONT.body,
    fontSize: 10,
    lineHeight: 1.5,
    direction: "rtl",
  },

  /* ---------- chrome: header / footer (every page but cover) ---------- */
  pageHeader: {
    position: "absolute",
    top: 34,
    left: 56,
    right: 56,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageHeaderMark: { flexDirection: "row", alignItems: "center", gap: 7 },
  pageHeaderLogo: { width: 12, height: 12 },
  pageHeaderLeft: {
    /* Renders the Latin "AREEB" wordmark only — genuinely Latin, tracking
       stays (deliberate — matches the brand wordmark treatment). */
    fontFamily: FONT.mono,
    fontSize: 7.5,
    letterSpacing: 2,
    color: C.black,
  },
  pageHeaderRight: {
    /* Arabic content ("مستند متطلبات المنتج") — never track-letter Arabic,
       it visually breaks letter joining (see eyebrow/tableHeaderCell below). */
    fontFamily: FONT.mono,
    fontSize: 7.5,
    color: C.gray500,
  },
  pageHeaderRule: {
    position: "absolute",
    top: 56,
    left: 56,
    right: 56,
    height: 0.75,
    backgroundColor: C.gray200,
  },
  pageFooter: {
    position: "absolute",
    bottom: 30,
    left: 56,
    right: 56,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageFooterLeft: {
    /* Arabic content ("ملكية أريب • سرّي") — no letter tracking. */
    fontFamily: FONT.mono,
    fontSize: 6.75,
    color: C.gray500,
  },
  pageFooterRight: {
    /* Page-number counter only ("01 / 08") — genuinely Latin digits,
       tracking is fine and keeps the technical mono feel. */
    fontFamily: FONT.mono,
    fontSize: 6.75,
    letterSpacing: 1.6,
    color: C.gray500,
  },

  /* ---------- section heading block (kept together, never fixed) ---------- */
  headingBlock: {
    marginBottom: 22,
    position: "relative",
  },
  sectionNumber: {
    fontFamily: FONT.display,
    fontWeight: 800,
    fontSize: 88,
    lineHeight: 0.85,
    color: C.gray150,
    textAlign: "right",
  },
  sectionTitle: {
    /* Arabic section titles ("الملخص التنفيذي", ...) — no letter tracking;
       hierarchy comes from size/weight/whitespace, not tracking. */
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 20,
    color: C.black,
    marginTop: -10,
    textAlign: "right",
  },
  sectionDescription: {
    fontFamily: FONT.body,
    fontWeight: 400,
    fontSize: 10,
    color: C.gray600,
    marginTop: 7,
    maxWidth: 360,
    lineHeight: 1.5,
    textAlign: "right",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: C.black,
    marginTop: 18,
    width: 46,
    alignSelf: "flex-end",
  },

  /* ---------- labels / eyebrows ---------- */
  eyebrow: {
    /* Arabic labels ("معايير القبول", ...) — no letter tracking, it breaks
       Arabic letter joining (renders as disconnected spaced-out letters). */
    fontFamily: FONT.mono,
    fontSize: 7.5,
    color: C.gray500,
    marginBottom: 6,
    textAlign: "right",
  },
  eyebrowDark: {
    /* Arabic labels ("المشكلة", "الفرصة", "أبرز الرؤى", ...) — same reason. */
    fontFamily: FONT.mono,
    fontSize: 7.5,
    color: C.black,
    marginBottom: 6,
    textAlign: "right",
  },

  /* ---------- body text ---------- */
  paragraph: {
    fontFamily: FONT.body,
    fontSize: 10,
    lineHeight: 1.65,
    color: C.body,
    textAlign: "right",
  },
  arabicParagraph: {
    fontFamily: FONT.arabic,
    fontSize: 10.5,
    lineHeight: 1.85,
    color: C.ink,
    textAlign: "right",
    direction: "rtl",
  },

  /* ---------- editorial table ---------- */
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: C.black,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    /* Arabic column headers ("الرقم", "المتطلب", ...) — no letter tracking. */
    fontFamily: FONT.mono,
    fontSize: 7,
    color: C.white,
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 0.75,
    borderBottomColor: C.gray200,
    borderBottomStyle: "solid",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    fontFamily: FONT.body,
    fontSize: 9,
    lineHeight: 1.5,
    color: C.body,
    textAlign: "right",
  },
  tableCellMono: {
    fontFamily: FONT.mono,
    fontSize: 8,
    color: C.gray600,
  },
});
