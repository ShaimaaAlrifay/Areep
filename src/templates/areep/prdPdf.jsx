/* ============================================================
   PRD PDF — the document tree, Arabic-first.

   Rendering path: @react-pdf/renderer end to end (not
   html2canvas/jsPDF). That decision is locked in at prdFonts.js /
   prdStyles.js / prdComponents.jsx: real embeddable TTFs via
   Font.register, react-pdf's default hyphenation callback disabled
   (it breaks Arabic letter joining across a wrap), and layout built
   on react-pdf's own StyleSheet/View/Text/Svg primitives.
   html2canvas/jsPDF would rasterize the page — heavier file, blurry
   text at zoom, and no selectable or searchable text, unacceptable
   for a document whose whole premise is "a real requirements doc".

   ---------- the Arabic layout system ----------
   This document is designed in Arabic, not translated into it. Every
   page carries `direction: "rtl"` for bidi and default alignment,
   every horizontal band is a `row-reverse` flex row so its first child
   renders rightmost, right-anchoring uses `alignSelf: "flex-end"`, and
   all prose runs through one font that carries both scripts — so a
   sentence mixing Arabic with "WhatsApp" or "FR-001" stays a single
   bidi paragraph. prdStyles.js rule 1 documents why direction and
   layout are two separate mechanisms in this renderer;
   prdComponents.jsx's header documents what the font change replaced.

   Technical identifiers (FR-001 / v1.0 / PRD-2026-833 / dates / page
   numbers) are rendered through <Ltr>, which isolates them as atomic
   left-to-right islands so RTL can never invert them.

   Eight sections: a cover, then seven numbered ones. Sections are not
   the same thing as pages — an overflowing section continues onto extra
   sheets, so the sample data renders ten. On that data 05 (User Stories)
   and 07 (Assumptions / Open Questions / Governance) are the two that
   overflow, which is what exercises the `fixed` table header row and
   PageChrome's repeat behaviour. Which sections spill depends on the
   content, so nothing may assume a fixed page count — see
   measureSectionPages() for how the preview's TOC gets real numbers.
   ============================================================ */
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { registerPRDFonts, FONT } from "./prdFonts";
import { C, prdStyles, T } from "./prdStyles";
import {
  PageChrome,
  SectionHeading,
  EditorialTable,
  LabeledBlock,
  NumberedList,
  DashList,
  PriorityPill,
  StarField,
  scatterStars,
  LOGO_LOCKUP_BLACK,
  LOGO_LOCKUP_RATIO,
  Ltr,
  translateStatus,
} from "./prdComponents";
import { prdSampleData } from "./prdSampleData";

