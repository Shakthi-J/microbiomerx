// app/api/aic-supplements/route.ts
// AIC Supplement Recommendation Engine — v2.0.0
// Products fetched from Supabase aic_products table (not hardcoded)
// Rules engine (deterministic) -> Groq (writes clinical rationale only)

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  runAICSupplementRules,
  type AICProduct,
  type AICRecommendation,
  type AICRulesOutput,
} from '@/lib/aicSupplementRules'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Fetch all active AIC products from Supabase ─────────────────────────────

async function fetchAICProducts(): Promise<AICProduct[]> {
  const { data, error } = await supabase
    .from('aic_products')
    .select('*')
    .eq('active', true)
    .order('phase', { ascending: true })

  if (error) throw new Error(`Failed to fetch AIC products: ${error.message}`)
  if (!data || data.length === 0) throw new Error('No active AIC products found in database. Please seed the aic_products table.')

  return data as AICProduct[]
}

// ─── Write Groq rationale for a single recommendation ────────────────────────

async function writeRationale(rec: AICRecommendation): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 150,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: [
            'You are a clinical gut microbiome specialist writing concise, evidence-based supplement rationales for a functional medicine doctor.',
            'Rules:',
            '- Write in clinical, professional tone',
            '- Never use the word "prescribe" - use "consider", "indicated", "suggested"',
            '- Never invent supplement names or doses - they are already determined',
            '- Never use marketing language',
            '- Maximum 3 sentences',
            '- Be specific to the patient findings provided',
          ].join('\n'),
        },
        {
          role: 'user',
          content: rec.rationale_prompt,
        },
      ],
    })
    return completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return 'Clinical rationale unavailable. Please review the triggered findings.'
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { report_id, report_data, regenerate = false } = await req.json()

    if (!report_id || !report_data) {
      return NextResponse.json(
        { error: 'report_id and report_data are required' },
        { status: 400 }
      )
    }

    // Return cached results if available (unless regenerate=true)
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

    // Step 1: Fetch AIC products from Supabase
    // This is where all product details live — not in code
    const products = await fetchAICProducts()

    // Step 2: Run deterministic rules engine
    // Products passed in — rules engine maps findings to product_keys
    const rulesOutput: AICRulesOutput = runAICSupplementRules(report_data, products)

    // Step 3: Collect all recommendations
    const allRecs: AICRecommendation[] = [
      ...rulesOutput.phase1,
      ...rulesOutput.phase2_infection_control,
      ...rulesOutput.phase2_probiotics,
      ...rulesOutput.phase2_nutrition,
      ...rulesOutput.phase3,
    ]

    // Step 4: Write Groq rationale for each recommendation sequentially
    // (sequential to avoid Groq rate limits on free tier)
    for (const rec of allRecs) {
      rec.ai_rationale = await writeRationale(rec)
    }

    // Step 5: Helper to merge rationales back into phase arrays
    const withRationale = (phase: AICRecommendation[]): AICRecommendation[] =>
      phase.map((r: AICRecommendation) => ({
        ...r,
        ai_rationale: allRecs.find(
          (a: AICRecommendation) => a.product_key === r.product_key
        )?.ai_rationale,
      }))

    // Step 6: Rebuild full output with rationales filled in
    const fullOutput: AICRulesOutput = {
      ...rulesOutput,
      phase1:                   withRationale(rulesOutput.phase1),
      phase2_infection_control: withRationale(rulesOutput.phase2_infection_control),
      phase2_probiotics:        withRationale(rulesOutput.phase2_probiotics),
      phase2_nutrition:         withRationale(rulesOutput.phase2_nutrition),
      phase3:                   withRationale(rulesOutput.phase3),
    }

    // Step 7: Save to Supabase for caching
    await supabase
      .from('reports')
      .update({
        aic_supplement_recommendations: fullOutput,
        aic_rules_version:              fullOutput.version,
        updated_at:                     new Date().toISOString(),
      })
      .eq('id', report_id)

    return NextResponse.json({ source: 'generated', ...fullOutput })

  } catch (error) {
    console.error('[aic-supplements]', error)
    return NextResponse.json(
      {
        error:  error instanceof Error ? error.message : 'Failed to generate AIC supplement recommendations',
        detail: String(error),
      },
      { status: 500 }
    )
  }
}