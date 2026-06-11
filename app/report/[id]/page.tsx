'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import RecommendationsPanel from '@/components/RecommendationsPanel'
import ReportPdfActions from '@/components/ReportPdfActions'
import { getUser } from '@/lib/auth'

type Report = {
  id: string
  doctor_id: string
  patient_name: string
  patient_age_sex: string
  patient_diet: string
  patient_history: string
  patient_allergies: string
  pdf_filename: string
  created_at: string
  report_data: any
  recommendations: any
}


const NAV_GROUPS = [
  { label: 'Clinical overview', items: [
    { section: 'rych-index',        label: 'Rych Index' },
    { section: 'health-indicators', label: 'Health indicators' },
    { section: 'disease-risk',      label: 'Disease risk' },
  ]},
  { label: 'Microbiome profile', items: [
    { section: 'diversity',   label: 'Diversity' },
    { section: 'foundation',  label: 'Foundation' },
    { section: 'probiotics',  label: 'Probiotics' },
    { section: 'pathogens',   label: 'Pathogens' },
  ]},
  { label: 'Production potential', items: [
    { section: 'scfa',              label: 'SCFA' },
    { section: 'vitamins',          label: 'Vitamins' },
    { section: 'neurotransmitters', label: 'Neurotransmitters' },
  ]},
  { label: 'Metabolism & function', items: [
    { section: 'macronutrients', label: 'Macronutrients' },
    { section: 'gut-function',   label: 'Gut function' },
    { section: 'intolerance',    label: 'Intolerance' },
    { section: 'endurance',      label: 'Endurance' },
  ]},
  { label: 'Resistance', items: [
    { section: 'antibiotic', label: 'Antibiotic' },
  ]},
  // ← NEW GROUP
  { label: 'Recommendations', items: [
    { section: 'nutrition', label: 'Nutrition Recommendation' },
  ]},
]

export default function ReportPage() {
  const params   = useParams()
  const router   = useRouter()
  const pathname = usePathname()

  const id             = typeof params?.id === 'string' ? params.id : undefined
  const currentSection = pathname?.split('/').pop() || ''

  const [report,  setReport]  = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        if (!id) return
        const currentUser = await getUser()
        if (!currentUser) { router.push('/login'); return }

        const { data, error } = await supabase
          .from('reports').select('*').eq('id', id).single()

        if (error || !data) { router.push('/dashboard'); return }
        setReport(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: '#F8FAF6' }}>
      <div className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '3px solid #E2F3D0', borderTopColor: '#538A22' }} />
    </div>
  )

  if (!report) return null

  const rd       = report.report_data
  const isActive = (s: string) => currentSection === s
  const score    = rd?.rych_index ?? null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAF6' }}>

      {/* ── Sidebar ── */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden"
        style={{ background: '#F2F9EC', borderRight: '1px solid #C8E9A8' }}>

        {/* Patient card */}
        <div className="p-4" style={{ borderBottom: '1px solid #C8E9A8' }}>
          <div className="rounded-2xl p-4 space-y-2"
            style={{ background: '#FFFFFF', border: '1px solid #C8E9A8' }}>

            {/* Name */}
            <div className="rounded-xl px-3 py-2"
              style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                style={{ color: '#538A22' }}>Patient</p>
              <p className="text-sm font-semibold" style={{ color: '#1A3207' }}>
                {report.patient_name}
              </p>
            </div>

            {/* Age/Sex + Patient ID */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl px-3 py-2"
                style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                  style={{ color: '#538A22' }}>Age / Sex</p>
                <p className="text-sm font-mono font-medium" style={{ color: '#1A3207' }}>
                  {report.patient_age_sex || '—'}
                </p>
              </div>
              <div className="rounded-xl px-3 py-2"
                style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                  style={{ color: '#538A22' }}>Patient ID</p>
                <p className="text-[11px] font-mono font-medium" style={{ color: '#1A3207' }}>
                  {rd?.patient?.sample_id || '—'}
                </p>
              </div>
            </div>

            {/* Rych score */}
            {score != null && (
              <div className="rounded-xl px-3 py-2 flex items-center justify-between"
                style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
                <p className="text-[9px] font-mono uppercase tracking-widest"
                  style={{ color: '#538A22' }}>Rych Index</p>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: score >= 70 ? '#E2F3D0' : score >= 45 ? '#FEF3C7' : '#FEE2E2',
                    color:      score >= 70 ? '#1A3207' : score >= 45 ? '#92400E' : '#991B1B',
                  }}>
                  {score}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-mono uppercase tracking-widest px-2 mb-1.5"
                style={{ color: '#538A22' }}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(item => {
                  const active = isActive(item.section)
                  return (
                    <Link
                      key={item.section}
                      href={`/report/${id}/${item.section}`}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: active ? '#FFFFFF' : 'transparent',
                        border:     `1px solid ${active ? '#C8E9A8' : 'transparent'}`,
                        color:      active ? '#1A3207' : '#3D6B16',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background  = '#FFFFFF'
                          e.currentTarget.style.borderColor = '#C8E9A8'
                          e.currentTarget.style.color       = '#1A3207'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background  = 'transparent'
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.color       = '#3D6B16'
                        }
                      }}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Back to dashboard */}
        <div className="p-4" style={{ borderTop: '1px solid #C8E9A8' }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: '#FFFFFF', border: '1px solid #C8E9A8', color: '#538A22' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F2F9EC' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 lg:px-10">

          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
              Clinical Report
            </p>
            <div className="flex gap-3 items-start">
              <ReportPdfActions reportId={report.id} />
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: '#FFFFFF', border: '1px solid #E2F3D0', color: '#4B5563' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F8FAF6' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            </div>
          </div>

          {!rd && (
            <div className="rounded-2xl p-6 mb-8"
              style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>
              ⚠️ No detailed report data found. Please re-upload the PDF for full analysis.
            </div>
          )}

          {/* Quick action cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { section: 'packages', title: 'Package Recommendation',  desc: 'Probiotic & supplement packages' },
              { section: 'training', title: 'Training Recommendation', desc: 'Exercise protocol based on gut profile' },
            ].map(m => (
              <Link
                key={m.section}
                href={`/report/${id}/${m.section}`}
                className="flex flex-col p-6 rounded-2xl transition-all"
                style={{ background: '#FFFFFF', border: '1px solid #E2F3D0' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#C8E9A8'
                  e.currentTarget.style.background  = '#F8FAF6'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E2F3D0'
                  e.currentTarget.style.background  = '#FFFFFF'
                }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: '#1A3207' }}>{m.title}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{m.desc}</p>
              </Link>
            ))}
          </div>

          {/* Dietary prescription */}
          <div className="flex items-center justify-between p-6 rounded-2xl mb-8"
            style={{ background: '#FFFFFF', border: '1px solid #E2F3D0' }}>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#1A3207' }}>Dietary Prescription</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>AI-generated species-specific meal plan</p>
            </div>
            <Link
              href={`/report/${id}/dietary-rx`}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: '#538A22' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#3D6B16' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#538A22' }}
            >
              Generate →
            </Link>
          </div>

          {rd && (
            <RecommendationsPanel
              reportId={report.id}
              reportData={rd}
              existingRecs={report.recommendations || null}
              patient={{
                name:            report.patient_name,
                age_sex:         report.patient_age_sex,
                diet_type:       report.patient_diet,
                medical_history: report.patient_history,
                allergies:       report.patient_allergies,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}