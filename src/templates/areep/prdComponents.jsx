/* ============================================================
   RTL building blocks for the PRD PDF — page chrome, the section
   heading unit, the table system, lists, and the priority pill.

   ---------- what is deliberately NOT in this file any more ----------
   The previous build exported `mixedText()`, which split every string
   into per-script <Text> spans so an Arabic run could switch to an
   Arabic-only font mid-sentence. That helper is gone, and its removal
   is the substance of this rewrite rather than a side effect.

   react-pdf applies the bidi algorithm inside a single Text node.
   Sibling Text spans are laid out sequentially in the parent's flex
   direction instead, so a split sentence stopped being one bidi
   paragraph: each fragment resolved its own direction and the
   fragments were then placed in DOM order. Any Arabic sentence
   containing a Latin term therefore reordered its own clauses as soon
   as it wrapped — verified in rendered output, e.g.

     input   المدعوون يستخدمون WhatsApp كقناة تواصل أساسية، ولا حاجة…
     output  كقناة تواصل أساسية، ولا حاجة… WhatsApp المدعوون يستخدمون

   Sentence-final punctuation drifted to the wrong edge for the same
   reason (".وتضيع الردود" instead of "وتضيع الردود.").

   With the full IBM Plex Sans Arabic registered (Latin + Arabic in one
   family — see prdFonts.js) no split is needed: mixed text is one Text
   node, one bidi paragraph, and react-pdf orders it correctly.

   The single exception is <Ltr> below, for technical identifiers.
   ============================================================ */
import { View, Text, Svg, Path, Image } from "@react-pdf/renderer";
import { C, prdStyles } from "./prdStyles";
import { LOGO_MARK_BLACK, LOGO_LOCKUP_BLACK, LOGO_LOCKUP_RATIO } from "../../lib/brand";

/* The BLACK cut, because this document is printed on white A4 — the one
   light surface in the product. This template used to draw a file called
   `logo.png` (since deleted) that was byte-identical to the white mark,
   so the header logo was white-on-white and effectively invisible in
   every generated PDF. See src/lib/brand.js. */
const AREEB_LOGO_URL = LOGO_MARK_BLACK;
export { LOGO_LOCKUP_BLACK, LOGO_LOCKUP_RATIO };

/* ---------- technical identifier (spec §5) ----------
   FR-001, NFR-002, v1.0, PRD-2026-833, 2026-08-28, "August 28, 2026".

   These must never reorder. Inside an RTL paragraph the bidi algorithm
   treats a Latin run correctly on its own, but a run that both STARTS
   and ENDS with a bidi-neutral character (a digit, a hyphen, a dot)
   can pick up the surrounding paragraph direction and split around its
   own separators — which is how "FR-001" becomes "001-FR".

   Giving the run its own `direction: "ltr"` Text node makes it an
   atomic left-to-right island. This is the correct mechanism and not
   the Unicode control characters (LRI/PDI, LRM) an earlier attempt
   used: none of the embedded TTFs treat those as zero-width, so they
   printed as stray tofu or hyphen glyphs at line-wrap boundaries. */
export function Ltr({ children, style }) {
  return <Text style={[prdStyles.ltr, style]}>{children}</Text>;
}

/* ---------- star / sparkle motif ----------
   Brand-signature, extremely sparse: cover and the top of each section
   page, near the numeral. Never a repeating texture, never behind
   paragraphs. */
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

/** Sparse, deterministic constellation — a different one per section. */
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

/* ---------- page chrome (every page but the cover) ----------
   RTL order, per spec §9: brand mark on the right, document name to
   its left in the header; confidentiality note right and the page
   counter left in the footer. Order comes from `row-reverse` (see
   prdStyles.js rule 1) — the first child below is the rightmost one.
   The wordmark and the counter stay LTR: brand and technical
   identifiers, not prose.

   Two @react-pdf/renderer quirks are worked around here, both found by
   rendering and inspecting real output rather than from the source:

   1. `bottom` DOES NOT POSITION an absolutely-positioned Page child.
      The footer was written as `position: absolute; bottom: 34` and
      rendered nowhere at all — no note, no page numbers, on any page.
      Switching to a `top` offset placed it correctly and immediately.
      So the footer's offset is expressed from the top of the page
      (prdStyles.pageFooter), measured to sit below the content box
      (which ends at 841.89 - 64 = 777.89pt).

   2. A `fixed` container holding a `render`-callback child renders only
      ONE of its children. With the note static and the counter dynamic,
      only the counter appeared; making both dynamic flipped it so only
      the note appeared. The header is unaffected — all of its children
      are static and both render. Rather than depend on that ordering,
      the footer is split into two independently `fixed` layers, each
      with a single child, positioned by which edge they align to. */
