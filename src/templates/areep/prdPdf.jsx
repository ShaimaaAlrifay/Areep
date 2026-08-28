/* ============================================================
   PRD PDF — the document tree.

   Rendering path: @react-pdf/renderer end to end (not
   html2canvas/jsPDF). That decision was made — and locked in —
   back at prdFonts.js / prdStyles.js / prdComponents.jsx:
     - prdFonts.js registers real embeddable TTFs via Font.register
       and disables react-pdf's default hyphenation callback
       specifically because it breaks Arabic letter joining across
       a wrapped line.
     - prdStyles.js / prdComponents.jsx already build on
       @react-pdf/renderer's StyleSheet/View/Text/Svg primitives.
   html2canvas/jsPDF would rasterize the page (screenshot-to-PDF),
   which produces a heavier file, blurry text at zoom, and no
   selectable/searchable text — unacceptable for a document whose
   whole premise is "a real requirements doc," and unnecessary
   since @react-pdf/renderer's Arabic + RTL support is verified
   working in this file's own render (see the Arabic spike test
   noted in the delivery report — arabicParagraph in the User
   Stories page carries real RTL, joined Arabic text end to end).

   Eight pages: a cover, then seven numbered sections. Section 04
   (Functional Requirements, 15 rows) and section 07 (Assumptions /
   Open Questions / Governance) are the two pages expected to
   overflow their first physical page — that's what exercises the
   `fixed` header-row / PageChrome continuation behavior.
   ============================================================ */
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { registerPRDFonts, FONT } from "./prdFonts";
import { C, prdStyles } from "./prdStyles";
import {
  PageChrome,
  SectionHeading,
  EditorialTable,
  LabeledBlock,
  NumberedList,
  DashList,
  StarField,
  scatterStars,
  AREEB_LOGO_URL,
  mixedText,
  translatePriority,
  translateStatus,
} from "./prdComponents";
import { prdSampleData } from "./prdSampleData";

/* ---------- table column widths ----------
   Page content width (A4, PAGE_PAD 56/56) = 595.28 - 112 = 483.28.
   EditorialTable's row (prdStyles.tableRow) adds paddingHorizontal:10
   (20 total), and each body cell (TableRow in prdComponents.jsx)
   additionally carries paddingRight:8 per column, on top of its
   fixed `width` — so the real budget for the sum of column widths
   is: 483.28 - 20 - (8 * columnCount), minus a ~15pt safety margin.
   Getting this wrong overflows the last column past the right
   margin (yoga doesn't auto-shrink fixed-width flex children). */
