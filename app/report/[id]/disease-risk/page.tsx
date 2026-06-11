'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/SectionHeader'
import SectionAiPanel from '@/components/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/sectionPage'

const DISEASES = [
  { key: 'constipation',         label: 'Constipation',                    threshold: 30 },
  { key: 'ibs',                  label: 'Irritable Bowel Syndrome',         threshold: 15 },
  { key: 'type2_diabetes',       label: 'Type 2 Diabetes',                  threshold: 10 },
  { key: 'hypertension',         label: 'Hypertension',                     threshold: 10 },
  { key: 'nafld',                label: 'Non-alcoholic Fatty Liver Disease', threshold: 5  },
  { key: 'rheumatoid_arthritis', label: 'Rheumatoid Arthritis',             threshold: 5  },
  { key: 'obesity',              label: 'Obesity',                          threshold: 5  },
  { key: 'ibd',                  label: 'Inflammatory Bowel Disease',       threshold: 3  },
]

function getRiskLevel(value: number, threshold: number): 'high' | 'moderate' | 'low' {
  if (value >= threshold * 2) return 'high'
  if (value >= threshold) return 'moderate'
  return 'low'
}

const RISK_STYLE = {
  high:     { bar: 'bg-red-500',   badge: 'bg-red-100 text-red-700 border-red-200',    label: 'High risk' },
  moderate: { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Moderate' },
  low:      { bar: 'bg-[#8BC44F]', badge: 'bg-green-100 text-green-700 border-[#C8E9A8]', label: 'Low risk' },
}

export default function DiseaseRiskPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => rep.report_data?.disease_risk,
    []
  )

  const drPreview = (report?.report_data?.disease_risk ?? {}) as Record<string, number>
  const hasDataPreview = Object.values(drPreview).some(v => v != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Disease Risk',
    getSectionData,
    hasDataPreview
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const rd = report.report_data
  const dr = rd?.disease_risk || {}
  const hasData = Object.values(dr).some(v => v !== null && v !== undefined)

  // Sort diseases by value descending
  const sortedDiseases = DISEASES
    .map(d => ({ ...d, value: (dr as Record<string, number>)[d.key] ?? null }))
    .filter(d => d.value !== null && d.value !== undefined)
    .sort((a, b) => (b.value as number) - (a.value as number))

  const highRisk = sortedDiseases.filter(d =>
    getRiskLevel(d.value as number, d.threshold) === 'high'
  )
  const moderateRisk = sortedDiseases.filter(d =>
    getRiskLevel(d.value as number, d.threshold) === 'moderate'
  )

  const pageData = {
    diseases: sortedDiseases.map(d => ({
      key: d.key,
      label: d.label,
      value: d.value,
      threshold: d.threshold,
      risk_level: getRiskLevel(d.value as number, d.threshold),
    })),
    high_risk_count: highRisk.length,
    moderate_risk_count: moderateRisk.length,
    high_risk_conditions: highRisk.map(d => d.label),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="disease-risk"
      label="Disease Risk"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Disease Risk" />

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3
        text-xs text-blue-700 mb-6 font-mono">
        ℹ️ These percentages reflect microbiome-associated risk patterns,
        not clinical diagnoses. Clinical judgment required.
      </div>

      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3
          text-sm text-amber-700 mb-6">
          ⚠️ No disease risk scores found. Re-upload the PDF to extract scores.
        </div>
      )}

      {hasData && (
        <>
        

          {/* Visual chart */}
          <div className="bg-white border border-[#E2F3D0] rounded-2xl p-6 mb-6">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-5">
              Risk probability distribution
            </p>
            <div className="space-y-4">
              {sortedDiseases.map(d => {
                const value = d.value as number
                const risk = getRiskLevel(value, d.threshold)
                const style = RISK_STYLE[risk]
                const barWidth = Math.min(100, value * 1.5)

                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-800">{d.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {value.toFixed(1)}%
                        </span>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded
                          border ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700
                          ${style.bar}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    
                    
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 font-mono mt-4">
              Vertical markers show clinical threshold for each condition
            </p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {highRisk.length}
              </div>
              <div className="text-xs font-mono text-red-600 uppercase tracking-wide">
                High risk
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4
              text-center">
              <div className="text-2xl font-bold text-amber-600 mb-1">
                {moderateRisk.length}
              </div>
              <div className="text-xs font-mono text-amber-600 uppercase tracking-wide">
                Moderate risk
              </div>
            </div>
            <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl p-4
              text-center">
              <div className="text-2xl font-bold text-[#538A22] mb-1">
                {sortedDiseases.length - highRisk.length - moderateRisk.length}
              </div>
              <div className="text-xs font-mono text-[#538A22] uppercase tracking-wide">
                Low risk
              </div>
            </div>
          </div>

          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            loadingMessage="Analysing disease risk patterns…"
          />
        </>
      )}
    </SectionPageShell>
  )
}