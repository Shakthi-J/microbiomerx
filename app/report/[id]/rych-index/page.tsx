'use client'
// app/report/[id]/rych-index/page.tsx
// Auto-analyzes on load. Results feed into PageContextRegistrar so the
// Clinical Assistant sidebar can answer questions about interpretations.

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SectionHeader } from '@/components/SectionHeader'
import SectionAiPanel from '@/components/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/sectionPage'

function ScoreRing({ score }: { score: number }) {
  const size = 160, stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ
  const color = score >= 70 ? '#538A22' : score >= 50 ? '#d97706' : '#dc2626'
  const label = score >= 70 ? 'Good' : score >= 50 ? 'Moderate' : score >= 30 ? 'Low' : 'Critical'
  const labelColor = score >= 70 ? 'text-[#538A22]' : score >= 50 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2F3D0" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x={size/2} y={size/2 - 6} textAnchor="middle" dominantBaseline="middle"
          fontSize="34" fontWeight="700" fill={color}>{score}</text>
        <text x={size/2} y={size/2 + 20} textAnchor="middle" fontSize="11" fill="#9ca3af">out of 100</text>
      </svg>
      <span className={`text-sm font-medium mt-1 ${labelColor}`}>{label}</span>
    </div>
  )
}

export default function RychIndexPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => ({
      rych_index: rep.report_data?.rych_index,
      diversity: rep.report_data?.diversity,
      health_indicators: rep.report_data?.health_indicators,
      disease_risk: rep.report_data?.disease_risk,
    }),
    []
  )

  const scorePreview = report?.report_data?.rych_index
  const hasData = typeof scorePreview === 'number'

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Rych Index',
    getSectionData,
    hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  // With these
type ReportData = {
  rych_index?: number
  diversity?: { shannon?: number }
  species_list?: unknown[]
  antibiotic_recovery?: string | number
  health_indicators?: Record<string, number | null>
  disease_risk?: Record<string, number>
}

const rd    = report.report_data as ReportData | null
const score = typeof rd?.rych_index === 'number' ? rd.rych_index : null

  // ── Everything visible on page, including analysis once it arrives ─────
  // PageContextRegistrar re-pushes this into context whenever analysis
  // changes — so the sidebar assistant immediately gets the interpretations.
  const pageData = {
    rych_index: score ?? null,
    rych_index_interpretation:
      score != null
        ? score >= 70 ? 'Good' : score >= 50 ? 'Moderate' : score >= 30 ? 'Low' : 'Critical'
        : null,
    shannon_diversity: rd?.diversity?.shannon ?? null,
    species_count: Array.isArray(rd?.species_list) ? rd.species_list.length : null,
    antibiotic_recovery: rd?.antibiotic_recovery ?? null,
    top_disease_risks: rd?.disease_risk
      ? Object.entries(rd.disease_risk as Record<string, number>)
          .filter(([, v]) => v != null)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([k, v]) => ({ condition: k, risk_pct: v }))
      : [],
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="rych-index"
      label="Rych Index"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Rych Index" />

      {!score && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          No Rych Index score found. Re-upload the PDF to extract scores.
        </div>
      )}

      {score && (
        <div className="space-y-4">

          {/* Score card */}
          <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-2xl p-6 flex items-center gap-8">
            <ScoreRing score={score} />
            <div className="flex-1 grid grid-cols-3 gap-4">
              {[
                { label: 'Shannon Diversity',    value: rd?.diversity?.shannon      ?? '--' },
                { label: 'Species Count',        value: rd?.species_list?.length    ?? '--' },
                { label: 'Antibiotic Recovery',  value: rd?.antibiotic_recovery     ?? '--' },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-[#E2F3D0] rounded-xl p-4">
                  <p className="text-xl font-semibold text-[#538A22]">{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-4">
            <Link href={`/report/${id}/health-indicators`}
              className="bg-white border border-[#E2F3D0] rounded-xl p-4 hover:bg-[#F2F9EC] hover:border-[#C8E9A8] transition group">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Health Indicators</p>
                <span className="text-xs text-[#538A22] opacity-0 group-hover:opacity-100 transition">View →</span>
              </div>
              {rd?.health_indicators && Object.values(rd.health_indicators).some((v) => v !== null) ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(rd.health_indicators)
                    .filter(([, v]) => v !== null)
                    .map(([k, v]) => (
                      <span key={k} className="text-xs bg-[#F2F9EC] border border-[#E2F3D0] px-2 py-0.5 rounded-md text-gray-600">
                        {k.replace(/_/g, ' ')}: {v as number}
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No data — re-upload PDF</p>
              )}
            </Link>

            <Link href={`/report/${id}/disease-risk`}
              className="bg-white border border-[#E2F3D0] rounded-xl p-4 hover:bg-red-50 hover:border-red-200 transition group">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Disease Risk</p>
                <span className="text-xs text-red-500 opacity-0 group-hover:opacity-100 transition">View →</span>
              </div>
              {rd?.disease_risk && Object.values(rd.disease_risk).some((v) => v !== null) ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(rd.disease_risk as Record<string, number>)
                    .filter(([, v]) => v !== null)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([k, v]) => (
                      <span key={k} className={`text-xs px-2 py-0.5 rounded-md border ${
                        v > 20 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-[#F2F9EC] border-[#E2F3D0] text-gray-600'
                      }`}>
                        {k.replace(/_/g, ' ')}: {v.toFixed(1)}%
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No data — re-upload PDF</p>
              )}
            </Link>
          </div>

          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            loadingMessage="Analysing Rych Index scores…"
          />
        </div>
      )}
    </SectionPageShell>
  )
}