const local = StyleSheet.create({
  /* ---------- cover ---------- */
  coverTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverMark: { flexDirection: "row", alignItems: "center", gap: 8 },
  coverLogo: { width: 22, height: 22 },
  coverEyebrow: {
    /* Renders the Latin "AREEB" wordmark only — tracking stays. */
    fontFamily: FONT.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: C.gray500,
  },
  coverEyebrowAr: {
    /* Same slot, Arabic content ("مستند متطلبات المنتج") — no tracking,
       previously shared coverEyebrow's letterSpacing:3 and broke letter
       joining. */
    fontFamily: FONT.mono,
    fontSize: 8,
    color: C.gray500,
  },
  coverTitleWrap: { marginTop: 196 },
  /* Doc-type headline — "مستند متطلبات المنتج" as a real hierarchy step
     (not the tiny top kicker), pure Arabic content so it renders in
     FONT.arabic directly rather than Archivo (which has no Arabic glyphs). */
  coverDocType: {
    fontFamily: FONT.arabic,
    fontWeight: 600,
    fontSize: 15,
    color: C.gray600,
    textAlign: "right",
    marginBottom: 12,
  },
  coverTitle: {
    /* The project name — the single most dominant element on the page. */
    fontFamily: FONT.display,
    fontWeight: 800,
    fontSize: 44,
    color: C.black,
    lineHeight: 1.08,
    maxWidth: 460,
    textAlign: "right",
  },
  coverDescription: {
    fontFamily: FONT.body,
    fontSize: 12,
    color: C.gray600,
    marginTop: 18,
    maxWidth: 380,
    lineHeight: 1.6,
    textAlign: "right",
  },
  /* Explicit divider rule — same motif as prdStyles.sectionDivider —
     separating the dominant title block from the secondary metadata row. */
  coverDivider: {
    height: 1,
    backgroundColor: C.black,
    marginTop: 28,
    width: 46,
    alignSelf: "flex-end",
  },
  coverMetaGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    marginTop: "auto",
    paddingTop: 18,
  },
  coverMetaItem: { width: "25%", marginBottom: 4, alignItems: "flex-end" },
  coverMetaLabel: {
    /* Arabic labels ("رقم المستند", "الإصدار", ...) — no tracking. */
    fontFamily: FONT.mono,
    fontSize: 7,
    color: C.gray500,
    marginBottom: 5,
    textAlign: "right",
  },
  coverMetaValue: {
    fontFamily: FONT.body,
    fontSize: 11,
    fontWeight: 500,
    color: C.black,
    textAlign: "right",
  },

  /* ---------- section body helpers ---------- */
  sectionBody: { flex: 1 },
  blockGap: { marginTop: 6, marginBottom: 6 },
  eyebrowSpaced: { marginBottom: 10 },
  twoCol: { flexDirection: "row-reverse", gap: 28 },
  col: { flex: 1 },

  /* ---------- user story block ---------- */
  storyBlock: { marginBottom: 24 },
  storyLabel: { marginBottom: 8 },
  storyQuote: { marginBottom: 8 },
  storyGloss: {
    /* No italic TTF is embedded for Inter Tight (only regular weights are
       registered in prdFonts.js), and @react-pdf/renderer can't fake an
       oblique style — it throws "Could not resolve font" for fontStyle:
       "italic" against a family with no italic face. Differentiate the
       gloss from the quote with color/tracking instead. */
    fontFamily: FONT.body,
    fontSize: 9,
    color: C.gray500,
    letterSpacing: 0.15,
    marginBottom: 12,
    lineHeight: 1.5,
  },
});

/* ---------- table column configs ---------- */
const frColumns = [
  { key: "id", label: "الرقم", width: 44, mono: true },
  { key: "title", label: "المتطلب", width: 112 },
  { key: "description", label: "الوصف", width: 212 },
  { key: "priority", label: "الأولوية", width: 48, mono: true },
];

const goalsColumns = [
  { key: "value", label: "الهدف", width: 50, mono: true },
  { key: "name", label: "المؤشر", width: 110 },
  { key: "description", label: "الوصف", width: 166 },
  { key: "measurement", label: "طريقة القياس", width: 90, mono: true },
];

const openQColumns = [
  { key: "question", label: "السؤال المفتوح", width: 322 },
  { key: "owner", label: "المسؤول", width: 110, mono: true },
];

const govColumns = [
  { key: "version", label: "الإصدار", width: 46, mono: true },
  { key: "date", label: "التاريخ", width: 62, mono: true },
  { key: "change", label: "التغيير", width: 182 },
  { key: "owner", label: "المسؤول", width: 66 },
  { key: "status", label: "الحالة", width: 52, mono: true },
];

/* ============================================================
   The document
   ============================================================ */
