'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/SectionHeader'
import SectionAiPanel from '@/components/SectionAiPanel'
import SectionPageShell, { SectionLoading, SectionOverviewCard } from '@/components/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/sectionPage'

const MACRO_METRICS = [
  { label: 'Carbohydrate Metabolism', key: 'carbohydrate', refLow: 29.75, refHigh: 42.366, description: 'Fermentation of carbs and dietary fibre' },
  { label: 'Fat Metabolism', key: 'fat', refLow: 40.9, refHigh: 57.068, description: 'Lipid digestion and bile acid transformation' },
  { label: 'Protein Metabolism', key: 'protein', refLow: 46.2, refHigh: 61.9, description: 'Protein fermentation and amino acid synthesis' },
] as const

function getStatus(score: number, low: number, high: number) {
  if (score < low) return 'low' as const
  if (score > high) return 'high' as const
  return 'optimal' as const
}

export default function MacronutrientPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => {
      const mn = (rep.report_data?.macronutrients ?? {}) as Record<string, number>
      return {
        metrics: MACRO_METRICS.map(m => ({
          label: m.label,
          score: mn[m.key] ?? null,
          refLow: m.refLow,
          refHigh: m.refHigh,
          status: mn[m.key] != null ? getStatus(mn[m.key], m.refLow, m.refHigh) : 'unknown',
        })),
      }
    },
    []
  )

  const mn = (report?.report_data?.macronutrients ?? {}) as Record<string, number>
  const hasData = MACRO_METRICS.some(m => mn[m.key] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'macronutrient_metabolism',
    getSectionData,
    hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const scores = MACRO_METRICS.map(m => ({
    ...m,
    score: mn[m.key] ?? null,
    status: mn[m.key] != null ? getStatus(mn[m.key], m.refLow, m.refHigh) : null,
  }))

  const pageData = {
    metrics: scores.map(s => ({ key: s.key, label: s.label, score: s.score, status: s.status })),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="macronutrients"
      label="Macronutrient Metabolism"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Macronutrients" />
      {!hasData ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          No macronutrient metabolism data found.
        </p>
      ) : (
        <div className="space-y-4">
          <SectionOverviewCard
            stats={scores.filter(s => s.score != null).map(s => ({
              label: s.label.replace(' Metabolism', ''),
              value: s.score!.toFixed(1),
              tone: s.status === 'optimal' ? 'green' : s.status === 'high' ? 'red' : 'amber',
            }))}
          />
          <div className="grid md:grid-cols-3 gap-3">
            {scores.map(m => m.score != null && (
              <div key={m.key} className="rounded-xl border border-[#E2F3D0] bg-white p-4">
                <p className="text-sm font-medium text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400 mt-1">{m.description}</p>
                <p className="text-2xl font-semibold text-[#538A22] mt-3">{m.score.toFixed(2)}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-1">Ref {m.refLow} – {m.refHigh}</p>
              </div>
            ))}
          </div>
          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            loadingMessage="Analysing macronutrient metabolism…"
          />
        </div>
      )}
    </SectionPageShell>
  )
}