const local = StyleSheet.create({
  /* ---------- cover ----------
     A three-band cover: mark row at the top, the title block on the
     optical third, metadata pinned to the foot. `marginTop: "auto"`
     on the metadata does the pinning, so the middle band absorbs
     whatever height the title and lede actually need — a long Arabic
     project name grows the block instead of colliding with the row
     below it. */
  coverTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  /* The cover carries the full horizontal lockup (mark + أريب / AREEB)
     in its black cut — this is white paper. Height is set and width
     derived from the artwork's own ratio so the lockup is never
     squashed; the running header uses the mark alone, since at 11pt the
     lockup's wordmark would be too small to read. */
  coverLockup: { height: 26, width: 26 * LOGO_LOCKUP_RATIO },
  coverKicker: {
    fontFamily: FONT.arabic,
    fontWeight: 400,
    fontSize: 8.5,
    color: C.gray500,
  },

  coverTitleWrap: { marginTop: 196 },
  coverDocType: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 13,
    color: C.gray500,
    textAlign: "right",
    marginBottom: 14,
  },
  coverTitle: {
    fontFamily: FONT.arabic,
    fontWeight: T.coverTitle.weight,
    fontSize: T.coverTitle.size,
    lineHeight: T.coverTitle.leading,
    color: C.black,
    textAlign: "right",
  },
  coverLede: {
    fontFamily: FONT.arabic,
    fontWeight: T.coverLede.weight,
    fontSize: T.coverLede.size,
    lineHeight: T.coverLede.leading,
    color: C.gray600,
    textAlign: "right",
    marginTop: 20,
    maxWidth: 400,
    alignSelf: "flex-end",
  },
  coverRule: {
    height: 1,
    width: 44,
    backgroundColor: C.black,
    marginTop: 30,
    alignSelf: "flex-end",
  },

  /* Metadata as a real RTL row: first item rightmost, each column an
     equal quarter so the four labels sit on one baseline grid. */
  coverMetaRow: {
    flexDirection: "row-reverse",
    marginTop: "auto",
    paddingTop: 24,
    borderTopWidth: 0.75,
    borderTopColor: C.gray200,
    borderTopStyle: "solid",
  },
  coverMetaItem: { width: "25%" },
  coverMetaLabel: {
    fontFamily: FONT.arabic,
    fontWeight: 400,
    fontSize: 7.5,
    color: C.gray500,
    textAlign: "right",
    marginBottom: 6,
  },
  coverMetaValue: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 10.5,
    color: C.black,
    textAlign: "right",
  },
  coverMetaValueLtr: {
    direction: "ltr",
    fontFamily: FONT.mono,
    fontSize: 9.5,
    color: C.black,
    textAlign: "right",
  },

  /* ---------- section body ---------- */
  sectionBody: { flex: 1 },
  block: { marginBottom: 16 },
  tableNote: {
    fontFamily: FONT.arabic,
    fontSize: 8,
    color: C.gray500,
    textAlign: "right",
    marginTop: 10,
  },

  /* ---------- user story card ----------
     A card, not a run of loose paragraphs: a hairline rule on the
     reading-leading (right) edge groups the quote with its own
     acceptance criteria, and `wrap={false}` on the whole card means a
     story can never be split across two pages (spec §8). */
  storyCard: {
    marginBottom: 12,
    paddingTop: 2,
    paddingBottom: 2,
    borderRightWidth: 2,
    borderRightColor: C.gray200,
    borderRightStyle: "solid",
    paddingRight: 16,
  },
  storyHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  storyNum: {
    direction: "ltr",
    fontFamily: FONT.mono,
    fontSize: 7.5,
    color: C.gray400,
  },
  storyLabel: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 8.5,
    color: C.gray500,
  },
  /* The measure cap has to sit on this View, not on the quote's own Text.
     @react-pdf/layout gives a Text node its own measure function, and a
     maxWidth declared directly on that Text is not honoured — measured
     both ways against real output: on the Text the quote kept running the
     full 465pt card width, on this wrapper it breaks at 430pt as asked.

     430pt at 11pt Arabic is roughly 70 characters a line. The full card
     width ran past 78, which is beyond a comfortable measure and made the
     story quotes read as body copy rather than as pull quotes. */
  storyQuoteWrap: { maxWidth: 430, alignSelf: "flex-end" },
  storyCriteriaLabel: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 8,
    color: C.gray500,
    marginTop: 8,
    marginBottom: 6,
    textAlign: "right",
  },

  /* ---------- scope column heads ---------- */
  scopeHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.black,
    borderBottomStyle: "solid",
  },
  scopeHeadText: {
    fontFamily: FONT.arabic,
    fontWeight: 700,
    fontSize: 11,
    color: C.black,
  },
});

/* ---------- table column configs ----------
   Written in READING order: the first entry renders rightmost under
   `direction: rtl`. Widths must sum to the row's usable width —
   CONTENT_W (483.28) minus the row's own paddingHorizontal (12 + 12)
   = 459.28, and each column carries paddingLeft: 10 inside that. A few
   points of slack is deliberate; yoga does not shrink fixed-width
   flex children, so an over-budget row would push its last column
   past the margin. */
const frColumns = [
  { key: "id", label: "الرقم", width: 52, id: true },
  { key: "title", label: "المتطلب", width: 108, strong: true },
  { key: "description", label: "الوصف", width: 232 },
  { key: "priority", label: "الأولوية", width: 62, render: (row) => <PriorityPill value={row.priorityRaw} /> },
];