export function PRDDocument({ data = prdSampleData }) {
  registerPRDFonts();

  /* priority/status stay fixed English enum values in the data model itself
     (validated server-side) — translate to Arabic only here, at render time. */
  const frRows = data.functionalRequirements.map((fr) => ({
    id: fr.id,
    ...fr,
    priority: translatePriority(fr.priority),
  }));
  const goalsRows = data.goals.map((g, i) => ({ id: i, ...g }));
  const openQRows = data.openQuestions.map((q, i) => ({ id: i, ...q }));
  const govRows = data.governance.map((g, i) => ({
    id: i,
    ...g,
    status: translateStatus(g.status),
  }));

  return (
    <Document
      title={`${data.meta.prdId} — ${data.meta.projectName}`}
      author="Areeb"
      subject="Product Requirements Document"
      creator="Areeb PRD Generator"
    >
      {/* ---------- COVER ---------- */}
      <Page size="A4" style={prdStyles.coverPage}>
        <View style={local.coverTop}>
          <View style={local.coverMark}>
            <Image src={AREEB_LOGO_URL} style={local.coverLogo} />
            <Text style={local.coverEyebrow}>AREEB</Text>
          </View>
          <Text style={local.coverEyebrowAr}>{mixedText("مستند متطلبات المنتج")}</Text>
        </View>

        <StarField
          stars={scatterStars(11, 26, 320, 170)}
          width={320}
          height={170}
          style={{ position: "absolute", top: 130, right: 40 }}
        />

        <View style={local.coverTitleWrap}>
          <Text style={local.coverDocType}>مستند متطلبات المنتج</Text>
          {/* meta.projectName mixes scripts ("Areeb — أريب") — coverTitle is
              set in Archivo (Latin-only), so route through mixedText or the
              Arabic word renders as garbage glyphs instead of "أريب". */}
          <Text style={local.coverTitle}>{mixedText(data.meta.projectName)}</Text>
          <Text style={local.coverDescription}>{mixedText(data.meta.shortDescription)}</Text>
          <View style={local.coverDivider} />
        </View>

        <View style={local.coverMetaGrid}>
          <View style={local.coverMetaItem}>
            <Text style={local.coverMetaLabel}>{mixedText("رقم المستند")}</Text>
            <Text style={local.coverMetaValue}>{data.meta.prdId}</Text>
          </View>
          <View style={local.coverMetaItem}>
            <Text style={local.coverMetaLabel}>{mixedText("الإصدار")}</Text>
            <Text style={local.coverMetaValue}>{data.meta.version}</Text>
          </View>
          <View style={local.coverMetaItem}>
            <Text style={local.coverMetaLabel}>{mixedText("الحالة")}</Text>
            <Text style={local.coverMetaValue}>{mixedText(translateStatus(data.meta.status))}</Text>
          </View>
          <View style={local.coverMetaItem}>
            <Text style={local.coverMetaLabel}>{mixedText("التاريخ")}</Text>
            <Text style={local.coverMetaValue}>{data.meta.date}</Text>
          </View>
        </View>
      </Page>

      {/* ---------- 01 · EXECUTIVE SUMMARY ---------- */}
      <Page size="A4" style={prdStyles.page}>
        <PageChrome />
        <SectionHeading
          number="01"
          title="الملخص التنفيذي"
          description={data.executiveSummary.description}
          stars={scatterStars(2, 9, 160, 50)}
        />
        <View style={local.sectionBody}>
          <LabeledBlock label="المشكلة">{data.executiveSummary.problem}</LabeledBlock>
          <LabeledBlock label="الفرصة">{data.executiveSummary.opportunity}</LabeledBlock>
          <LabeledBlock label="الحل">{data.executiveSummary.solution}</LabeledBlock>
          <LabeledBlock label="النتيجة">{data.executiveSummary.outcome}</LabeledBlock>
          <View style={local.blockGap}>
            <Text style={[prdStyles.eyebrowDark, local.eyebrowSpaced]}>{mixedText("أبرز الرؤى")}</Text>
            <NumberedList items={data.executiveSummary.keyInsights} />
          </View>
        </View>
      </Page>

      {/* ---------- 02 · PROBLEM ANALYSIS ---------- */}
      <Page size="A4" style={prdStyles.page}>
        <PageChrome />
        <SectionHeading
          number="02"
          title="تحليل المشكلة"
          description="الوضع الحالي، الاحتكاك الكامن فيه، السبب الجذري وراءه، والوضع المنشود الذي نتجه إليه."
          stars={scatterStars(5, 9, 160, 50)}
        />
        <View style={local.sectionBody}>
          <LabeledBlock label="الوضع الحالي">{data.problemAnalysis.currentState}</LabeledBlock>
          <LabeledBlock label="نقاط الاحتكاك">{data.problemAnalysis.friction}</LabeledBlock>
          <LabeledBlock label="السبب الجذري">{data.problemAnalysis.rootCause}</LabeledBlock>
          <LabeledBlock label="الفرصة">{data.problemAnalysis.opportunity}</LabeledBlock>
          <LabeledBlock label="الوضع المنشود">{data.problemAnalysis.desiredState}</LabeledBlock>
        </View>
      </Page>

      {/* ---------- 03 · GOALS & SUCCESS METRICS ---------- */}
      <Page size="A4" style={prdStyles.page}>
        <PageChrome />
        <SectionHeading
          number="03"
          title="الأهداف ومؤشرات النجاح"
          description="شكل النجاح، بالأرقام — كل هدف مقترن بطريقة قياسه فعليًا."
          stars={scatterStars(8, 9, 160, 50)}
        />
        <EditorialTable columns={goalsColumns} rows={goalsRows} />
      </Page>

      {/* ---------- 04 · FUNCTIONAL REQUIREMENTS ---------- */}
      <Page size="A4" style={prdStyles.page}>
        <PageChrome />
        <SectionHeading
          number="04"
          title="المتطلبات الوظيفية"
          description="كل متطلب، مرتّب بحسب أولوية MoSCoW — إلزامي، مفضّل، اختياري."
          stars={scatterStars(13, 9, 160, 50)}
        />
        <EditorialTable columns={frColumns} rows={frRows} />
      </Page>

      {/* ---------- 05 · USER STORIES ---------- */}
      <Page size="A4" style={prdStyles.page}>
        <PageChrome />
        <SectionHeading
          number="05"
          title="قصص المستخدم"
          description="بكلمات المؤسس نفسه — باللهجة الحجازية السعودية التي صُمم أريب لفهمها فعليًا — مع معايير القبول الخاصة بكل قصة."
          stars={scatterStars(17, 9, 160, 50)}
        />
        <View>
          {data.userStories.map((s) => (
            <View key={s.number} style={local.storyBlock} wrap={false}>
              <Text style={[prdStyles.eyebrowDark, local.storyLabel]}>{mixedText(`قصة المستخدم ${s.number}`)}</Text>
              <Text style={[prdStyles.arabicParagraph, local.storyQuote]}>{s.quote}</Text>
              <Text style={local.storyGloss}>{s.gloss}</Text>
              <Text style={[prdStyles.eyebrow, local.eyebrowSpaced]}>{mixedText("معايير القبول")}</Text>
              <DashList items={s.acceptance} />
            </View>
          ))}
        </View>
      </Page>

      {/* ---------- 06 · SCOPE ---------- */}
      <Page size="A4" style={prdStyles.page}>
        <PageChrome />
        <SectionHeading
          number="06"
          title="نطاق العمل"
          description="ما يغطيه الإصدار 1.0، وبنفس القدر من التعمّد، ما لا يغطيه."
          stars={scatterStars(21, 9, 160, 50)}
        />
        <View style={local.twoCol}>
          <View style={local.col}>
            <Text style={[prdStyles.eyebrowDark, local.eyebrowSpaced]}>{mixedText("ضمن النطاق")}</Text>
            <DashList items={data.scope.inScope} />
          </View>
          <View style={local.col}>
            <Text style={[prdStyles.eyebrowDark, local.eyebrowSpaced]}>{mixedText("خارج النطاق")}</Text>
            <DashList items={data.scope.outOfScope} />
          </View>
        </View>
      </Page>

      {/* ---------- 07 · ASSUMPTIONS / OPEN QUESTIONS / GOVERNANCE ---------- */}
      <Page size="A4" style={prdStyles.page}>
        <PageChrome />
        <SectionHeading
          number="07"
          title="الافتراضات والأسئلة المفتوحة والحوكمة"
          description="ما نأخذه كمُسلّمات، وما لا يزال دون حل، وسجل الإصدارات وراء هذا المستند."
          stars={scatterStars(29, 9, 160, 50)}
        />
        <View style={local.blockGap}>
          <Text style={[prdStyles.eyebrowDark, local.eyebrowSpaced]}>{mixedText("الافتراضات")}</Text>
          <NumberedList items={data.assumptions} />
        </View>
        <View style={[local.blockGap, { marginTop: 18 }]}>
          <Text style={[prdStyles.eyebrowDark, local.eyebrowSpaced]}>{mixedText("الأسئلة المفتوحة")}</Text>
          <EditorialTable columns={openQColumns} rows={openQRows} />
        </View>
        <View style={[local.blockGap, { marginTop: 18 }]}>
          <Text style={[prdStyles.eyebrowDark, local.eyebrowSpaced]}>{mixedText("الحوكمة وسجل الإصدارات")}</Text>
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
