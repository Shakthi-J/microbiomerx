'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/SectionHeader'
import SectionAiPanel from '@/components/SectionAiPanel'
import SectionPageShell, { SectionLoading, SectionOverviewCard } from '@/components/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/sectionPage'

const GUT_METRICS = [
  {
    label: 'Intestinal Motility',
    key: 'intestinal_motility',
    refLow: 62.84,
    refHigh: 82.702,
    description: 'Gut transit and bowel movement regulation',
    clinicalNote:
      'High scores suggest over-active motility linked to loose stools, urgency or IBS-D. Below range suggests sluggish transit — bloating, constipation risk.',
  },
  {
    label: 'Mineral Bioavailability',
    key: 'mineral_bioavailability',
    refLow: 35.94,
    refHigh: 52.76,
    description: 'Microbial support for mineral absorption',
    clinicalNote:
      'Below range indicates reduced mineral absorption capacity — risk for deficiency states. High scores may reflect increased oxalate-degrading activity.',
  },
] as const

type GutStatus = 'optimal' | 'low' | 'high'

function getStatus(score: number, low: number, high: number): GutStatus {
  if (score < low) return 'low'
  if (score > high) return 'high'
  return 'optimal'
}

function StatusBadge({ status }: { status: GutStatus }) {
  const styles = {
    optimal: 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]',
    low: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-red-50 text-red-700 border-red-200',
  }
  const labels = { optimal: 'Optimal', low: 'Below Range', high: 'Above Range' }

  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function GutFunctionPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => {
      const gf = (rep.report_data?.gut_function ?? {}) as Record<string, number>
      return {
        metrics: GUT_METRICS.map(m => ({
          label: m.label,
          score: gf[m.key] ?? null,
          refLow: m.refLow,
          refHigh: m.refHigh,
          status: gf[m.key] != null ? getStatus(gf[m.key], m.refLow, m.refHigh) : 'unknown',
        })),
      }
    },
    [],
  )

  const gf = (report?.report_data?.gut_function ?? {}) as Record<string, number>
  const hasData = GUT_METRICS.some(m => gf[m.key] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'gut_function',
    getSectionData,
    hasData,
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const scores = GUT_METRICS.map(m => ({
    ...m,
    score: gf[m.key] ?? null,
    status: gf[m.key] != null ? getStatus(gf[m.key], m.refLow, m.refHigh) : null,
  }))

  const presentScores = scores.filter(s => s.score != null)
  const motility = scores.find(s => s.key === 'intestinal_motility')
  const mineral = scores.find(s => s.key === 'mineral_bioavailability')

  const pageData = {
    metrics: scores.map(s => ({
      key: s.key,
      label: s.label,
      score: s.score,
      status: s.status,
      refLow: s.refLow,
      refHigh: s.refHigh,
    })),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="gut-function"
      label="Gut Function"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Gut Function" />

      {!hasData ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          No gut function data found. Re-upload the PDF to extract scores.
        </p>
      ) : (
        <div className="space-y-4">
          <SectionOverviewCard
            stats={presentScores.map(s => ({
              label: s.label,
              value: s.score!.toFixed(1),
              tone: s.status === 'optimal' ? 'green' : s.status === 'high' ? 'red' : 'amber',
            }))}
          />

          <div className="grid md:grid-cols-2 gap-3">
            {presentScores.map(m => (
              <div key={m.key} className="rounded-xl border border-[#E2F3D0] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">{m.label}</p>
                  {m.status && <StatusBadge status={m.status} />}
                </div>
                <p className="text-xs text-gray-400 mt-1">{m.description}</p>
                <p className="text-2xl font-semibold text-[#538A22] mt-3">{m.score!.toFixed(2)}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-1">
                  Ref {m.refLow} – {m.refHigh}
                </p>
                {m.status && m.status !== 'optimal' && (
                  <p className="text-xs text-gray-600 mt-3 leading-relaxed border-t border-[#E2F3D0] pt-3">
                    {m.clinicalNote}
                  </p>
                )}
              </div>
            ))}
          </div>

          {motility?.score != null && mineral?.score != null && (
            <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-[#538A22] uppercase tracking-wide mb-1">Correlation Insight</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {motility.status === 'high' && mineral.status === 'low'
                  ? 'Elevated motility combined with reduced mineral bioavailability suggests rapid transit time limiting adequate mineral absorption. Consider motility-modulating probiotics and magnesium support.'
                  : 'Gut motility and mineral bioavailability scores are within or near their reference ranges. Continue dietary support to maintain microbial balance.'}
              </p>
            </div>
          )}

          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            loadingMessage="Analysing gut function scores…"
          />
        </div>
      )}
    </SectionPageShell>
  )
}