const goalsColumns = [
  { key: "value", label: "المعرّف", width: 62, id: true },
  { key: "name", label: "الهدف", width: 120, strong: true },
  { key: "description", label: "الوصف", width: 180 },
  { key: "measurement", label: "طريقة القياس", width: 92 },
];

const openQColumns = [
  { key: "question", label: "السؤال المفتوح", width: 350 },
  { key: "owner", label: "المسؤول", width: 104 },
];

const govColumns = [
  { key: "version", label: "الإصدار", width: 54, id: true },
  { key: "date", label: "التاريخ", width: 74, id: true },
  { key: "change", label: "التغيير", width: 200 },
  { key: "owner", label: "المسؤول", width: 66 },
  { key: "status", label: "الحالة", width: 60 },
];

/* ============================================================
   The document — one component per section
   ------------------------------------------------------------
   Each section owns exactly one <Page> element, and derives whatever
   rows it needs from `data` itself, so it can be rendered on its own.
   That is load-bearing for the preview's table of contents, not tidiness:
   in @react-pdf/renderer a <Page> never flows content into its sibling.
   A section that overflows adds continuation pages after itself and the
   next <Page> still starts on a fresh sheet, so a section's page count is
   identical whether it renders alone or inside the whole document.
   measureSectionPages() below turns that property into real page numbers.
   ============================================================ */

/* ---------- COVER ---------- */
function CoverPage({ data }) {
  return (
    <Page size="A4" style={prdStyles.coverPage}>
      <View style={local.coverTop}>
        <Image src={LOGO_LOCKUP_BLACK} style={local.coverLockup} />
        {/* Not a second "مستند متطلبات المنتج" — the doc type already
            headlines the title block below. This slot carries the
            classification instead, so the row adds information rather
            than repeating it. */}
        <Text style={local.coverKicker}>سرّي — ملكية أريب</Text>
      </View>

      <StarField
        stars={scatterStars(11, 24, 300, 124)}
        width={300}
        height={124}
        style={{ position: "absolute", top: 132, right: 56 }}
      />

      <View style={local.coverTitleWrap}>
        <Text style={local.coverDocType}>مستند متطلبات المنتج</Text>
        <Text style={local.coverTitle}>{data.meta.projectName}</Text>
        <Text style={local.coverLede}>{data.meta.shortDescription}</Text>
        <View style={local.coverRule} />
      </View>

      <View style={local.coverMetaRow}>
        <View style={local.coverMetaItem}>
          <Text style={local.coverMetaLabel}>رقم المستند</Text>
          <Ltr style={local.coverMetaValueLtr}>{data.meta.prdId}</Ltr>
        </View>
        <View style={local.coverMetaItem}>
          <Text style={local.coverMetaLabel}>الإصدار</Text>
          <Ltr style={local.coverMetaValueLtr}>{data.meta.version}</Ltr>
        </View>
        <View style={local.coverMetaItem}>
          <Text style={local.coverMetaLabel}>الحالة</Text>
          <Text style={local.coverMetaValue}>{translateStatus(data.meta.status)}</Text>
        </View>
        <View style={local.coverMetaItem}>
          <Text style={local.coverMetaLabel}>التاريخ</Text>
          <Ltr style={local.coverMetaValueLtr}>{data.meta.date}</Ltr>
        </View>
      </View>
    </Page>
  );
}

/* ---------- 01 · الملخص التنفيذي ---------- */
function ExecutiveSummaryPage({ data }) {
  return (
    <Page size="A4" style={prdStyles.page}>
      <PageChrome />
      <SectionHeading
        number="01"
        title="الملخص التنفيذي"
        lede={data.executiveSummary.description}
        stars={scatterStars(2, 8, 150, 46)}
      />
      <View style={prdStyles.sectionBody}>
        <LabeledBlock label="المشكلة">{data.executiveSummary.problem}</LabeledBlock>
        <LabeledBlock label="الفرصة">{data.executiveSummary.opportunity}</LabeledBlock>
        <LabeledBlock label="الحل">{data.executiveSummary.solution}</LabeledBlock>
        <LabeledBlock label="النتيجة">{data.executiveSummary.outcome}</LabeledBlock>
        <View style={{ marginTop: 6 }}>
          <Text style={prdStyles.groupLabel}>أبرز الرؤى</Text>
          <NumberedList items={data.executiveSummary.keyInsights} />
        </View>
      </View>
    </Page>
  );
}

