// Lightweight Markdown export of a generated PRD — the OPTIONAL "if time
// permits" add mentioned alongside the PDF export (DOCX export is fully
// deferred; no working DOCX code exists anywhere in this project, and a
// half-working one would be worse than skipping it). This walks the raw
// POST /api/prd response (not the PDF-mapped shape) and emits plain
// `##`-style Markdown headers — no external Markdown library needed for
// something this structurally simple.

function heading(level, text) {
  return `${'#'.repeat(level)} ${text}`
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n')
}

export function buildPrdMarkdown(prd) {
  const metadata = prd?.metadata || {}
  const sections = prd?.sections || {}
  const requirements = Array.isArray(prd?.requirements) ? prd.requirements : []
  const userStories = Array.isArray(prd?.user_stories) ? prd.user_stories : []
  const acceptanceCriteria = Array.isArray(prd?.acceptance_criteria) ? prd.acceptance_criteria : []
  const risks = Array.isArray(prd?.risks) ? prd.risks : []
  const assumptions = Array.isArray(prd?.assumptions) ? prd.assumptions : []

  const lines = []

  lines.push(heading(1, metadata.project_name || 'مشروع بدون اسم'))
  lines.push(`الإصدار: ${metadata.version || 'v1.0'} — تاريخ التوليد: ${metadata.generated_at || ''}`)
  lines.push('')

  if (sections.executive_summary) {
    lines.push(heading(2, 'الملخص التنفيذي'))
    lines.push(sections.executive_summary)
    lines.push('')
  }
  if (sections.problem) {
    lines.push(heading(2, 'المشكلة'))
    lines.push(sections.problem)
    lines.push('')
  }
  if (sections.vision) {
    lines.push(heading(2, 'الرؤية'))
    lines.push(sections.vision)
    lines.push('')
  }
  if (sections.goals) {
    lines.push(heading(2, 'الأهداف'))
    lines.push(sections.goals)
    lines.push('')
  }

  if (requirements.length) {
    lines.push(heading(2, 'المتطلبات'))
    for (const requirement of requirements) {
      lines.push(heading(3, `${requirement.req_key || ''} — ${requirement.title || ''}`.trim()))
      if (requirement.description) lines.push(requirement.description)
      if (requirement.priority) lines.push(`_الأولوية: ${requirement.priority}_`)
      lines.push('')
    }
  }

  if (userStories.length) {
    lines.push(heading(2, 'قصص المستخدم'))
    for (const story of userStories) {
      lines.push(heading(3, story.id || ''))
      lines.push(`كـ ${story.as_a || ''}، أبي ${story.i_want || ''}${story.so_that ? ` عشان ${story.so_that}` : ''}.`)
      const criteria = acceptanceCriteria.filter((criterion) => criterion.requirement_ref === story.requirement_ref).map((criterion) => criterion.criteria)
      if (criteria.length) {
        lines.push('معايير القبول:')
        lines.push(bulletList(criteria))
      }
      lines.push('')
    }
  }

  if (risks.length) {
    lines.push(heading(2, 'المخاطر'))
    lines.push(bulletList(risks.map((risk) => `${risk.title || ''} — ${risk.description || ''}`.trim())))
    lines.push('')
  }

  if (assumptions.length) {
    lines.push(heading(2, 'الافتراضات'))
    lines.push(bulletList(assumptions.map((assumption) => `${assumption.title || ''} — ${assumption.description || ''}`.trim())))
    lines.push('')
  }

  return lines.join('\n')
}

/** Triggers a plain-text file download via a temporary object URL — same click-a-hidden-link pattern as prdPdf.jsx's triggerPRDDownload, just for text/markdown instead of a PDF blob. */
export function triggerTextDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
