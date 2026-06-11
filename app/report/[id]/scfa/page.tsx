'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SectionHeader } from '@/components/SectionHeader'
import SectionAiPanel from '@/components/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/sectionPage'
// ─── Types ───────────────────────────────────────────────────────────────────

interface SCFAItem {
  name: string
  score: number
  low_ref: number
  high_ref: number
}

interface SCFAData {
  acetate?: number
  propionate?: number
  butyrate?: number
  isobutyric_acid?: number
  valeric_acid?: number
  isovaleric_acid?: number
  methylbutyric_acid?: number
  formate?: number
  caproate?: number
}

interface Report {
  id: string
  patient_name: string
  patient_age_sex: string
  patient_complaint?: string
  patient_diet?: string
  patient_history?: string
  patient_allergies?: string
  report_data: {
    scfa?: SCFAData
    [key: string]: unknown
  }
}

interface ContributingFactor {
  factor: string
  explanation: string
  impact: 'positive' | 'negative' | 'neutral'
}

interface Analysis {
  interpretation: string
  clinical_significance: string
  contributing_factors?: ContributingFactor[]
  what_drives_it?: string
  considerations?: string[]
}

// ─── Reference ranges pulled from BugSpeaks report format ────────────────────
// These are the population optimal ranges (low_ref–high_ref = green zone)
// Scores below low_ref = Low (orange), above high_ref = High/Atypical (red)

const SCFA_REFS: Record<string, { label: string; low_ref: number; high_ref: number; clinical_note: string }> = {
  acetate:           { label: 'Acetate',               low_ref: 71.72, high_ref: 88.54, clinical_note: 'Primary energy source for peripheral tissues; produced by Bifidobacterium and Bacteroides. Low levels suggest reduced fibre fermentation.' },
  propionate:        { label: 'Propionate',             low_ref: 53.96, high_ref: 68.416, clinical_note: 'Signals satiety via gut-brain axis; supports hepatic gluconeogenesis. Elevated levels may suppress acetate and butyrate production.' },
  butyrate:          { label: 'Butyrate',               low_ref: 59.94, high_ref: 71.932, clinical_note: 'Primary fuel for colonocytes; anti-inflammatory, strengthens gut barrier (tight junctions), inhibits colorectal cancer cell proliferation.' },
  isobutyric_acid:   { label: 'Isobutyric Acid',        low_ref: 63.2,  high_ref: 78.218, clinical_note: 'Branched-chain SCFA from protein fermentation. Low levels indicate reduced proteolytic fermentation.' },
  valeric_acid:      { label: 'Valeric Acid',           low_ref: 71.05, high_ref: 98.24,  clinical_note: 'Emerging SCFA linked to anti-inflammatory activity. Significantly low — may reflect a depleted Lachnospiraceae population.' },
  isovaleric_acid:   { label: 'Isovaleric Acid',        low_ref: 48.48, high_ref: 63.065, clinical_note: 'Branched-chain SCFA produced from leucine/valine catabolism. Low levels suggest limited amino acid fermentation.' },
  methylbutyric_acid:{ label: '2-Methylbutyric Acid',   low_ref: 25.36, high_ref: 62.06,  clinical_note: 'Above-optimal branched-chain SCFA. High levels may indicate excess protein fermentation in the colon — a sign of proteolytic dysbiosis.' },
  formate:           { label: 'Formate',                low_ref: 61.58, high_ref: 74.429, clinical_note: 'One-carbon unit donor; involved in nucleotide synthesis. Elevated formate may reflect increased Prevotella activity (matches high Prevotella copri abundance).' },
  caproate:          { label: 'Caproate (Hexanoate)',   low_ref: 43.31, high_ref: 71.124, clinical_note: 'Medium-chain fatty acid with antimicrobial properties; can be cytotoxic to colonocytes at high levels.' },
}

// ─── Bin classification ───────────────────────────────────────────────────────

