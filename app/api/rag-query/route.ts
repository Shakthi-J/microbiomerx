import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Words that signal the doctor wants page-specific answers
const PAGE_TRIGGER_WORDS = [
  'this page', 'the page', 'look at', 'what does this', 'what about this',
  'tell me about this', 'this section', 'these numbers', 'these values',
  'this score', 'this patient', 'what it tells', 'interpret', 'explain this',
  'what does it mean', 'is this', 'are these', 'this data', 'properly',
  'what can you see', 'read this', 'analyse this', 'analyze this',
]

function isPageQuery(text: string): boolean {
  const lower = text.toLowerCase()
  return PAGE_TRIGGER_WORDS.some(t => lower.includes(t))
}

async function searchKnowledge(query: string) {
  try {
    const keyword = query.split(' ').slice(0, 3).join('%')
    const url = `${SUPABASE_URL}/rest/v1/knowledge_chunks?content=ilike.*${keyword}*&select=source_file,content&limit=5`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function getReportContext(reportId: string) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}&select=patient_name,patient_age_sex,report_data&limit=1`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch { return null }
}

function buildPageDataContext(pageCtx: any): string {
  if (!pageCtx?.data) return ''

  const lines: string[] = [
    `=== CURRENT PAGE: ${pageCtx.label} ===`,
    `Section: ${pageCtx.section}`,
    pageCtx.patientName ? `Patient: ${pageCtx.patientName}` : '',
    '',
    'PAGE DATA:',
  ].filter(Boolean)

  function flatten(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue
      const label = prefix ? `${prefix}.${key}` : key

      if (Array.isArray(value)) {
        lines.push(`${label} (${value.length} items):`)
        value.slice(0, 30).forEach((item: any) => {
          if (typeof item === 'object' && item !== null) {
            lines.push(`  - ${JSON.stringify(item)}`)
          } else {
            lines.push(`  - ${item}`)
          }
        })
        if (value.length > 30) lines.push(`  … and ${value.length - 30} more`)
      } else if (typeof value === 'object') {
        flatten(value as Record<string, unknown>, label)
      } else {
        lines.push(`${label}: ${value}`)
      }
    }
  }

  flatten(pageCtx.data)
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { messages, report_id, active_section, page_context } = await req.json()

    const lastUserMessage = [...messages]
      .reverse()
      .find((m: any) => m.role === 'user')?.content ?? ''

    const pageTriggered = isPageQuery(lastUserMessage)

    // Only hit the knowledge base if NOT a direct page question
    // (avoids irrelevant RAG chunks diluting page-specific answers)
    const [chunks, report] = await Promise.all([
      pageTriggered ? Promise.resolve([]) : searchKnowledge(lastUserMessage),
      report_id ? getReportContext(report_id) : Promise.resolve(null),
    ])

    const knowledgeContext = chunks.length > 0
      ? chunks.map((c: any, i: number) => `[Source ${i + 1}: ${c.source_file}]\n${c.content}`).join('\n\n---\n\n')
      : ''

    const reportContext = report
      ? `Patient: ${report.patient_name}, ${report.patient_age_sex ?? ''}
Full report data: ${JSON.stringify(report.report_data, null, 2)}`
      : ''

    const pageDataContext = page_context ? buildPageDataContext(page_context) : ''

    // ── Build the system prompt ────────────────────────────────────────────
    // When page data is present, it becomes the PRIMARY source. The assistant
    // is instructed to answer directly from it and not to ask for more data.
    const systemPrompt = `You are a clinical microbiome specialist assistant for MicrobiomeRx, helping doctors interpret gut microbiome reports.
Be concise, precise, and clinically actionable.
${active_section ? `The doctor is currently viewing the "${active_section}" section of a patient's gut microbiome report.` : ''}

${pageDataContext
  ? `IMPORTANT: You have FULL access to the data on the doctor's current page. When the doctor asks about "this page", "these values", "what does this show", or anything that references what they're looking at — answer DIRECTLY using the PAGE DATA below. Do NOT say you cannot see the page. Do NOT ask for more information. Use the data provided.

${pageDataContext}`
  : `NOTE: No page data has been registered for this section yet. Tell the doctor: "This section hasn't been connected to the assistant yet. Please add PageContextRegistrar to this page."`
}

${reportContext ? `\nFULL REPORT (for additional context):\n${reportContext}` : ''}
${knowledgeContext ? `\nKNOWLEDGE BASE:\n${knowledgeContext}` : ''}`

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    return NextResponse.json({
      reply: response.choices[0].message.content
    })

  } catch (err: any) {
    console.error('[clinical-assistant]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