export function PageChrome() {
  return (
    <>
      <View style={prdStyles.pageHeader} fixed>
        <View style={prdStyles.pageHeaderMark}>
          <Image src={AREEB_LOGO_URL} style={prdStyles.pageHeaderLogo} />
          <Text style={prdStyles.pageHeaderWordmark}>AREEB</Text>
        </View>
        <Text style={prdStyles.pageHeaderDoc}>مستند متطلبات المنتج</Text>
      </View>
      <View style={prdStyles.pageHeaderRule} fixed />
      <View style={prdStyles.pageFooterNoteLayer} fixed>
        <Text style={prdStyles.pageFooterNote}>ملكية أريب • سرّي</Text>
      </View>
      <View style={prdStyles.pageFooterCounterLayer} fixed>
        <Text
          style={prdStyles.pageFooterCounter}
          render={({ pageNumber, totalPages }) =>
            `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
          }
        />
      </View>
    </>
  );
}

/* ---------- MoSCoW priority / governance status → Arabic (render-only) ----
   The data model keeps these as fixed English enum values (validated
   server-side) — never ask the model for Arabic enum values. They are
   translated purely for display, here, at the single point every such
   value reaches the page.

   All five MoSCoW values are present: collapsing "Won't"/"Unspecified"
   onto "Could" printed a deferred requirement as "اختياري", and a
   generated PRD misstating a priority is worse than one saying it
   doesn't know. */
const PRIORITY_AR = { Must: "إلزامي", Should: "مفضّل", Could: "اختياري", "Won't": "مؤجل", Unspecified: "غير محدد" };
const STATUS_AR = { Draft: "مسودة", Superseded: "مستبدل", Approved: "معتمد" };

export function translatePriority(value) {
  return PRIORITY_AR[value] || value;
}

export function translateStatus(value) {
  return STATUS_AR[value] || value;
}

/** Only the highest priority gets the solid treatment — one accent per
 *  table keeps the page calm and makes "إلزامي" scannable at a glance. */
export function PriorityPill({ value }) {
  const solid = value === "Must";
  return (
    <View style={[prdStyles.pill, solid && prdStyles.pillSolid]}>
      <Text style={[prdStyles.pillText, solid && prdStyles.pillTextSolid]}>{translatePriority(value)}</Text>
    </View>
  );
}

/* ---------- the section heading unit (spec §11) ----------
   Numeral (background layer, pinned to the right margin) → title →
   lede → rule. `wrap={false}` keeps the whole unit together so a
   heading can never be orphaned at the foot of a page away from its
   own content. */
export function SectionHeading({ number, title, lede, stars }) {
  return (
    <View style={prdStyles.headingBlock} wrap={false}>
      {stars && <StarField stars={stars} width={190} height={64} style={{ position: "absolute", top: -8, right: 96 }} />}
      <Text style={prdStyles.headingNumeral}>{number}</Text>
      <Text style={prdStyles.headingTitle}>{title}</Text>
      {lede ? <Text style={prdStyles.headingLede}>{lede}</Text> : null}
      <View style={prdStyles.headingRule} />
    </View>
  );
}

/* ---------- editorial table system ----------
   Black header row, thin horizontal rules only, no vertical borders.
   The header row is `fixed`, so it repeats at the top of every
   continuation page when a table overflows (spec §8).

   Column order is written in READING order — the first entry is the
   rightmost column, because the row is `row-reverse`. Each
   column declares its own `align` and renderer; a cell never inherits
   an alignment that disagrees with its header, which is what made the
   old tables look ragged column by column. */
function CellContent({ col, row }) {
  const value = row[col.key];
  if (col.render) return col.render(row);
  if (col.id) return <Ltr style={prdStyles.tableCellId}>{value}</Ltr>;
  return <Text style={col.strong ? prdStyles.tableCellStrong : prdStyles.tableCell}>{value}</Text>;
}

export function EditorialTable({ columns, rows, zebra = false }) {
  return (
    <View>
      <View style={prdStyles.tableHeaderRow} fixed>
        {columns.map((col) => (
          <View key={col.key} style={{ width: col.width, paddingLeft: 10 }}>
            <Text style={prdStyles.tableHeaderCell}>{col.label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, i) => (
        <View
          key={row.id ?? i}
          style={[
            prdStyles.tableRow,
            zebra && i % 2 === 1 && prdStyles.tableRowZebra,
            i === rows.length - 1 && prdStyles.tableRowLast,
          ]}
          wrap={false}
        >
          {columns.map((col) => (
            <View key={col.key} style={{ width: col.width, paddingLeft: 10 }}>
              <CellContent col={col} row={row} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ---------- labeled prose block ---------- */
export function LabeledBlock({ label, children, style }) {
  return (
    <View style={[{ marginBottom: 18 }, style]} wrap={false}>
      <Text style={prdStyles.label}>{label}</Text>
      <Text style={prdStyles.paragraph}>{children}</Text>
    </View>
  );
}

/* ---------- numbered list (01 / 02 / 03 …) ----------
   The numeral is an <Ltr> island so "01" never inverts, and it sits
   first in the row — rightmost under RTL. */
export function NumberedList({ items }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={prdStyles.listRow} wrap={false}>
          <Ltr style={prdStyles.listMarkerNum}>{String(i + 1).padStart(2, "0")}</Ltr>
          <View style={prdStyles.listText}>
            <Text style={prdStyles.paragraph}>{item}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- dash list ----------
   An en dash rather than an em dash: the em dash is wide enough to
   read as a rule against Arabic's lower x-height. */
export function DashList({ items, style }) {
  return (
    <View style={style}>
      {items.map((item, i) => (
        <View key={i} style={prdStyles.listRow} wrap={false}>
          <Text style={prdStyles.listMarkerDash}>–</Text>
          <View style={prdStyles.listText}>
            <Text style={prdStyles.paragraph}>{item}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export { AREEB_LOGO_URL };
