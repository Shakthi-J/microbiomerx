// app/api/filter-supplements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { supplements, messages, mode } = await req.json()

    const suppList = (supplements as any[])
      .map((s: any, i: number) => {
        const name = s.aicProduct || s.label || ''
        const detail = s.detail || ''
        const rationale = s.rationale || ''
        const phase = s.phase || ''
        const category = s.category || ''
        return `${i+1}. ${name} [${phase}]${category ? ` (${category})` : ''}${detail ? ` — ${detail}` : ''}${rationale ? ` | ${rationale}` : ''}`
      })
      .join('\n')

      const conversationHistory = (messages as any[])
      .map((m: any) => ({
        role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.text as string,
      }))

    if (mode === 'start') {
      // AI opens the conversation by studying supplements and asking first question
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 400,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are a clinical pharmacist helping a doctor personalise a supplement prescription.
You have studied the full supplement list for this patient. Your job is to ask the doctor short, specific clinical questions one at a time to understand the patient better, then use those answers to filter the list.

SUPPLEMENT LIST YOU HAVE STUDIED:
${suppList}

Start by briefly noting what you see (e.g. "I can see ${supplements.length} supplements across phases — some overlap in function") then ask your FIRST most important clinical question. 
Ask only ONE question at a time. Keep it short and conversational.
Examples of good questions:
- "Does the patient have any known allergies or intolerances to any of these?"
- "Is the patient currently on any medications that might interact?"
- "What is the primary complaint you want to address first?"
- "How many supplements is the patient realistically able to take daily?"
- "Is the patient vegetarian or vegan? Some products contain Ox Bile."`,
          },
          {
            role: 'user',
            content: `I have ${supplements.length} supplements loaded. Please study them and start the conversation.`,
          },
        ],
      })
      return NextResponse.json({
        type: 'message',
        text: completion.choices[0]?.message?.content || 'Hello! Let me study your supplement list and help you filter it.',
      })
    }

    if (mode === 'chat') {
      // Ongoing conversation — AI either asks another question or produces final filter
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 600,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are a clinical pharmacist helping a doctor personalise a supplement prescription through conversation.

SUPPLEMENT LIST:
${suppList}

RULES:
- Ask ONE focused clinical question at a time
- If the doctor gives you enough information (allergies, conditions, medications, count limit, diet), produce the FINAL FILTER
- To produce the final filter, say exactly "READY TO FILTER" on its own line, then list your recommendations
- Keep questions short and conversational
- Reference specific supplements by name when relevant
- If doctor mentions an allergy or medication, immediately acknowledge and ask if there are others
- Common follow-ups: current medications, budget/count limit, vegan/vegetarian, which condition is most urgent, previous supplement history

When you have enough information (usually 3-5 exchanges), say:
"I have enough information now. READY TO FILTER"

If the conversation already contains a previous READY TO FILTER section and the doctor asks to change something (e.g. "also remove X", "add Y back", "I forgot to mention allergy to Z"), immediately produce an updated filter with "READY TO FILTER" — do not ask more questions.
Then on the next lines, for each supplement write:
KEEP: [name] — [one sentence why]
REMOVE: [name] — [one sentence why]
OPTIONAL: [name] — [one sentence why]

IMPORTANT: If the conversation already contains a previous READY TO FILTER section and the doctor asks to change something (e.g. "also remove X", "add Y back", "I forgot to mention allergy to Z", "only keep essential"), immediately produce an updated filter — do not ask more questions. Just say "Updated based on your request. READY TO FILTER" and list all supplements again with the change applied.`,

          },
          ...conversationHistory,
        ],
      })

      const text = completion.choices[0]?.message?.content || ''

      // Check if AI is ready to produce results
      if (text.includes('READY TO FILTER')) {
        // Parse the keep/remove/optional lines
        const lines = text.split('\n')
        const results: any[] = []
        for (const line of lines) {
          const keepMatch = line.match(/^KEEP:\s*(.+?)\s*—\s*(.+)$/i)
          const removeMatch = line.match(/^REMOVE:\s*(.+?)\s*—\s*(.+)$/i)
          const optMatch = line.match(/^OPTIONAL:\s*(.+?)\s*—\s*(.+)$/i)
          if (keepMatch) results.push({ name: keepMatch[1].trim(), tier: 'must', reason: keepMatch[2].trim() })
          else if (removeMatch) results.push({ name: removeMatch[1].trim(), tier: 'remove', reason: removeMatch[2].trim() })
          else if (optMatch) results.push({ name: optMatch[1].trim(), tier: 'optional', reason: optMatch[2].trim() })
        }

        // Also match all supplements not mentioned and put them as recommended
        const mentioned = new Set(results.map(r => r.name.toLowerCase()))
        for (const s of supplements as any[]) {
          const name = s.aicProduct || s.label || ''
          if (!mentioned.has(name.toLowerCase()) && name) {
            results.push({ name, tier: 'recommended', reason: 'Not specifically discussed — keep as secondary support' })
          }
        }

        const introText = text.split('READY TO FILTER')[0].trim()
        return NextResponse.json({ type: 'results', text: introText, results })
      }

      return NextResponse.json({ type: 'message', text })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    console.error('[filter-supplements]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}