/* ---------- 02 · تحليل المشكلة ---------- */
function ProblemAnalysisPage({ data }) {
  return (
    <Page size="A4" style={prdStyles.page}>
      <PageChrome />
      <SectionHeading
        number="02"
        title="تحليل المشكلة"
        lede="الوضع الحالي، الاحتكاك الكامن فيه، السبب الجذري وراءه، والوضع المنشود الذي نتجه إليه."
        stars={scatterStars(5, 8, 150, 46)}
      />
      <View style={prdStyles.sectionBody}>
        <LabeledBlock label="الوضع الحالي">{data.problemAnalysis.currentState}</LabeledBlock>
        <LabeledBlock label="نقاط الاحتكاك">{data.problemAnalysis.friction}</LabeledBlock>
        <LabeledBlock label="السبب الجذري">{data.problemAnalysis.rootCause}</LabeledBlock>
        <LabeledBlock label="الفرصة">{data.problemAnalysis.opportunity}</LabeledBlock>
        <LabeledBlock label="الوضع المنشود">{data.problemAnalysis.desiredState}</LabeledBlock>
      </View>
    </Page>
  );
}

/* ---------- 03 · الأهداف ومؤشرات النجاح ---------- */
function GoalsPage({ data }) {
  const goalsRows = data.goals.map((g, i) => ({ id: i, ...g }));
  return (
    <Page size="A4" style={prdStyles.page}>
      <PageChrome />
      <SectionHeading
        number="03"
        title="الأهداف ومؤشرات النجاح"
        lede="شكل النجاح، بالأرقام — كل هدف مقترن بطريقة قياسه فعليًا."
        stars={scatterStars(8, 8, 150, 46)}
      />
      <EditorialTable columns={goalsColumns} rows={goalsRows} />
    </Page>
  );
}

/* ---------- 04 · المتطلبات الوظيفية ---------- */
function FunctionalRequirementsPage({ data }) {
  /* priority/status stay fixed English enum values in the data model
     (validated server-side) — translated to Arabic only at render time.
     `priorityRaw` is carried through so the pill can style the "Must"
     case without re-deriving it from the translated label. */
  const frRows = data.functionalRequirements.map((fr) => ({ ...fr, priorityRaw: fr.priority }));
  return (
    <Page size="A4" style={prdStyles.page}>
      <PageChrome />
      <SectionHeading
        number="04"
        title="المتطلبات الوظيفية"
        lede="كل متطلب، مرتّب بحسب أولوية MoSCoW — إلزامي، مفضّل، اختياري، مؤجل."
        stars={scatterStars(13, 8, 150, 46)}
      />
      <EditorialTable columns={frColumns} rows={frRows} zebra />
    </Page>
  );
}

/* ---------- 05 · قصص المستخدم ---------- */
function UserStoriesPage({ data }) {
  return (
    <Page size="A4" style={prdStyles.page}>
      <PageChrome />
      <SectionHeading
        number="05"
        title="قصص المستخدم"
        lede="بكلمات المؤسس نفسه — وباللهجة التي صُمم أريب لفهمها فعليًا — مع معايير القبول الخاصة بكل قصة."
        stars={scatterStars(17, 8, 150, 46)}
      />
      <View>
        {data.userStories.map((s) => (
          <View key={s.number} style={local.storyCard} wrap={false}>
            <View style={local.storyHead}>
              <Text style={local.storyLabel}>قصة المستخدم</Text>
              <Ltr style={local.storyNum}>{s.number}</Ltr>
            </View>
            <View style={local.storyQuoteWrap}>
              <Text style={prdStyles.quote}>{s.quote}</Text>
            </View>
            <Text style={local.storyCriteriaLabel}>معايير القبول</Text>
            <DashList items={s.acceptance} />
          </View>
        ))}
      </View>
    </Page>
  );
}

