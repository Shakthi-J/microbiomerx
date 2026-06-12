// app/api/aic-supplements/route.ts
// AIC Supplement Recommendation Engine
// Rules engine (deterministic) → Groq (writes clinical rationale only)

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import {
  runAICSupplementRules,
  type AICRecommendation,
  type AICRulesOutput,
} from '@/lib/aicSupplementRules'


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Write rationale for a single recommendation ────────────────────────────

async function writeRationale(rec: AICRecommendation): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 150,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a clinical gut microbiome specialist writing concise, evidence-based supplement rationales for a functional medicine doctor.
Rules:
- Write in clinical, professional tone
- Never use the word "prescribe" — use "consider", "indicated", "suggested"
- Never invent supplement names or doses — they are already determined
- Never use marketing language
- Maximum 3 sentences
- Be specific to the patient's findings`,
        },
        {
          role: 'user',
          content: rec.rationale_prompt,
        },
      ],
    })
    return completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return 'Clinical rationale generation unavailable. Please review the triggered findings above.'
  }
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { report_id, report_data, regenerate = false } = await req.json()

    if (!report_id || !report_data) {
      return NextResponse.json(
        { error: 'report_id and report_data are required' },
        { status: 400 }
      )
    }

    // Check if we already have cached results (skip if regenerate=true)
    if (!regenerate) {
      const { data: existing } = await supabase
        .from('reports')
        .select('aic_supplement_recommendations')
        .eq('id', report_id)
        .single()

      if (existing?.aic_supplement_recommendations) {
        return NextResponse.json({
          source: 'cache',
          ...existing.aic_supplement_recommendations,
        })
      }
    }

    // ── Step 1: Run deterministic rules engine ─────────────────────────────────
    const rulesOutput: AICRulesOutput = runAICSupplementRules(report_data)

    // ── Step 2: Collect all recommendations that need AI rationale ────────────
    const allRecs: AICRecommendation[] = [
      ...rulesOutput.phase1,
      ...rulesOutput.phase2_infection_control,
      ...rulesOutput.phase2_probiotics,
      ...rulesOutput.phase2_nutrition,
      ...rulesOutput.phase3,
    ]

    // ── Step 3: Write Groq rationale for each recommendation ──────────────────
    // Run sequentially to avoid Groq rate limits (free tier = 100k tokens/day)
    for (const rec of allRecs) {
      rec.ai_rationale = await writeRationale(rec)
    }

    // ── Step 4: Rebuild output with filled rationales ──────────────────────────
    const fullOutput: AICRulesOutput = {
      ...rulesOutput,
      phase1: rulesOutput.phase1.map(r => ({
        ...r,
        ai_rationale: allRecs.find(a => a.product_key === r.product_key)?.ai_rationale,
      })),
      phase2_infection_control: rulesOutput.phase2_infection_control.map(r => ({
        ...r,
        ai_rationale: allRecs.find(a => a.product_key === r.product_key)?.ai_rationale,
      })),
      phase2_probiotics: rulesOutput.phase2_probiotics.map(r => ({
        ...r,
        ai_rationale: allRecs.find(a => a.product_key === r.product_key)?.ai_rationale,
      })),
      phase2_nutrition: rulesOutput.phase2_nutrition.map(r => ({
        ...r,
        ai_rationale: allRecs.find(a => a.product_key === r.product_key)?.ai_rationale,
      })),
      phase3: rulesOutput.phase3.map(r => ({
        ...r,
        ai_rationale: allRecs.find(a => a.product_key === r.product_key)?.ai_rationale,
      })),
    }

    // ── Step 5: Save to Supabase ───────────────────────────────────────────────
    await supabase
      .from('reports')
      .update({
        aic_supplement_recommendations: fullOutput,
        aic_rules_version: fullOutput.version,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report_id)

    return NextResponse.json({ source: 'generated', ...fullOutput })

  } catch (error) {
    console.error('[aic-supplements]', error)
    return NextResponse.json(
      { error: 'Failed to generate AIC supplement recommendations' },
      { status: 500 }
    )
  }
}