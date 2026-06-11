import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import { runRulesEngine, extractMetricsForTracking, RULES_VERSION, PARSER_VERSION } from '@/lib/rulesEngine'
import type { ReferenceRange, SpeciesAbundance } from '@/lib/rulesEngine'
import { matchClpTreatments } from '@/lib/matchClpTreatments'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { report_id, report_data, patient, doctor_id } = await req.json()
    if (!report_data) return NextResponse.json({ error: 'Report data required' }, { status: 400 })

    // ── 1. Load reference ranges from DB ────────────────────────────────────
    const { data: rangesData, error: rangesError } = await supabaseAdmin
      .from('reference_ranges')
      .select('metric, category, low, high, pmids')
      .eq('report_type', 'bugspeaks')
      .eq('version', 'v1')

    if (rangesError) {
      console.error('Failed to load reference ranges:', rangesError.message)
      return NextResponse.json({ error: 'Failed to load reference ranges' }, { status: 500 })
    }

    const referenceRanges: ReferenceRange[] = (rangesData || []).map((r: any) => ({
      metric: r.metric,
      category: r.category,
      low: parseFloat(r.low),
      high: parseFloat(r.high),
      pmids: r.pmids || [],
    }))

    // ── 2. Load contraindications from DB ────────────────────────────────────
    const { data: contraData } = await supabaseAdmin
      .from('contraindications')
      .select('supplement, condition, reason, severity')

    const contraindications = contraData || []

    // ── 3. Load species with abundances if available ─────────────────────────
    let speciesAbundances: SpeciesAbundance[] = []
    if (report_id) {
      const { data: speciesData } = await supabaseAdmin
        .from('report_species')
        .select('species_name, genus, relative_abundance')
        .eq('report_id', report_id)

      if (speciesData && speciesData.length > 0) {
        speciesAbundances = speciesData.map((s: any) => ({
          species_name: s.species_name,
          genus: s.genus || s.species_name.split(' ')[0],
          relative_abundance: parseFloat(s.relative_abundance) || 0,
        }))
      }
    }

    // ── 4. Extract patient conditions for contraindication checking ──────────
    const patientConditions: string[] = []
    if (patient?.medical_history) patientConditions.push(patient.medical_history)
    if (patient?.allergies) patientConditions.push(patient.allergies)

    // ── 5. Run deterministic rules engine ────────────────────────────────────
    const rulesOutput = runRulesEngine(
      report_data,
      referenceRanges,
      contraindications,
      patientConditions,
      speciesAbundances
    )

    // ── 6. Fetch matching supplements from DB ────────────────────────────────
    const supplementNames = rulesOutput.supplement_triggers.map(s => s.supplement_name)
    const { data: supplementsDB } = await supabaseAdmin
      .from('supplements')
      .select('name, category, rationale, evidence_level, pmids, brand_name, product_url, clinic_price, patient_price')
      .in('name', supplementNames)
      .eq('active', true)

    // ── 7. Build supplement suggestions ──────────────────────────────────────
    const supplement_suggestions = rulesOutput.supplement_triggers.map(trigger => {
      const db = supplementsDB?.find(s => s.name === trigger.supplement_name)
      return {
        supplement: trigger.supplement_name,
        triggered_by: trigger.triggered_by,
        evidence_level: trigger.evidence_level,
        rationale: db?.rationale || '',
        pmids: db?.pmids || [],
        brand_name: db?.brand_name || null,
        product_url: db?.product_url || null,
        clinic_price: db?.clinic_price || null,
        patient_price: db?.patient_price || null,
        category: db?.category || '',
        contraindicated_with: trigger.contraindicated_with,
      }
    })

    // ── 8. AI writes clinical notes + lifestyle recommendations ──────────────
    const findingsSummary = rulesOutput.findings
      .map(f => `[${f.severity.toUpperCase()}] ${f.category}: ${f.finding}`)
      .join('\n')

    const patientContext = patient
      ? `Patient: ${patient.name || 'Unknown'}, ${patient.age_sex || ''}
Chief complaint: ${patient.complaint || 'not specified'}
Diet: ${patient.diet_type || 'not specified'}
Medical history: ${patient.medical_history || 'none'}
Allergies: ${patient.allergies || 'none'}
Enterotype: ${rulesOutput.enterotype_result.enterotype || 'not determined'} (${rulesOutput.enterotype_result.method})`
      : ''

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 3000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a clinical gut microbiome analyst writing notes for a doctor.
The findings below were generated by a deterministic rules engine - not by AI.
Your job is to write clinical explanations AND personalised lifestyle recommendations.

Rules:
- Never prescribe or suggest doses
- Use: consider, may support, worth exploring, clinically relevant to review
- Do NOT add findings not in the list
- Reference actual scores when mentioned
- Return ONLY valid JSON

