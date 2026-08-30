import { useInView } from '../../hooks/useInView'
import { kashida } from '../../lib/kashida'

/* ============================================================
   Capabilities as editorial rows, not a card grid.

   Each row is a claim on one side and the evidence for it on the other —
   an actual fragment of product output rather than an icon. Every number
   and label here is real: the seven requirement types and their id
   prefixes come from the discovery prompt, the MoSCoW values from the
   database's own check constraint, and the fallback behaviour from how
   the server chain is actually wired.
   ============================================================ */

const ROWS = [
  {
    k: 'الاكتشاف',
    title: 'يسأل عن اللي فاتك.',
    body: 'إذا فيه معلومة مهمة ناقصة، ما يفترضها من عنده — يسألك عنها. ويمشي بالترتيب: المشكلة، بعدين المستخدم، بعدين السيناريو. وما يقترح حل قبل ما يفهم.',
    proof: {
      kind: 'lines',
      label: 'لسه ناقص',
      items: ['مين الفئة بالضبط', 'كم الاستخدام المتوقّع', 'وين يوصل التواصل'],
    },
  },
  {
    k: 'الترتيب',
    title: 'يرتّب الكلام.',
    body: 'اللي تقوله يتحوّل لأهداف، مستخدمين، ميزات ومتطلبات — سبعة أنواع، وكل واحد له معرّف واضح ما يتغيّر طول الجلسة.',
    proof: {
      kind: 'chips',
      label: 'أنواع المتطلبات',
      items: ['GOAL', 'USER', 'FEAT', 'FR', 'NFR', 'RISK', 'ASM'],
    },
  },
  {
    k: 'المراجعة',
    title: `أنت اللي ${kashida('تعتمد')}.`,
    body: 'قبل ما تطلع الوثيقة، تشوف كل شي. عدّل، احذف، أضف متطلب فات أريب، أو غيّر الأولوية. ما فيه شي يدخل الوثيقة قبل ما تشوفه.',
    proof: {
      kind: 'moscow',
      label: 'الأولويات',
      items: ['إلزامي', 'مفضّل', 'اختياري', 'مؤجل'],
    },
  },
  {
    k: 'الاستمرارية',
    title: 'ما يوقف إذا تعثّر مزوّد.',
    body: 'عنده مسار بديل ياخذ مكان الأساسي تلقائيًا إذا صارت مشكلة، عشان الجلسة ما تتعطّل. وقبل ما يوصلك أي رد، يتأكد إنه جاي بالشكل الصحيح.',
    proof: {
      kind: 'chain',
      label: 'المسار والبديل',
      items: [
        ['المحادثة', 'Gemini', 'Groq'],
        ['الوثيقة', 'Groq', 'Gemini'],
      ],
    },
  },
]

function Proof({ proof }) {
  if (proof.kind === 'chips') {
    return (
      <div className="lp-proof">
        <span className="lp-label">{proof.label}</span>
        <div className="lp-proof-chips">
          {proof.items.map((item) => (
            <span key={item} className="lp-num lp-proof-chip">
              {item}
            </span>
          ))}
        </div>
      </div>
    )
  }
  if (proof.kind === 'moscow') {
    return (
      <div className="lp-proof">
        <span className="lp-label">{proof.label}</span>
        <div className="lp-proof-chips">
          {proof.items.map((item, i) => (
            <span key={item} className={`lp-proof-pill${i === 0 ? ' is-solid' : ''}`}>
              {item}
            </span>
          ))}
        </div>
      </div>
    )
  }
  if (proof.kind === 'chain') {
    return (
      <div className="lp-proof">
        <span className="lp-label">{proof.label}</span>
        <div className="lp-proof-chains">
          {proof.items.map(([what, primary, fallback]) => (
            <span key={what} className="lp-chain">
              <span className="lp-chain-what">{what}</span>
              <span className="lp-num">{primary}</span>
              <span className="lp-chain-arrow" aria-hidden="true">
                ←
              </span>
              <span className="lp-num lp-chain-fb">{fallback}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="lp-proof">
      <span className="lp-label">{proof.label}</span>
      <ul className="lp-proof-lines">
        {proof.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function Row({ row, index }) {
  const [ref, inView] = useInView({ threshold: 0.25 })
  return (
    <article ref={ref} className={`lp-cap${inView ? ' is-in' : ''}`} style={{ '--i': index }}>
      <div className="lp-cap-copy">
        <span className="lp-cap-k">{row.k}</span>
        <h3 className="lp-cap-title">{row.title}</h3>
        <p className="lp-cap-body">{row.body}</p>
      </div>
      <Proof proof={row.proof} />
    </article>
  )
}

export function Capabilities() {
  return (
    <section className="lp-caps" id="capabilities" aria-labelledby="caps-heading">
      <div className="lp-shell">
        <p className="lp-eyebrow">المزايا</p>
        <h2 id="caps-heading" className="lp-h2">
          أربع أشياء
          <span className="lp-h2-dim"> تفرّقه عن محادثة عادية.</span>
        </h2>
        <div className="lp-cap-rows">
          {ROWS.map((row, i) => (
            <Row key={row.k} row={row} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