/* ---------- 06 · نطاق العمل ---------- */
function ScopePage({ data }) {
  return (
    <Page size="A4" style={prdStyles.page}>
      <PageChrome />
      <SectionHeading
        number="06"
        title="نطاق العمل"
        lede="ما يغطيه الإصدار الأول، وبنفس القدر من التعمّد، ما لا يغطيه."
        stars={scatterStars(21, 8, 150, 46)}
      />
      <View style={prdStyles.twoCol}>
        <View style={prdStyles.col}>
          <View style={local.scopeHead}>
            <Text style={local.scopeHeadText}>ضمن النطاق</Text>
          </View>
          <DashList items={data.scope.inScope} />
        </View>
        <View style={prdStyles.col}>
          <View style={local.scopeHead}>
            <Text style={local.scopeHeadText}>خارج النطاق</Text>
          </View>
          <DashList items={data.scope.outOfScope} />
        </View>
      </View>
    </Page>
  );
}

/* ---------- 07 · الافتراضات والأسئلة المفتوحة والحوكمة ---------- */
function AssumptionsPage({ data }) {
  const openQRows = data.openQuestions.map((q, i) => ({ id: i, ...q }));
  const govRows = data.governance.map((g, i) => ({ id: i, ...g, status: translateStatus(g.status) }));
  return (
    <Page size="A4" style={prdStyles.page}>
      <PageChrome />
      <SectionHeading
        number="07"
        title="الافتراضات والأسئلة المفتوحة"
        lede="ما نأخذه كمُسلّمات، وما لا يزال دون حل، وسجل الإصدارات وراء هذا المستند."
        stars={scatterStars(29, 8, 150, 46)}
      />
      <View style={local.block}>
        <Text style={prdStyles.groupLabel}>الافتراضات</Text>
        <NumberedList items={data.assumptions} />
      </View>
      <View style={local.block} break={false}>
        <Text style={prdStyles.groupLabel}>الأسئلة المفتوحة</Text>
        <EditorialTable columns={openQColumns} rows={openQRows} />
      </View>
      <View style={local.block}>
        <Text style={prdStyles.groupLabel}>الحوكمة وسجل الإصدارات</Text>
        <EditorialTable columns={govColumns} rows={govRows} />
      </View>
    </Page>
  );
}

/* The document's section order, and the labels the preview's table of
   contents shows. Exported so the TOC is derived from the template
   rather than restated — a hardcoded copy silently rots the moment a
   section is added, reordered, or renamed. */
export const PRD_SECTIONS = [
  { id: "cover", label: "الغلاف", Component: CoverPage },
  { id: "executive-summary", label: "01 · الملخص التنفيذي", Component: ExecutiveSummaryPage },
  { id: "problem-analysis", label: "02 · تحليل المشكلة", Component: ProblemAnalysisPage },
  { id: "goals", label: "03 · الأهداف ومؤشرات النجاح", Component: GoalsPage },
  { id: "functional-reqs", label: "04 · المتطلبات الوظيفية", Component: FunctionalRequirementsPage },
  { id: "user-stories", label: "05 · قصص المستخدم", Component: UserStoriesPage },
  { id: "scope", label: "06 · نطاق العمل", Component: ScopePage },
  { id: "assumptions", label: "07 · الافتراضات والأسئلة المفتوحة", Component: AssumptionsPage },
];

export function PRDDocument({ data = prdSampleData }) {
  registerPRDFonts();

  return (
    <Document
      title={`${data.meta.prdId} — ${data.meta.projectName}`}
      author="Areeb"
      subject="Product Requirements Document"
      creator="Areeb PRD Generator"
      language="ar"
    >
      {PRD_SECTIONS.map(({ id, Component }) => (
        <Component key={id} data={data} />
      ))}
    </Document>
  );
}

