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
]

// Icons for each action card
function IconPackage() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  )
}

function IconTraining() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
}

function IconDiet() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0v1.5a3 3 0 01-3 3H9a3 3 0 01-3-3V10.5m12 0v-2.25A2.25 2.25 0 0015.75 6h-7.5A2.25 2.25 0 006 8.25V10.5" />
    </svg>
  )
}

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

            <div className="rounded-xl px-3 py-2"
              style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                style={{ color: '#538A22' }}>Patient</p>
              <p className="text-sm font-semibold" style={{ color: '#1A3207' }}>
                {report.patient_name}
              </p>
            </div>

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
        <div className="max-w-4xl mx-auto px-8 py-8">

          {/* ── Page header ── */}
          <div className="flex justify-between items-center mb-10">
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
              Clinical Report
            </p>
            <ReportPdfActions reportId={report.id} />
          </div>

          {!rd && (
            <div className="rounded-2xl p-6 mb-8"
              style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>
              ⚠️ No detailed report data found. Please re-upload the PDF for full analysis.
            </div>
          )}

          {/* ── Section label ── */}
          <p className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: '#538A22' }}>
            Care Recommendations
          </p>

          {/* ── 3 action cards ── */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { href: `/report/${id}/packages`,   icon: <IconPackage />,  title: 'Package Recommendation',  desc: 'Probiotic & supplement packages',        cta: 'View' },
              { href: `/report/${id}/training`,   icon: <IconTraining />, title: 'Training Recommendation', desc: 'Exercise protocol based on gut profile',  cta: 'View' },
              { href: `/report/${id}/dietary-rx`, icon: <IconDiet />,     title: 'Dietary Prescription',    desc: 'AI-generated species-specific meal plan', cta: 'Generate' },
            ].map(card => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex items-start gap-3 p-4 rounded-2xl transition-all min-w-0"
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
                {/* Icon */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: '#E2F3D0', color: '#538A22' }}>
                  {card.icon}
                </div>
                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug mb-1 truncate" style={{ color: '#1A3207' }}>
                    {card.title}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: '#6B7280' }}>
                    {card.desc}
                  </p>
                  <div className="mt-2 flex items-center gap-0.5 text-[11px] font-medium"
                    style={{ color: '#538A22' }}>
                    {card.cta}
                    <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── AI Recommendations Panel ── */}
          {rd && (
            <div className="mt-8">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: '#538A22' }}>
                AI Recommendation Engine
              </p>
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
            </div>
          )}

        </div>
      </div>
    </div>
  )
}