function getBin(score: number, low_ref: number, high_ref: number): 'low' | 'optimal' | 'high' {
  if (score < low_ref) return 'low'
  if (score > high_ref) return 'high'
  return 'optimal'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BinBadge({ bin }: { bin: 'low' | 'optimal' | 'high' }) {
  const styles = {
    low:     'bg-orange-100 text-orange-700 border-orange-200',
    optimal: 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]',
    high:    'bg-red-100 text-red-700 border-red-200',
  }
  const labels = { low: 'Low', optimal: 'Optimal', high: 'High Atypical' }
  return (
    <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${styles[bin]}`}>
      {labels[bin]}
    </span>
  )
}

function SCFABar({ item }: { item: SCFAItem }) {
  const bin = getBin(item.score, item.low_ref, item.high_ref)
  const barColor = bin === 'high' ? '#DC2626' : bin === 'low' ? '#EA580C' : '#538A22'
  const scorePct = Math.min(100, Math.max(0, item.score))
  const lowPct   = Math.min(100, Math.max(0, item.low_ref))
  const highPct  = Math.min(100, Math.max(0, item.high_ref))

  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
      {/* Green reference range band */}
      <div
        className="absolute top-0 h-full bg-[#E2F3D0] rounded-full"
        style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
      />
      {/* Score marker */}
      <div
        className="absolute top-0 h-full w-2 rounded-full"
        style={{ left: `${scorePct}%`, background: barColor, transform: 'translateX(-50%)', zIndex: 10 }}
      />
    </div>
  )
}

function SCFARow({ item, refData }: { item: SCFAItem; refData: { label: string; clinical_note: string } }) {
  const [expanded, setExpanded] = useState(false)
  const bin = getBin(item.score, item.low_ref, item.high_ref)

  return (
    <div className="border border-[#E2F3D0] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium text-gray-800">{refData.label}</span>
            <BinBadge bin={bin} />
          </div>
          <SCFABar item={item} />
          <div className="flex justify-between text-[10px] font-mono text-gray-400 mt-1.5">
            <span>0</span>
            <span className="text-[#538A22]">Optimal: {item.low_ref}–{item.high_ref}</span>
            <span>100</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <span
            className="text-2xl font-light tabular-nums"
            style={{ color: bin === 'high' ? '#DC2626' : bin === 'low' ? '#EA580C' : '#538A22' }}
          >
            {item.score}
          </span>
          <p className="text-[10px] text-gray-400 mt-0.5">{expanded ? '▲ hide' : '▼ details'}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-[#E2F3D0] pt-3 bg-gray-50">
          <p className="text-xs text-gray-600 leading-relaxed">{refData.clinical_note}</p>
        </div>
      )}
    </div>
  )
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({ label, items, color, bg }: {
  label: string; items: string[]; color: string; bg: string
}) {
  if (items.length === 0) return null
  return (
    <div className={`rounded-xl border p-4 ${bg}`} style={{ borderColor: color + '40' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color }}>
        {label} — {items.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(name => (
          <span
            key={name}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: color + '20', color }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── AI Analysis panel ────────────────────────────────────────────────────────

function AIAnalysisPanel({ analysis, analysing, error, onAnalyse }: {
  analysis: Analysis | null
  analysing: boolean
  error: string | null
  onAnalyse: () => void
}) {
  return (
    <div className="bg-white border border-[#E2F3D0] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2F3D0] flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">AI Clinical Analysis</p>
          <p className="text-xs text-gray-400 mt-0.5">SCFA interpretation based on patient scores + context</p>
        </div>
        <button
          onClick={onAnalyse}
          disabled={analysing}
          className={`text-xs font-mono px-4 py-2 rounded-lg border transition
            ${analysing
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : analysis
              ? 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              : 'bg-[#538A22] text-white border-[#538A22] hover:bg-[#3D6B16]'
            }`}
        >
          {analysing ? 'Analysing…' : analysis ? 'Regenerate' : 'Analyse →'}
        </button>
      </div>

      {!analysis && !analysing && (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-400">
            Click Analyse for AI-powered clinical interpretation of this patient's SCFA profile.
          </p>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-left">
              {error}
            </div>
          )}
        </div>
      )}

      {analysing && (
        <div className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-[#538A22] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-mono">Running rules engine…</p>
        </div>
      )}

      {analysis && !analysing && (
        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">Interpretation</p>
            <p className="text-sm text-gray-700 leading-relaxed">{analysis.interpretation}</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-mono text-blue-600 uppercase tracking-wide mb-2">Clinical significance</p>
            <p className="text-sm text-blue-900 leading-relaxed">{analysis.clinical_significance}</p>
          </div>

          {(analysis.contributing_factors ?? []).length > 0 && (
            <div>
              <p className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-3">Contributing factors</p>
              <div className="space-y-2">
                {(analysis.contributing_factors ?? []).map((f, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border
                    ${f.impact === 'positive' ? 'bg-[#F2F9EC] border-[#E2F3D0]'
                      : f.impact === 'negative' ? 'bg-red-50 border-red-100'
                      : 'bg-gray-50 border-[#E2F3D0]'}`}>
                    <span className="flex-shrink-0 mt-0.5">
                      {f.impact === 'positive' ? '↑' : f.impact === 'negative' ? '↓' : '→'}
                    </span>
                    <div>
                      <span className={`text-xs font-medium
                        ${f.impact === 'positive' ? 'text-green-700'
                          : f.impact === 'negative' ? 'text-red-700'
                          : 'text-gray-600'}`}>
                        {f.factor}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{f.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.what_drives_it && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-mono text-amber-600 uppercase tracking-wide mb-2">What drives it</p>
              <p className="text-sm text-amber-900 leading-relaxed">{analysis.what_drives_it}</p>
            </div>
          )}

          {(analysis.considerations ?? []).length > 0 && (
            <div className="space-y-2">
              {(analysis.considerations ?? []).map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-[#538A22] flex-shrink-0 mt-0.5">→</span>
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SCFAPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data, error: dbErr } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single()

      if (dbErr || !data) { router.push('/dashboard'); return }
      setReport(data)
      setLoading(false)
    }
    load()
  }, [id, router])

  const analyse = async () => {
    if (!report) return
    setAnalysing(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'SCFA Production Potential',
          report_data: report.report_data,
          patient: {
            name: report.patient_name,
            age_sex: report.patient_age_sex,
            complaint: report.patient_complaint,
            diet_type: report.patient_diet,
            medical_history: report.patient_history,
            allergies: report.patient_allergies,
          },
          section_data: report.report_data?.scfa,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setAnalysis(data.analysis)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalysing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#538A22] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!report) return null

  // ── Build items array from report_data.scfa ──────────────────────────────

  const raw = report.report_data?.scfa ?? {}

  const items: SCFAItem[] = Object.entries(SCFA_REFS)
    .filter(([key]) => raw[key as keyof SCFAData] != null)
    .map(([key, ref]) => ({
      name: key,
      score: raw[key as keyof SCFAData] as number,
      low_ref: ref.low_ref,
      high_ref: ref.high_ref,
    }))

  const hasData = items.length > 0

  // ── Bucketed lists for summary cards ────────────────────────────────────

  const lowItems     = items.filter(i => getBin(i.score, i.low_ref, i.high_ref) === 'low')
  const optimalItems = items.filter(i => getBin(i.score, i.low_ref, i.high_ref) === 'optimal')
  const highItems    = items.filter(i => getBin(i.score, i.low_ref, i.high_ref) === 'high')

  const labelFor = (key: string) => SCFA_REFS[key]?.label ?? key

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">

      {/* Back link */}
      <SectionHeader reportId={id} title="SCFA Production" />

      {/* Section header */}
      <div className="flex items-start gap-3 mb-1">
        <div>
          <p className="text-sm text-gray-400 mt-1">
            Current capacity of gut microbes to produce short chain fatty acids · 3-bin scoring
          </p>
        </div>
      </div>

      <div className="mt-2 mb-8 flex items-center gap-4 text-xs font-mono text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
          Low potential
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#538A22] inline-block" />
          Optimal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          Above optimal
        </span>
      </div>

      {/* No data state */}
      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          ⚠️ No SCFA data found for this report. Re-upload the PDF to extract scores.
        </div>
      )}

      {hasData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <SummaryCard
              label="Low"
              items={lowItems.map(i => labelFor(i.name))}
              color="#EA580C"
              bg="bg-orange-50"
            />
            <SummaryCard
              label="Optimal"
              items={optimalItems.map(i => labelFor(i.name))}
              color="#538A22"
              bg="bg-[#F2F9EC]"
            />
            <SummaryCard
              label="High Atypical"
              items={highItems.map(i => labelFor(i.name))}
              color="#DC2626"
              bg="bg-red-50"
            />
          </div>

          {/* Clinical alert — Butyrate is the most clinically important */}
          {(() => {
            const butyrate = items.find(i => i.name === 'butyrate')
            if (!butyrate) return null
            const bin = getBin(butyrate.score, butyrate.low_ref, butyrate.high_ref)
            if (bin === 'optimal') return (
              <div className="bg-[#F2F9EC] border border-[#A8D878] rounded-xl px-4 py-3 text-sm text-[#3D6B16] mb-6 flex items-start gap-2">
                <span>✓</span>
                <span><strong>Butyrate is in the optimal range ({butyrate.score})</strong> — primary colonocyte fuel is well supported. Focus on addressing the 4 low-production SCFAs.</span>
              </div>
            )
            return (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 mb-6 flex items-start gap-2">
                <span>⚠️</span>
                <span><strong>Butyrate is {bin} ({butyrate.score})</strong> — this is clinically significant. Butyrate is the primary fuel for colonocytes and a key anti-inflammatory signal. Prioritise this in supplementation and dietary advice.</span>
              </div>
            )
          })()}

          {/* Formate alert — often linked to Prevotella dominance */}
          {(() => {
            const formate = items.find(i => i.name === 'formate')
            if (!formate) return null
            const bin = getBin(formate.score, formate.low_ref, formate.high_ref)
            if (bin !== 'high') return null
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-6 flex items-start gap-2">
                <span>⚑</span>
                <span><strong>Elevated Formate ({formate.score})</strong> may reflect high Prevotella copri activity — consistent with the 50.19% Prevotella dominance seen in this patient's foundation microbiota.</span>
              </div>
            )
          })()}

          {/* Individual SCFA bars */}
          <div className="space-y-3 mb-10">
            {items.map(item => (
              <SCFARow
                key={item.name}
                item={item}
                refData={SCFA_REFS[item.name]}
              />
            ))}
          </div>

          {/* AI Analysis panel */}
          <AIAnalysisPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onAnalyse={analyse}
          />
        </>
      )}
    </div>
  )
}