/* ============================================================
   Browser-side PRD generation — entirely client-side, no network
   round-trip, no server, once the structured data is in hand.

   Split into two steps so the inline chat artifact card (Areeb.jsx)
   can build the file the moment the model finishes — showing a real
   "جاري الإنشاء" state backed by actual PDF rendering, not a fake
   timer — while leaving the actual browser save/download gated
   behind a real user click on the card's "تحميل" button (both for
   the expected UX — the file is discovered and pulled from the
   artifact, never pushed on generation — and because some browsers
   only allow a download to start from a direct user gesture).
   ============================================================ */
export async function buildPRDBlob(data = prdSampleData, filename) {
  registerPRDFonts();
  const blob = await pdf(<PRDDocument data={data} />).toBlob();
  /* meta.projectSlug is server-sanitized (normalizePRDData in server.js
     strips it to [A-Za-z0-9_] and falls back to "Areeb_PRD"), but guard
     here too since buildPRDBlob is also called directly against
     prdSampleData (no projectSlug field) and any other future caller. */
  const slug = /^[A-Za-z0-9_]+$/.test(data?.meta?.projectSlug || "") ? data.meta.projectSlug : "Areeb_PRD";
  const version = (data?.meta?.version || "v1.0").replace(/^v/i, "");
  const name = filename || `PRD_${slug}_v${version}.pdf`;
  return { blob, filename: name };
}

/* ---------- real page count from the rendered blob ----------
   @react-pdf/renderer's pdf().toBlob() doesn't expose a page count
   directly. Rather than pull in a heavy PDF-parsing dependency, count
   "/Type /Page" object dictionaries in the raw PDF bytes (excluding
   "/Type /Pages", the parent page-tree node, via a negative lookahead so
   it doesn't match the trailing "s"). Verified empirically against
   pdfinfo's real page count on live-generated output from this renderer
   (pdfkit-based, uncompressed top-level page objects — not object
   streams) — the two numbers matched exactly across every test document.
   If a future change to the render pipeline ever introduces compressed
   object streams for page objects, this count would need pdf-lib (or
   similar) instead; re-verify against pdfinfo if that ever changes. */
export async function countPdfPages(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  const matches = text.match(/\/Type\s*\/Page(?![A-Za-z])/g);
  return matches ? matches.length : 0;
}

/* ---------- real start page for every section ----------
   The preview's table of contents needs the page each section actually
   begins on. That cannot be hardcoded: @react-pdf/renderer paginates
   overflow, so sections 04 and 07 (see this file's header note) spill onto
   continuation pages and push everything after them down — a fixed 1..8
   mapping is wrong for real documents and was landing TOC clicks on the
   wrong page.

   Because a <Page> never flows into its sibling, each section paginates
   identically alone and in context. So rendering the sections separately
   and running a cumulative sum over their page counts gives exact start
   pages, with no PDF-outline parsing and no extra dependency. The renders
   are independent, so they go out in parallel.

   A section whose count comes back unusable falls back to 1 page rather
   than 0: a 0 would alias its start page onto the next section's and
   silently corrupt every entry below it. */
export async function measureSectionPages(data = prdSampleData) {
  registerPRDFonts();
  const counts = await Promise.all(
    PRD_SECTIONS.map(({ Component }) =>
      pdf(
        <Document>
          <Component data={data} />
        </Document>,
      )
        .toBlob()
        .then(countPdfPages)
        .then((n) => (Number.isInteger(n) && n > 0 ? n : 1))
        .catch(() => 1),
    ),
  );

  let page = 1;
  return PRD_SECTIONS.map((section, i) => {
    const entry = { id: section.id, label: section.label, page, pages: counts[i] };
    page += counts[i];
    return entry;
  });
}

export function triggerPRDDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadPRDPdf(data = prdSampleData, filename) {
  const { blob, filename: name } = await buildPRDBlob(data, filename);
  triggerPRDDownload(blob, name);
  return blob;
}
