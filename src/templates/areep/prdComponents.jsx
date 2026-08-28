/* ============================================================
   Reusable building blocks for the PRD PDF — the star motif,
   page chrome (header/footer), section heading unit, and the
   editorial table system. Shared across all 8 section pages.
   ============================================================ */
import { View, Text, Svg, Path, Image } from "@react-pdf/renderer";
import { C, prdStyles } from "./prdStyles";
import { FONT } from "./prdFonts";
// NOTE: path updated for areep's location — this file now lives in
// src/templates/areep/, so it reaches areep's own lib/assetUrl.js instead
// of a sibling ./assetUrl.js (which doesn't exist here).
import { assetUrl } from "../../lib/assetUrl";

const AREEB_LOGO_URL = assetUrl("assets/areeb/logo.png");

/* ---------- mixed-script text ----------
   Every base text style in this document (paragraph, tableCell, ...) is
   set in a Latin font (Inter Tight / Archivo / JetBrains Mono) — none of
   which carry Arabic glyphs. react-pdf does not font-fallback: an Arabic
   codepoint rendered under one of those fonts doesn't show as a missing-
   glyph box, it silently resolves to whatever the font happens to map
   that byte/index to (real-world result: "أريب" inside an Archivo Text
   rendered as literal garbage characters like "(J1#"). Pure-Arabic
   strings (user story quotes, etc.) already route through the dedicated
   `arabicParagraph` style/FONT.arabic and are unaffected — this guards
   the other case: a single string that *mixes* scripts (e.g. an English
   sentence quoting a Hejazi phrase, or "Areeb — أريب"), which is exactly
   the shape a future real per-visitor analysis engine (FR-14) is likely
   to produce throughout, not just in the two spots the sample data
   happens to hit today. */
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const NEUTRAL_RE = /[\s‐-―.,:;!?()"'%/]/;

function splitScriptRuns(str) {
  const runs = [];
  let current = "";
  let currentIsArabic = null;
  for (const ch of str) {
    const isArabic = ARABIC_RE.test(ch);
    const isNeutral = NEUTRAL_RE.test(ch);
    if (currentIsArabic === null) {
      current = ch;
      currentIsArabic = isNeutral ? false : isArabic;
    } else if (isNeutral || isArabic === currentIsArabic) {
      current += ch;
    } else {
      runs.push({ text: current, arabic: currentIsArabic });
      current = ch;
      currentIsArabic = isArabic;
    }
  }
  if (current) runs.push({ text: current, arabic: currentIsArabic });
  return runs;
}

/* ---------- bidi isolation ----------
   A Latin/technical run embedded inside an Arabic sentence (e.g. "ربط نظام
   إدارة العقار مع Airbnb وBooking") needs a strong-direction anchor for the
   bidi algorithm to place it correctly without scrambling. Two explicit-
   isolation approaches were tried and rejected here, both caught by real
   render + rasterize passes (pdftoppm) rather than assumed correct from
   the source:
     1. Unicode LRI (U+2066) / PDI (U+2069) isolates around each Latin run
        — rendered as a stray visible "f"/"i" tofu glyph next to every
        wrapped run (e.g. "قصة المستخدم 01" came out "f01i قصة المستخدم").
     2. Plain LRM (U+200E) marks on each side — invisible *most* of the
        time, but when a wrapped run happens to fall right at a line-wrap
        boundary, the mark's glyph doesn't get culled and prints as a
        stray "-" (e.g. "...مع Airbnb و-" / "Booking.com..." split across
        the wrap, confirmed via `pdftotext -layout` showing a literal "-"
        in the extracted text, not just a rendering illusion).
   Neither of these embedded TTFs (Inter Tight / JetBrains Mono / IBM Plex
   Sans Arabic, per prdFonts.js) treats bidi format characters as the
   zero-width no-glyph codepoints they're defined as — react-pdf's font/
   glyph layer renders *something* for them instead of nothing, in at
   least some layout position. Meanwhile, plain per-script <Text> splitting
   with NO added control characters — just switching FONT.arabic on the
   Arabic runs — was checked against real generated content across every
   section (cover, tables, user-story quotes, dash/numbered lists) mixing
   Airbnb / Booking.com / PMS / Guesty / Hostaway / rate_occupancy into
   Arabic sentences, and consistently kept correct reading order with zero
   stray glyphs: react-pdf's own bidi resolution already handles this
   simple "Latin run embedded in an RTL paragraph" case correctly on its
   own. So: no isolation characters at all — just the font switch. */

/** Returns plain text unchanged for the common (single-script) case; for
 *  a string that mixes Arabic into a Latin-font run, returns an array of
 *  nested <Text> spans so only the Arabic portion switches to FONT.arabic —
 *  safe to drop straight into any <Text>{mixedText(value)}</Text>. */
export function mixedText(value) {
  const str = value == null ? "" : String(value);
  if (!ARABIC_RE.test(str)) return str;
  return splitScriptRuns(str).map((r, i) => (
    <Text key={i} style={r.arabic ? { fontFamily: FONT.arabic } : undefined}>
      {r.text}
    </Text>
  ));
}

/* ---------- star / sparkle motif ----------
   Brand-signature, extremely sparse use only: cover, the top of
   each section-divider page (near the giant number), and the
   final page. Never a repeating texture, never behind paragraphs. */
function sparklePath(cx, cy, r) {
  const rOuter = r;
  const rInner = r * 0.32;
  let d = "";
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

export function StarField({ stars, width = 240, height = 140, style }) {
  return (
    <Svg width={width} height={height} style={style}>
      {stars.map((s, i) => (
        <Path key={i} d={sparklePath(s.x, s.y, s.r)} fill={C.black} fillOpacity={s.o ?? 0.22} />
      ))}
    </Svg>
  );
}

/* A handful of sparse points scattered loosely near the given
   anchor — used so every section-divider page gets a slightly
   different, non-mechanical constellation. */
export function scatterStars(seed, count, spreadX, spreadY) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => ({
    x: rand() * spreadX,
    y: rand() * spreadY,
    r: 2.2 + rand() * 3.2,
    o: 0.14 + rand() * 0.22,
  }));
}

