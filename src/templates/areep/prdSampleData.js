/* ============================================================
   Sample PRDData — Areeb, dogfooding itself.

   There is no live backend / analysis engine behind the
   "Generate PRD" button (by design — no API key is ever exposed
   client-side). So this is NOT a claim that the document reflects
   whatever a visitor typed into the chat. It's a genuine, specific
   PRD describing Areeb (the product) as written by its own team —
   informed by the real SYSTEM_PROMPT persona and hero copy in
   AreebLanding.jsx. It exists to demonstrate the page-per-section
   PDF system with real, coherent content, and to stay a clean,
   swappable shape (`PRDData`) for whenever a real analysis engine
   exists to populate it per-visitor instead.
   ============================================================ */

export const prdSampleData = {
  meta: {
    projectName: "Areeb — أريب",
    shortDescription:
      "An Arabic-first AI product-discovery assistant that interviews founders in their own dialect and turns a loose idea into a structured requirements brief.",
    prdId: "PRD-2026-001",
    version: "v1.0",
    status: "Draft",
    date: "August 20, 2026",
  },

  executiveSummary: {
    description:
      "Why Areeb exists, in one page: the gap it closes, and the shape of the fix.",
    problem:
      "Early-stage founders and product teams working in Arabic have ideas but no structured way to turn them into requirements. Generic AI assistants are English-first in training and tone — even when they reply in Arabic, the phrasing reads translated, and they jump straight to solutions instead of asking the questions a real business analyst would ask first.",
    opportunity:
      "A narrow, conversational assistant that behaves like an embedded business analyst — not a chatbot — can meet Arabic-speaking founders where they actually think, in a dialect that reads like a person, not a translation layer.",
    solution:
      "Areeb: an AI assistant with a defined persona (Hejazi-Saudi dialect, warm-but-professional tone, a codified Problem -> User -> Process -> Solution discovery method) that asks one or two sharp questions at a time, refuses to jump to solutions early, and converts the conversation into a structured document — this PRD format included.",
    outcome:
      "A founder leaves a conversation with clarity, not just momentum: a named problem, a named user, a named scenario, and a first pass at functional requirements — ready to hand to a designer, an engineer, or an investor.",
    keyInsights: [
      "Dialect authenticity is a trust signal, not a nice-to-have — Hejazi-Saudi phrasing reads as \"someone who gets it,\" where standard-Arabic MSA output reads as translated software.",
      "The discovery order matters more than the discovery content — asking Problem -> User -> Process -> Solution, strictly in that order, is what separates Areeb from a general-purpose chatbot.",
      "One or two questions per turn outperforms a long intake form — founders answer a short conversational question; they abandon a checklist.",
      "The safest architecture is also the most honest one: no client-exposed API key, no live model call from the browser — every reply in this demo is intentionally simulated, and the product says so.",
    ],
  },

  problemAnalysis: {
    currentState:
      "An idea-stage founder opens a general AI chat tool, types their idea in Arabic or half-English, and gets either generic startup advice or a wall of unstructured text back.",
    friction:
      "Nothing in that exchange forces the founder to define who the user is, what the current broken scenario looks like, or what the edge cases are. The output feels like advice, not a document — there's nothing to hand to the next person.",
    rootCause:
      "Most AI product tools are English-first by training and by tone, and none of them carry a codified discovery methodology. Even the Arabic-capable ones default to Modern Standard Arabic phrasing that reads as translated rather than spoken — which quietly breaks trust with a business audience that speaks a specific dialect at work.",
    opportunity:
      "A tightly scoped assistant — one persona, one dialect, one discovery method, one output shape — can go deep instead of wide, and specifically close the gap between \"idea in someone's head\" and \"structured requirements document.\"",
    desiredState:
      "A founder opens Areeb, describes their idea in a sentence, in their own dialect. Within a short, guided conversation, Areeb has surfaced the real problem, the real user, and the real scenario — and can hand back a structured summary, or a full PRD, built from that conversation.",
  },

  goals: [
    {
      value: "70%+",
      name: "Conversations that reach a structured summary",
      description:
        "Share of started conversations where Areeb produces a Problem / User / Scenario / Requirements summary before the visitor leaves.",
      measurement: "Session funnel: message sent, then summary block rendered.",
    },
    {
      value: "1–2",
      name: "Questions per turn",
      description:
        "Areeb asks at most one or two clarifying questions per reply — enforced by the system prompt's discovery rules, never a long intake form.",
      measurement: "Manual + automated review of reply structure against the persona spec.",
    },
    {
      value: "3–5",
      name: "Turns to first structured output",
      description:
        "Typical number of back-and-forth exchanges before the user has a named problem and user, ready to move into requirements.",
      measurement: "Median turn count across sample conversations at launch.",
    },
    {
      value: "100%",
      name: "Arabic-first interactions",
      description:
        "No forced English at any step — dialect (Hejazi-Saudi default), tone, and terminology stay in Arabic throughout the discovery flow.",
      measurement: "Persona/tone spot-check against SYSTEM_PROMPT on every model or prompt change.",
    },
  ],

  functionalRequirements: [
    {
      id: "FR-01",
      title: "Persona-locked system prompt",
      description:
        "Every reply is generated under a fixed persona definition — Hejazi-Saudi dialect, 70/20/10 professional-friendly-casual tone split, short sentences, headings and bullets only where useful.",
      priority: "Must",
    },
    {
      id: "FR-02",
      title: "Problem -> User -> Process -> Solution ordering",
      description:
        "Areeb must not propose solutions before the problem, the user, and the process are established. This ordering is enforced in the prompt, not left to model discretion.",
      priority: "Must",
    },
    {
      id: "FR-03",
      title: "One-or-two-question turns",
      description:
        "Each reply surfaces at most two clarifying questions, keeping the exchange conversational instead of form-like.",
      priority: "Must",
    },
    {
      id: "FR-04",
      title: "Soft-correction phrasing",
      description:
        "When redirecting a user's assumption, Areeb never says \"that's wrong\" — it uses phrasing like \"ممكن نعيد التفكير فيها بالطريقة هذي...\" to keep the tone collaborative.",
      priority: "Must",
    },
    {
      id: "FR-05",
      title: "Structured requirements summary",
      description:
        "On request, Areeb compiles the conversation into: Goal, Users, Scenario, Functional Requirements, Edge Cases, Risks, Suggestions — in that fixed order.",
      priority: "Must",
    },
    {
      id: "FR-06",
      title: "Client-side PRD generation",
      description:
        "A \"Generate PRD\" action produces a real, downloadable PDF laid out one major section per page, entirely in the browser — no server round-trip, no exposed credentials.",
      priority: "Must",
    },
    {
      id: "FR-07",
      title: "No live model call from the browser",
      description:
        "No API key is ever shipped to the client. The public demo simulates replies locally; a real backend proxy is a prerequisite for live model calls, not a workaround.",
      priority: "Must",
    },
    {
      id: "FR-08",
      title: "Scripted first-touch demo",
      description:
        "A short, autoplaying scripted exchange near the top of the page shows a visitor what a real Areeb exchange feels like before they type anything themselves.",
      priority: "Should",
    },
    {
      id: "FR-09",
      title: "Visual thinking-state indicator",
      description:
        "A particle-based indicator reflects Areeb's current state — idle, listening, thinking, processing, answering, complete — so the wait never feels silent.",
      priority: "Should",
    },
    {
      id: "FR-10",
      title: "Session-scoped memory only",
      description:
        "Areeb remembers the current conversation only; nothing persists across sessions or is stored server-side in this demo.",
      priority: "Must",
    },
    {
      id: "FR-11",
      title: "Markdown-lite reply rendering",
      description:
        "Replies support headings, bold text, and bullet lists rendered as real HTML elements, not raw markdown characters, inside the chat bubble.",
      priority: "Should",
    },
    {
      id: "FR-12",
      title: "RTL-native input and layout",
      description:
        "The entire interaction surface — input field, message bubbles, scroll direction — is right-to-left native, not a mirrored left-to-right layout.",
      priority: "Must",
    },
    {
      id: "FR-13",
      title: "Graceful degradation without motion",
      description:
        "Every animated or particle-based element respects prefers-reduced-motion and still communicates state through static text when motion is disabled.",
      priority: "Should",
    },
    {
      id: "FR-14",
      title: "Reusable, swappable PRD data shape",
      description:
        "The PDF generator accepts a plain PRDData object rather than assuming a live analysis source, so a real backend can populate it later without touching the rendering layer.",
      priority: "Must",
    },
    {
      id: "FR-15",
      title: "Editorial, non-templated document design",
      description:
        "The generated PRD reads as a deliberately designed strategy artifact — giant section numbers, restrained rules, generous whitespace — not a generic corporate export.",
      priority: "Could",
    },
  ],

  userStories: [
    {
      number: "01",
      quote:
        "كفاتح مشروع، أبي أقعد أشرح فكرتي بلهجتي العادية، وأطلع من الحوار بمستند متطلبات واضح — مو بس كلام عام ونصايح.",
      gloss:
        "As a founder, I want to explain my idea in my own everyday dialect and walk away with a clear requirements document — not just general talk and advice.",
      acceptance: [
        "The assistant responds in Hejazi-Saudi dialect by default, not Modern Standard Arabic.",
        "The conversation surfaces a named problem and a named primary user within the first few turns.",
        "A structured summary is available on request, in a fixed Goal / Users / Scenario / Requirements order.",
      ],
    },
    {
      number: "02",
      quote:
        "ما أبي المساعد يقفز للحل من أول رسالة. أبي يسألني عن المشكلة والمستخدم قبل لا يقترح أي شي.",
      gloss:
        "I don't want the assistant to jump to a solution from the first message. I want it to ask about the problem and the user before suggesting anything.",
      acceptance: [
        "No solution is proposed before the problem and the target user have been established in the conversation.",
        "Each reply asks at most one or two clarifying questions, never a long list.",
        "Discovery visibly follows Problem -> User -> Process -> Solution order.",
      ],
    },
    {
      number: "03",
      quote:
        "أبي ألمس شكل التجربة قبل لا أكتب أي شي — عشان أثق إن فيه شخص فاهم اللي أبيه.",
      gloss:
        "I want to feel the shape of the experience before typing anything — so I trust that whatever's on the other end actually understands what I want.",
      acceptance: [
        "A short scripted exchange plays automatically the first time the demo section scrolls into view.",
        "The scripted exchange uses the same dialect and tone as the live chat, not a generic placeholder.",
        "The visual thinking-state indicator runs through listening -> thinking -> answering during the scripted demo.",
      ],
    },
    {
      number: "04",
      quote:
        "بعد ما أخلص الحوار، أبي أقدر أحمّل مستند رسمي — مو أنسخ الكلام يدوي.",
      gloss:
        "After I finish the conversation, I want to be able to download a formal document — not manually copy the text out myself.",
      acceptance: [
        "A visible \"Generate PRD\" action produces a real PDF download with no page reload.",
        "The PDF lays out one major section per physical page, with continuation pages repeating the table header when a section overflows.",
        "The download works entirely client-side and completes without any network request to a model API.",
      ],
    },
  ],

  scope: {
    inScope: [
      "Arabic-first (Hejazi-Saudi default) conversational discovery persona, defined by a single system prompt.",
      "Problem -> User -> Process -> Solution discovery methodology, enforced in prompt structure.",
      "Scripted first-touch demo exchange, played once per visit.",
      "Fully functional simulated chat UI — real input, real message history, simulated replies.",
      "Client-side \"Generate PRD\" PDF export, one major section per page, editorial black/white/gray design system.",
      "Reusable PRDData input shape, ready for a future real analysis backend.",
      "Particle-based visual state system reflecting the assistant's thinking state.",
    ],
    outOfScope: [
      "Any live call to a language model API from the browser or from this demo's infrastructure.",
      "Server-side storage of conversations, user accounts, or authentication.",
      "Multi-language support beyond Arabic (default) — no English-first mode is planned for this persona.",
      "A real per-visitor analysis engine feeding the PRD generator — the current PRD content is a fixed, honest dogfood sample, not live inference.",
      "Team collaboration features (comments, shared documents, multi-user editing) on the generated PRD.",
      "Export formats other than PDF (no live Word/Notion/Confluence sync in this phase).",
    ],
  },

  assumptions: [
    "Visitors evaluating this demo are comfortable reading Hejazi-Saudi dialect, or are evaluating the concept rather than the dialect specifically.",
    "A future production version will route model calls through a server-side proxy — no assumption is made that a client-exposed key is ever acceptable.",
    "The sample PRD content (this document) is understood as a dogfood example describing Areeb itself, not a claim of live per-visitor analysis.",
    "The existing Three.js-based motion system remains the project's only animation dependency going forward; no new animation library is assumed available.",
    "Font files embedded in the generated PDF (Archivo, Inter Tight, JetBrains Mono, IBM Plex Sans Arabic) may be redistributed under their respective open licenses.",
  ],

  openQuestions: [
    { question: "Should a production PRD generator call a real backend analysis endpoint, and if so, what data leaves the browser?", owner: "Product" },
    { question: "Does the discovery methodology need dialect variants beyond Hejazi-Saudi (e.g. Egyptian, Levantine) for a broader launch?", owner: "Product" },
    { question: "Should generated PRDs be optionally emailed or only downloaded locally?", owner: "Engineering" },
    { question: "What is the retention policy, if any, once conversations are no longer purely client-side?", owner: "Engineering / Legal" },
    { question: "Should the PRD's sample-data disclosure be visible inside the document itself, or only in product messaging around the button?", owner: "Design" },
  ],

  governance: [
    { version: "v0.1", date: "2026-07-02", change: "Initial persona and system prompt drafted.", owner: "Product", status: "Superseded" },
    { version: "v0.4", date: "2026-07-21", change: "Hero scroll story and scripted demo defined.", owner: "Design", status: "Superseded" },
    { version: "v0.7", date: "2026-08-05", change: "Real chat UI and simulated-reply architecture finalized.", owner: "Engineering", status: "Superseded" },
    { version: "v0.9", date: "2026-08-14", change: "Security decision: no client-exposed API key, ever.", owner: "Engineering", status: "Superseded" },
    { version: "v1.0", date: "2026-08-20", change: "Generate PRD feature specified and documented — this document.", owner: "Product", status: "Draft" },
  ],
};