{
  "summary": "<2-3 sentences: overall clinical picture based ONLY on findings listed>",
  "clinical_notes": [
    {
      "area": "<finding category>",
      "observation": "<quote the specific finding>",
      "consideration": "<clinical consideration using consider language>",
      "follow_up": "<optional specific follow-up test or action>"
    }
  ],
  "lifestyle_recommendations": {
    "sleep": [
      {
        "suggestion": "<specific sleep habit change>",
        "reason": "<why it matters for this patient's findings>",
        "how": "<practical steps to implement>",
        "microbiome_link": "<how this connects to their specific microbiome findings>",
        "priority": "high|moderate|low"
      }
    ],
    "stress": [
      {
        "suggestion": "<specific stress management action>",
        "reason": "<why relevant to their findings>",
        "how": "<practical implementation>",
        "microbiome_link": "<gut-brain axis link to their data>",
        "priority": "high|moderate|low"
      }
    ],
    "movement": [
      {
        "suggestion": "<specific exercise or movement change>",
        "reason": "<why relevant to their microbiome profile>",
        "how": "<practical steps, frequency, duration>",
        "microbiome_link": "<which specific finding this addresses>",
        "priority": "high|moderate|low"
      }
    ],
    "habits": [
      {
        "suggestion": "<daily habit change e.g. fasting window, meal timing, hydration>",
        "reason": "<why relevant to their findings>",
        "how": "<practical implementation>",
        "microbiome_link": "<which finding this supports>",
        "priority": "high|moderate|low"
      }
    ]
  },
  "follow_up_timeline": "<specific e.g. Reassess in 8 weeks post intervention>",
  "red_flags": ["<only if severity is high AND clinically urgent>"]
}`,
        },
        {
          role: 'user',
          content: `${patientContext}

FINDINGS (${rulesOutput.findings.length} total):
${findingsSummary}

${rulesOutput.enterotype_result.enterotype ? `ENTEROTYPE: ${rulesOutput.enterotype_result.enterotype}\n${rulesOutput.enterotype_result.reason}` : ''}

Write clinical notes AND personalised lifestyle recommendations based on the findings above.
Lifestyle recommendations must directly reference the patient's specific scores and findings.
Each section (sleep, stress, movement, habits) should have 2-4 practical suggestions suited for an Indian patient.`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    let aiOutput: any = {}
    try { aiOutput = JSON.parse(raw) } catch { aiOutput = {} }

    // ── 9. Match CLP treatments (deterministic — no AI) ───────────────────────
    const clp_treatments = matchClpTreatments({
      key_findings:  rulesOutput.findings,
      disease_risk:  report_data?.disease_risk ?? {},
      enterotype:    rulesOutput.enterotype_result.enterotype ?? null,
      summary:       aiOutput.summary ?? '',
    })

    // ── 10. Assemble final output ──────────────────────────────────────────────
    const recommendations = {
      summary: aiOutput.summary || '',
      key_findings: rulesOutput.findings,
      supplement_suggestions,
      lifestyle_recommendations: aiOutput.lifestyle_recommendations || {
        sleep: [], stress: [], movement: [], habits: [],
      },
      clinical_notes: aiOutput.clinical_notes || [],
      clp_treatments,
      follow_up_timeline: aiOutput.follow_up_timeline || 'Reassess in 8 weeks',
      red_flags: aiOutput.red_flags || [],
      enterotype: rulesOutput.enterotype_result.enterotype,
      enterotype_reason: rulesOutput.enterotype_result.reason,
      enterotype_method: rulesOutput.enterotype_result.method,
      rules_version: RULES_VERSION,
      parser_version: PARSER_VERSION,
      generated_at: rulesOutput.generated_at,
    }

    // ── 11. Save everything to Supabase ──────────────────────────────────────
    if (report_id) {
      await supabaseAdmin
        .from('reports')
        .update({
          rules_output: {
            version: rulesOutput.version,
            parser_version: rulesOutput.parser_version,
            findings: rulesOutput.findings,
            supplement_triggers: rulesOutput.supplement_triggers,
            diet_rules: rulesOutput.diet_rules,
            enterotype_result: rulesOutput.enterotype_result,
            generated_at: rulesOutput.generated_at,
          },
          rules_version: RULES_VERSION,
          parser_version: PARSER_VERSION,
          recommendations,
        })
        .eq('id', report_id)

      if (doctor_id) {
        await supabaseAdmin
          .from('recommendation_audit')
          .insert({
            report_id,
            doctor_id,
            rules_version: RULES_VERSION,
            parser_version: PARSER_VERSION,
            generated_at: rulesOutput.generated_at,
            recommendations_snapshot: recommendations,
            doctor_approved: false,
          })

        const metrics = extractMetricsForTracking(report_data)
        if (metrics.length > 0) {
          const reportDate = new Date().toISOString()
          const metricsToInsert = metrics.map(m => ({
            doctor_id,
            patient_name: patient?.name || 'Unknown',
            report_id,
            metric: m.metric,
            category: m.category,
            value: m.value,
            report_date: reportDate,
          }))

          await supabaseAdmin
            .from('patient_metrics')
            .delete()
            .eq('report_id', report_id)

          await supabaseAdmin
            .from('patient_metrics')
            .insert(metricsToInsert)
        }
      }
    }

    return NextResponse.json({ recommendations })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('recommendations error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}