/* ---------- page chrome: header + footer (every page but cover) ---------- */
export function PageChrome() {
  return (
    <>
      <View style={prdStyles.pageHeader} fixed>
        <View style={prdStyles.pageHeaderMark}>
          <Image src={AREEB_LOGO_URL} style={prdStyles.pageHeaderLogo} />
          <Text style={prdStyles.pageHeaderLeft}>AREEB</Text>
        </View>
        <Text style={prdStyles.pageHeaderRight}>{mixedText("مستند متطلبات المنتج")}</Text>
      </View>
      <View style={prdStyles.pageHeaderRule} fixed />
      <View style={prdStyles.pageFooter} fixed>
        <Text style={prdStyles.pageFooterLeft}>{mixedText("ملكية أريب • سرّي")}</Text>
        <Text
          style={prdStyles.pageFooterRight}
          render={({ pageNumber, totalPages }) =>
            `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
          }
          fixed
        />
      </View>
    </>
  );
}

/* ---------- MoSCoW priority / governance status → Arabic (render-only) ----------
   PRDData keeps these as fixed English enum values in the data model itself
   (validated server-side in server.js's normalizePRDData) — never ask the
   model for Arabic enum values. Translate purely for display, here, at the
   single point every such value reaches the page. */
const PRIORITY_AR = { Must: "إلزامي", Should: "مفضّل", Could: "اختياري" };
const STATUS_AR = { Draft: "مسودة", Superseded: "مستبدل", Approved: "معتمد" };

export function translatePriority(value) {
  return PRIORITY_AR[value] || value;
}

export function translateStatus(value) {
  return STATUS_AR[value] || value;
}

/* ---------- the section heading unit ----------
   number + title + description + divider, kept together as one
   block (wrap=false) so it can never render orphaned at the
   bottom of a page — and never repeated on continuation pages,
   since it isn't `fixed`. */
export function SectionHeading({ number, title, description, stars }) {
  return (
    <View style={prdStyles.headingBlock} wrap={false}>
      {stars && (
        <StarField
          stars={stars}
          width={200}
          height={70}
          style={{ position: "absolute", top: -6, right: 0 }}
        />
      )}
      <Text style={prdStyles.sectionNumber}>{number}</Text>
      <Text style={prdStyles.sectionTitle}>{mixedText(title)}</Text>
      <Text style={prdStyles.sectionDescription}>{mixedText(description)}</Text>
      <View style={prdStyles.sectionDivider} />
    </View>
  );
}

/* ---------- editorial table system ----------
   Black header row / white header text, thin gray horizontal
   rules only (no vertical borders), generous padding, header
   row marked `fixed` so it re-renders at the top of every
   continuation page when the table overflows one physical page. */
export function TableHeaderRow({ columns }) {
  return (
    <View style={prdStyles.tableHeaderRow} fixed>
      {columns.map((col) => (
        <Text key={col.key} style={[prdStyles.tableHeaderCell, { width: col.width }]}>
          {mixedText(col.label)}
        </Text>
      ))}
    </View>
  );
}

export function TableRow({ columns, cells, last }) {
  return (
    <View style={[prdStyles.tableRow, last && prdStyles.tableRowLast]} wrap={false}>
      {columns.map((col) => (
        <Text
          key={col.key}
          style={[
            col.mono ? prdStyles.tableCellMono : prdStyles.tableCell,
            { width: col.width, paddingLeft: 8 },
          ]}
        >
          {mixedText(cells[col.key])}
        </Text>
      ))}
    </View>
  );
}

export function EditorialTable({ columns, rows }) {
  return (
    <View>
      <TableHeaderRow columns={columns} />
      {rows.map((row, i) => (
        <TableRow key={row.id || i} columns={columns} cells={row} last={i === rows.length - 1} />
      ))}
    </View>
  );
}

/* ---------- small labeled content block (PROBLEM / OPPORTUNITY / ...) --- */
export function LabeledBlock({ label, children, style }) {
  return (
    <View style={[{ marginBottom: 16 }, style]} wrap={false}>
      <Text style={prdStyles.eyebrowDark}>{mixedText(label)}</Text>
      <Text style={prdStyles.paragraph}>{mixedText(children)}</Text>
    </View>
  );
}

/* ---------- numbered list (01 / 02 / 03 ...) ---------- */
export function NumberedList({ items }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row-reverse", marginBottom: 9 }} wrap={false}>
          <Text
            style={{
              fontFamily: "JetBrains Mono",
              fontSize: 8,
              color: C.gray400,
              width: 20,
              textAlign: "right",
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </Text>
          <Text style={[prdStyles.paragraph, { flex: 1 }]}>{mixedText(item)}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- dash / bullet list ---------- */
export function DashList({ items, style }) {
  return (
    <View style={style}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row-reverse", marginBottom: 7 }} wrap={false}>
          <Text
            style={{ fontFamily: "Inter Tight", fontSize: 10, color: C.gray400, width: 12, textAlign: "right" }}
          >
            —
          </Text>
          <Text style={[prdStyles.paragraph, { flex: 1 }]}>{mixedText(item)}</Text>
        </View>
      ))}
    </View>
  );
}

export { AREEB_LOGO_URL };
