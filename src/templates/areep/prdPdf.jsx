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
   page is `direction: "rtl"`; rows are real RTL flex rows (first
   child = rightmost) rather than LTR rows reversed with
   `row-reverse`; padding is flow-relative (paddingEnd, not
   paddingLeft); and all prose runs through one font that carries both
   scripts, so a sentence mixing Arabic with "WhatsApp" or "FR-001"
   stays a single bidi paragraph. See prdComponents.jsx's header for
   what that replaced and why.

   Technical identifiers (FR-001 / v1.0 / PRD-2026-833 / dates / page
   numbers) are rendered through <Ltr>, which isolates them as atomic
   left-to-right islands so RTL can never invert them.

   Eight pages: a cover, then seven numbered sections. Sections 04
   (Functional Requirements) and 07 (Assumptions / Open Questions /
   Governance) are the two expected to overflow onto a continuation
   page — that is what exercises the `fixed` table header row and
   PageChrome's repeat behaviour.
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
  AREEB_LOGO_URL,
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
    direction: "rtl",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverMark: { flexDirection: "row", alignItems: "center", gap: 8 },
  coverLogo: { width: 20, height: 20 },
  coverWordmark: {
    fontFamily: FONT.mark,
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 3,
    color: C.gray500,
  },
  coverKicker: {
    fontFamily: FONT.arabic,
    fontWeight: 400,
    fontSize: 8.5,
    color: C.gray500,
  },

  coverTitleWrap: { marginTop: 150 },
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
    alignSelf: "flex-start",
  },
  coverRule: {
    height: 1,
    width: 44,
    backgroundColor: C.black,
    marginTop: 30,
    alignSelf: "flex-start",
  },

  /* Metadata as a real RTL row: first item rightmost, each column an
     equal quarter so the four labels sit on one baseline grid. */
  coverMetaRow: {
    direction: "rtl",
    flexDirection: "row",
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
  block: { marginBottom: 26 },
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
    marginBottom: 22,
    paddingEnd: 0,
    paddingStart: 0,
    paddingTop: 2,
    paddingBottom: 2,
    borderRightWidth: 2,
    borderRightColor: C.gray200,
    borderRightStyle: "solid",
    paddingRight: 16,
  },
  storyHead: {
    direction: "rtl",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
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
  storyCriteriaLabel: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 8,
    color: C.gray500,
    marginTop: 12,
    marginBottom: 8,
    textAlign: "right",
  },

  /* ---------- scope column heads ---------- */
  scopeHead: {
    direction: "rtl",
    flexDirection: "row",
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
   = 459.28, and each column carries paddingEnd: 10 inside that. A few
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
   The document
   ============================================================ */
export function PRDDocument({ data = prdSampleData }) {
  registerPRDFonts();

  /* priority/status stay fixed English enum values in the data model
     (validated server-side) — translated to Arabic only at render time.
     `priorityRaw` is carried through so the pill can style the "Must"
     case without re-deriving it from the translated label. */
  const frRows = data.functionalRequirements.map((fr) => ({ ...fr, priorityRaw: fr.priority }));
  const goalsRows = data.goals.map((g, i) => ({ id: i, ...g }));
  const openQRows = data.openQuestions.map((q, i) => ({ id: i, ...q }));
  const govRows = data.governance.map((g, i) => ({ id: i, ...g, status: translateStatus(g.status) }));

  return (
    <Document
      title={`${data.meta.prdId} — ${data.meta.projectName}`}
      author="Areeb"
      subject="Product Requirements Document"
      creator="Areeb PRD Generator"
      language="ar"
    >
      {/* ---------- COVER ---------- */}
      <Page size="A4" style={prdStyles.coverPage}>
        <View style={local.coverTop}>
          <View style={local.coverMark}>
            <Image src={AREEB_LOGO_URL} style={local.coverLogo} />
            <Text style={local.coverWordmark}>AREEB</Text>
          </View>
          <Text style={local.coverKicker}>مستند متطلبات المنتج</Text>
        </View>

        <StarField
          stars={scatterStars(11, 24, 300, 150)}
          width={300}
          height={150}
          style={{ position: "absolute", top: 120, right: 56 }}
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

      {/* ---------- 01 · الملخص التنفيذي ---------- */}
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

      {/* ---------- 02 · تحليل المشكلة ---------- */}
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

      {/* ---------- 03 · الأهداف ومؤشرات النجاح ---------- */}
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

      {/* ---------- 04 · المتطلبات الوظيفية ---------- */}
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

      {/* ---------- 05 · قصص المستخدم ---------- */}
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
              <Text style={prdStyles.quote}>{s.quote}</Text>
              <Text style={local.storyCriteriaLabel}>معايير القبول</Text>
              <DashList items={s.acceptance} />
            </View>
          ))}
        </View>
      </Page>

      {/* ---------- 06 · نطاق العمل ---------- */}
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

      {/* ---------- 07 · الافتراضات والأسئلة المفتوحة والحوكمة ---------- */}
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
