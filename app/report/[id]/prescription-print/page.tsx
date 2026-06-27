'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Section {
  key: string; label: string; aicProduct?: string
  detail: string; rationale: string; doctorNote: string
  status: 'kb' | 'modified' | 'added' | 'removed'
  category?: string; phase?: string; contraindications?: string
}
type MergedSection = Section & { _subs?: Section[] }

interface PrescriptionData {
  patient_name: string; patient_age_sex: string
  rych_index: number; rych_tier_label: string
  conditions_flagged: string[]
  contraindication_alerts: Array<{ marker: string; alert: string; severity: string }>
  sections: { supplements: Section[]; therapies: Section[]; dietary: Section[] }
  clinical_impression: string; doctor_notes: string; approved_at: string | null
}
interface DoctorInfo { name: string; degree: string; reg_no: string; signature_data_url: string | null }

const PHASE_ORDER = ['Phase 1', 'Phase 1+2', 'Phase 2', 'Phase 3',
  'Tier 1', 'Tier 1 — Supportive', 'Tier 2', 'Tier 2 — Moderate', 'Tier 2-3', 'Tier 3']

const PHASE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'Phase 1':             { bg: '#538A22', text: '#fff',    border: '#538A22' },
  'Phase 1+2':           { bg: '#6EA832', text: '#fff',    border: '#6EA832' },
  'Phase 2':             { bg: '#A8D878', text: '#2A4D0D', border: '#8BC44F' },
  'Phase 3':             { bg: '#C8E9A8', text: '#2A4D0D', border: '#A8D878' },
  'Tier 1':              { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  'Tier 1 — Supportive': { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  'Tier 2':              { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  'Tier 2 — Moderate':   { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  'Tier 2-3':            { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  'Tier 3':              { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' },
}

function groupByPhase(items: MergedSection[]) {
  const groups: Record<string, MergedSection[]> = {}
  for (const item of items) {
    const key = item.phase || 'Other'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  const result: { phase: string; items: MergedSection[] }[] = []
  for (const p of PHASE_ORDER) {
    if (groups[p]?.length) result.push({ phase: p, items: groups[p] })
  }
  for (const k of Object.keys(groups)) {
    if (!PHASE_ORDER.includes(k)) result.push({ phase: k, items: groups[k] })
  }
  return result
}

function mergeByAicProduct(items: Section[]): MergedSection[] {
  const groups: Record<string, Section[]> = {}
  const order: string[] = []
  for (const item of items) {
    const key = item.aicProduct?.trim() || item.key
    if (!groups[key]) { groups[key] = []; order.push(key) }
    groups[key].push(item)
  }
  return order.map(key => {
    const group = groups[key]
    if (group.length === 1) return group[0]
    return {
      ...group[0],
      label:             group[0].aicProduct || group[0].label,
      detail:            '',
      doctorNote:        group.map(i => i.doctorNote).filter(Boolean).join('; '),
      contraindications: group.map(i => i.contraindications).filter(Boolean).join('; '),
      _subs:             group,
    }
  })
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).replace(/ /g, '/')
}
function parseDetail(detail: string) {
  const parts = detail.split(' · ').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return { dose: '', timing: '', duration: '' }
  if (parts.length === 1) return { dose: parts[0], timing: '', duration: '' }
  if (parts.length === 2) return { dose: parts[0], timing: parts[1], duration: '' }
  return { dose: parts[0], timing: parts[1], duration: parts[2] }
}
function toFrequency(dose: string, timing: string): string {
  const d = (dose + ' ' + timing).toLowerCase()
  if (d.includes('3x') || d.includes('tds') || d.includes('thrice') || d.includes('3 times')) return '1-1-1'
  if (d.includes('2x') || d.includes('twice') || d.includes('bd')) return '1-0-1'
  if (d.includes('bedtime') || d.includes('night') || d.includes('evening')) return '0-0-1'
  if (d.includes('morning') || d.includes('sublingual') || d.includes('1x') || d.includes('once') || d.includes('od')) return '1-0-0'
  if (d.includes('weekly') || d.includes('week')) return 'Weekly'
  if (d.includes('monthly') || d.includes('month')) return 'Monthly'
  return ''
}

function FooterContent() {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', width:'100%' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ color:'#C2185B' }}>📞</span> +91 7293111120
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ color:'#538A22' }}>✉</span> ClinicLivingPlus@gmail.com
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:3, textAlign:'right' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
          <span style={{ color:'#C2185B' }}>📍</span> 27th Main, HSR Layout, Bangalore
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
          <span style={{ color:'#1565C0' }}>🌐</span> www.cliniclivingplus.com
        </div>
      </div>
    </div>
  )
}

export default function PrescriptionPrintPage() {
  const params   = useParams()
  const reportId = params.id as string
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [data,       setData]       = useState<PrescriptionData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo>({
    name: '', degree: 'MBBS', reg_no: '', signature_data_url: null,
  })

  useEffect(() => {
    const hide = () => {
      const btn   = document.querySelector('button[aria-label="Toggle Clinical Assistant"]') as HTMLElement | null
      const panel = document.querySelector('div[style*="width:400px"]') as HTMLElement | null
      if (btn)   btn.style.setProperty('display', 'none', 'important')
      if (panel) panel.style.setProperty('display', 'none', 'important')
    }
    hide()
    const t1 = setTimeout(hide, 100)
    const t2 = setTimeout(hide, 500)
    const t3 = setTimeout(hide, 1000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: doc } = await supabase.from('doctors')
          .select('name, degree, reg_no, signature_data_url')
          .eq('user_id', session.user.id).maybeSingle()
        if (doc) {
          setDoctorInfo({
            name:               doc.name               || session.user.user_metadata?.full_name || session.user.email || '',
            degree:             doc.degree             || 'MBBS',
            reg_no:             doc.reg_no             || '',
            signature_data_url: doc.signature_data_url || null,
          })
        } else {
          const meta = session.user.user_metadata
          setDoctorInfo(prev => ({ ...prev, name: meta?.full_name || meta?.name || session.user.email || '' }))
        }
      }

      const { data: rep } = await supabase.from('reports')
        .select('patient_name, patient_age_sex, rules_output').eq('id', reportId).single()
      if (!rep) { setError('Report not found'); setLoading(false); return }
      const ro = rep.rules_output as any

      const storageKey = `rx_print_${reportId}`
      const cached     = sessionStorage.getItem(storageKey)
      if (cached) {
        sessionStorage.removeItem(storageKey)
        try {
          const parsed = JSON.parse(cached)
          const { data: rx } = await supabase.from('prescriptions')
            .select('approved_at').eq('report_id', reportId).maybeSingle()
          setData({
            patient_name:            rep.patient_name || 'Unknown Patient',
            patient_age_sex:         rep.patient_age_sex || '',
            rych_index:              Number(ro?.rych_index ?? 0),
            rych_tier_label:         ro?.rych_tier_label ?? '',
            conditions_flagged:      ro?.conditions_flagged ?? [],
            contraindication_alerts: ro?.contraindication_alerts ?? [],
            sections:                parsed.sections,
            clinical_impression:     parsed.clinical_impression || '',
            doctor_notes:            parsed.doctor_notes || '',
            approved_at:             rx?.approved_at ?? null,
          })
          setLoading(false)
          return
        } catch {}
      }

      const { data: rx } = await supabase.from('prescriptions')
        .select('rx_data, approved_at').eq('report_id', reportId).maybeSingle()
      const rxData   = rx?.rx_data as any
      const sections = rxData?.sections ?? {
        supplements: (ro?.supplements ?? []).map((s: any, i: number) => ({
          key: `supp_${i}`, label: s.product_name, aicProduct: s.aic_product_name,
          detail: [s.dose, s.timing, s.duration].filter(Boolean).join(' · '),
          rationale: s.mechanism, doctorNote: '', status: 'kb',
          category: s.aic_category, phase: s.protocol_phase,
        })),
        therapies: (ro?.therapies ?? []).map((t: any, i: number) => ({
          key: `ther_${i}`, label: t.modality || t.therapy_type,
          detail: [t.frequency, t.course_length].filter(Boolean).join(' · '),
          rationale: t.dosing_protocol, doctorNote: '', status: 'kb',
          category: t.therapy_type, phase: t.tier_indication,
          contraindications: t.contraindication_screen,
        })),
        dietary: (ro?.dietary ?? []).map((d: any, i: number) => ({
          key: `diet_${i}`, label: `${d.condition_name} - ${d.phase}`,
          detail: d.duration, rationale: d.specific_instructions,
          doctorNote: '', status: 'kb', phase: d.phase,
        })),
      }
      setData({
        patient_name:            rep.patient_name || 'Unknown Patient',
        patient_age_sex:         rep.patient_age_sex || '',
        rych_index:              Number(ro?.rych_index ?? 0),
        rych_tier_label:         ro?.rych_tier_label ?? '',
        conditions_flagged:      ro?.conditions_flagged ?? [],
        contraindication_alerts: ro?.contraindication_alerts ?? [],
        sections,
        clinical_impression:     rxData?.clinical_impression || '',
        doctor_notes:            rxData?.doctor_notes || '',
        approved_at:             rx?.approved_at ?? null,
      })
      setLoading(false)
    }
    load()
  }, [reportId])

  useEffect(() => {
    if (!loading && data) setTimeout(() => window.print(), 700)
  }, [loading, data])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Arial' }}>
      <p style={{ color:'#538A22' }}>Preparing prescription…</p>
    </div>
  )
  if (error || !data) return <div style={{ padding:40 }}><p>Error: {error || 'Could not load'}</p></div>

  const rawRxItems   = [...data.sections.supplements, ...data.sections.therapies].filter(s => s.status !== 'removed')
  const rxItems      = mergeByAicProduct(rawRxItems)
  const dietaryItems = data.sections.dietary.filter(d => d.status !== 'removed')
  const today        = formatDate(new Date().toISOString())
  const grouped      = groupByPhase(rxItems)

  const displayIndex: Record<string, number> = {}
  let displayNum = 1
  for (const { items } of grouped) {
    for (const item of items) { displayIndex[item.key] = displayNum++ }
  }

  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Arial, sans-serif; background:#e8e8e8; color:#1a1a1a; }
        .action-bar { position:fixed; top:0; left:0; right:0; background:#1A3207; padding:10px 24px; display:flex; justify-content:space-between; align-items:center; z-index:200; gap:12px; }
        .action-bar p { font-size:13px; color:#A8D878; }
        .print-btn { background:#538A22; color:white; border:none; padding:8px 20px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; }
        .no-sig-warning { font-size:11px; color:#FCD34D; display:flex; align-items:center; gap:6px; }
        .page { background:white; max-width:794px; width:794px; margin:68px auto 20px; padding:40px 56px 36px; box-shadow:0 4px 24px rgba(0,0,0,0.10); }
        .screen-lh { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; padding-bottom:12px; border-bottom:2px solid #538A22; }
        .clinic-name { font-size:19px; font-weight:bold; color:#1A3207; }
        .tagline { font-size:11px; color:#538A22; font-style:italic; margin-top:1px; }
        .lh-right { text-align:right; font-size:10px; color:#888; line-height:1.6; }
        .patient-name { font-size:17px; font-weight:bold; text-align:center; margin-bottom:6px; }
        .patient-date { text-align:right; font-size:12px; color:#333; margin-bottom:14px; }
        .findings-row { display:flex; gap:16px; font-size:12px; margin-bottom:12px; }
        .findings-label { flex-shrink:0; font-weight:bold; width:160px; }
        .findings-content { flex:1; line-height:1.8; color:#333; }
        .rych-line { font-weight:bold; color:#538A22; }
        .notes-block { font-size:12px; border-top:1px solid #eee; padding-top:10px; margin-bottom:14px; }
        .notes-heading { font-weight:bold; font-size:13px; margin-bottom:8px; }
        .notes-row { display:flex; gap:16px; margin-bottom:6px; }
        .notes-row-label { flex-shrink:0; width:160px; color:#555; font-weight:bold; }
        .notes-row-content { flex:1; color:#333; line-height:1.6; }
        .alert-box { font-size:11px; background:#FEF2F2; border:1px solid #FECACA; border-radius:6px; padding:10px 14px; margin-bottom:14px; }
        .alert-heading { font-weight:bold; color:#B91C1C; margin-bottom:6px; }
        .alert-item { color:#7F1D1D; margin-bottom:3px; }
        .rx-heading { font-size:36px; font-weight:bold; color:#1A3207; margin:4px 0 10px; }
        .rx-col-header { display:grid; grid-template-columns:36px 1fr 110px 110px; border-bottom:2px solid #1A3207; border-top:1px solid #1A3207; padding:7px 0; }
        .rx-col-header span { font-size:11px; font-weight:bold; color:#1A3207; text-transform:uppercase; letter-spacing:0.5px; }
        .rx-phase-divider { display:flex; align-items:center; gap:12px; margin:10px 0 4px; page-break-after:avoid; break-after:avoid; }
        .rx-phase-line { height:1px; flex:1; background:#E2F3D0; }
        .rx-phase-badge { font-size:10px; font-weight:bold; letter-spacing:0.8px; text-transform:uppercase; padding:2px 10px; border-radius:10px; white-space:nowrap; }
        .rx-item { display:grid; grid-template-columns:36px 1fr 110px 110px; border-bottom:1px solid #eee; padding:12px 0 10px; align-items:start; page-break-inside:avoid; break-inside:avoid; }
        .rx-item-no { color:#538A22; font-weight:bold; font-size:12px; padding-top:2px; }
        .med-name { font-weight:bold; font-size:13px; color:#1A3207; margin-bottom:2px; }
        .med-aic { font-size:10px; color:#538A22; background:#F2F9EC; border:1px solid #C8E9A8; border-radius:10px; display:inline-block; padding:1px 8px; margin-bottom:3px; }
        .med-sub { font-size:11px; color:#555; margin-top:2px; }
        .med-sub-item { font-size:11px; color:#333; margin-bottom:4px; padding-left:8px; border-left:2px solid #C8E9A8; }
        .med-note { font-size:10px; color:#538A22; margin-top:3px; font-style:italic; }
        .med-contra { font-size:10px; color:#B91C1C; margin-top:3px; }
        .rx-item-freq { font-size:12px; color:#333; padding-top:2px; }
        .rx-item-dur { font-size:12px; color:#333; padding-top:2px; }
        .dietary-section { margin-top:16px; padding-top:12px; border-top:1px solid #eee; }
        .dietary-heading { font-size:13px; font-weight:bold; color:#1A3207; margin-bottom:8px; }
        .dietary-item { font-size:11px; color:#333; margin-bottom:7px; padding-left:14px; position:relative; page-break-inside:avoid; break-inside:avoid; }
        .dietary-item::before { content:'•'; position:absolute; left:0; color:#538A22; }
        .dietary-item-name { font-weight:bold; color:#1A3207; }
        .dietary-item-rat { font-size:10px; color:#777; font-style:italic; margin-top:2px; }
        .sig-section { margin-top:32px; display:flex; justify-content:flex-end; page-break-inside:avoid; break-inside:avoid; }
        .sig-block { text-align:right; min-width:220px; }
        .sig-image { height:60px; margin-left:auto; display:block; margin-bottom:4px; }
        .sig-line { border-top:1.5px solid #1A3207; margin-bottom:6px; margin-top:8px; }
        .sig-line-empty { border-top:1.5px solid #1A3207; margin-bottom:6px; margin-top:48px; }
        .sig-name { font-size:13px; font-weight:bold; color:#1A3207; }
        .sig-degree { font-size:12px; font-weight:bold; color:#1A3207; }
        .sig-reg { font-size:11px; color:#555; margin-top:2px; }
        .stamp-approved { display:inline-block; border:2px solid #538A22; border-radius:6px; padding:5px 14px; margin-bottom:10px; }
        .stamp-text { font-size:11px; font-weight:bold; color:#538A22; letter-spacing:1px; text-transform:uppercase; }
        .stamp-date { font-size:10px; color:#538A22; margin-top:2px; }
        .screen-footer { font-size:10px; color:#555; border-top:1px solid #C8E9A8; padding-top:10px; margin-top:28px; }
        .print-wrap { display:none; }

        @media screen {
          .print-wrap { display:block !important; }
          .print-ftr-group { display:none !important; }
          .print-body-group, .print-body-row, .print-body-cell { display:block !important; }
        }

        @media print {
          .action-bar,
          button[aria-label="Toggle Clinical Assistant"],
          div[style*="width:400px"], div[style*="width: 400px"] { display:none !important; }
          .screen-lh { display:flex !important; }
          .screen-footer { display:none !important; }
          .rx-item { padding:12px 0 10px; }
          .findings-content { line-height:2; }
          .print-wrap       { display:table !important; width:100%; }
          .print-ftr-group  { display:table-footer-group !important; }
          .print-ftr-row    { display:table-row !important; }
          .print-ftr-cell   { display:table-cell !important; padding:8px 48px; border-top:1px solid #C8E9A8; font-size:9.5px; color:#555; background:white; }
          .print-body-group { display:table-row-group !important; }
          .print-body-row   { display:table-row !important; }
          .print-body-cell  { display:table-cell !important; }
          .page { margin:0 auto; padding:32px 48px 28px; box-shadow:none; background:white; max-width:100%; width:100%; line-height:1.5; }
          @page { margin:0; size:A4; }
          body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
        }
      `}</style>

      {/* Action bar */}
      <div className="action-bar">
        <p>Prescription — {data.patient_name}</p>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {!doctorInfo.signature_data_url && (
            <div className="no-sig-warning">
              ⚠ No signature on file —
              <a href="/doctor-profile" target="_blank" style={{ color:'#FCD34D', textDecoration:'underline', cursor:'pointer' }}>
                set up your profile
              </a>
            </div>
          )}
          <button className="print-btn" onClick={() => window.print()}>
            ⬇ Download / Print PDF
          </button>
        </div>
      </div>

      {/* Print wrapper */}
      <div className="print-wrap">

        {/* Repeating footer */}
        <div className="print-ftr-group">
          <div className="print-ftr-row">
            <div className="print-ftr-cell">
              <FooterContent />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="print-body-group">
          <div className="print-body-row">
            <div className="print-body-cell">
              <div className="page">

                {/* Letterhead */}
                <div className="screen-lh">
                  <div>
                    <div className="clinic-name">CLINIC LIVING PLUS</div>
                    <div className="tagline">…celebrating health!</div>
                  </div>
                  <div className="lh-right">
                    <div>GUT MICROBIOME REPORT</div>
                    <div>Prescription Plan</div>
                  </div>
                </div>

                {/* Patient */}
                <div className="patient-name">
                  {data.patient_name}{data.patient_age_sex ? `, ${data.patient_age_sex}` : ''}
                </div>
                <div className="patient-date">Date: <strong>{today}</strong></div>

                {/* Findings */}
                <div className="findings-row">
                  <div className="findings-label">Primary reason for visit</div>
                  <div className="findings-content">
                    <div className="rych-line">Rych Index: {data.rych_index} - {data.rych_tier_label}</div>
                    {data.conditions_flagged.map((c, i) => <div key={i}>{c}</div>)}
                  </div>
                </div>

                {/* Notes */}
                {(data.clinical_impression || data.doctor_notes) && (
                  <div className="notes-block">
                    <div className="notes-heading">Notes</div>
                    {data.clinical_impression && (
                      <div className="notes-row">
                        <div className="notes-row-label">Clinical impression</div>
                        <div className="notes-row-content">{data.clinical_impression}</div>
                      </div>
                    )}
                    {data.doctor_notes && (
                      <div className="notes-row">
                        <div className="notes-row-label">Doctors Note for patient</div>
                        <div className="notes-row-content">{data.doctor_notes}</div>
                      </div>
                    )}
                  </div>
                )}

                

                {/* Rx */}
                <div className="rx-heading">Rx</div>
                <div className="rx-col-header">
                  <span>NO</span>
                  <span>MEDICINE</span>
                  <span>FREQUENCY</span>
                  <span>DURATION</span>
                </div>

                {grouped.map(({ phase, items }) => {
                  const c = PHASE_STYLE[phase] ?? { bg:'#F2F9EC', text:'#538A22', border:'#C8E9A8' }
                  return (
                    <div key={phase}>
                      {/* Phase divider */}
                      <div className="rx-phase-divider">
                        <div className="rx-phase-line" />
                        <div
                          className="rx-phase-badge"
                          style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}` }}
                        >
                          {phase}
                        </div>
                        <div className="rx-phase-line" />
                      </div>

                      {/* Items */}
                      {items.map(item => {
                        const isMerged = !!(item as MergedSection)._subs
                        const subs     = (item as MergedSection)._subs
                        const { dose, timing, duration } = parseDetail(item.detail)
                        const subText = timing || dose || ''

                        return (
                          <div key={item.key} className="rx-item">

                            {/* Number */}
                            <div className="rx-item-no">{displayIndex[item.key]}.</div>

                            {/* Medicine column */}
                            <div>
                              <div className="med-name">{item.label}</div>

                              {/* AIC badge only for non-merged items */}
                              {item.aicProduct && !isMerged && (
                                <div className="med-aic">{item.aicProduct}</div>
                              )}

                              {/* Sub-items for merged AIC products */}
                              {isMerged && subs ? (
                                <div style={{ marginTop:4 }}>
                                  {subs.map(s => {
                                    const sp = parseDetail(s.detail)
                                    const st = sp.timing || sp.dose || ''
                                    return (
                                      <div key={s.key} className="med-sub-item">
                                        <span style={{ fontWeight:600, color:'#1A3207' }}>{s.label}</span>
                                        {st && <span style={{ color:'#555' }}> — {st}</span>}
                                        {sp.duration && <span style={{ color:'#888' }}> · {sp.duration}</span>}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                subText && <div className="med-sub">{subText}</div>
                              )}

                              {item.doctorNote        && <div className="med-note">📝 {item.doctorNote}</div>}
                              {item.contraindications && <div className="med-contra">⚠ {item.contraindications}</div>}
                            </div>

                            {/* Frequency */}
                            <div className="rx-item-freq">
                              {isMerged ? '' : toFrequency(dose, timing)}
                            </div>

                            {/* Duration */}
                            <div className="rx-item-dur">
                              {isMerged ? '' : (duration || '')}
                            </div>

                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {/* Dietary */}
                {dietaryItems.length > 0 && (
                  <div className="dietary-section">
                    <div className="dietary-heading">🥗 Dietary Protocol</div>
                    {dietaryItems.map(item => (
                      <div key={item.key} className="dietary-item">
                        <span className="dietary-item-name">{item.label}</span>
                        {item.detail && <span style={{ color:'#555' }}> - {item.detail}</span>}
                        {item.rationale && <div className="dietary-item-rat">{item.rationale}</div>}
                        {item.doctorNote && (
                          <div style={{ fontSize:10, color:'#538A22', marginTop:2 }}>📝 {item.doctorNote}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Signature */}
                <div className="sig-section">
                  <div className="sig-block">
                    {data.approved_at && (
                      <div className="stamp-approved" style={{ marginBottom:10 }}>
                        <div className="stamp-text">✓ Approved</div>
                        <div className="stamp-date">{formatDate(data.approved_at)}</div>
                      </div>
                    )}
                    {doctorInfo.signature_data_url && (
                      <img src={doctorInfo.signature_data_url} className="sig-image" alt="Signature" />
                    )}
                    <div className={doctorInfo.signature_data_url ? 'sig-line' : 'sig-line-empty'} />
                    <div className="sig-name">{doctorInfo.name}</div>
                    <div className="sig-degree">{doctorInfo.degree}</div>
                    {doctorInfo.reg_no && <div className="sig-reg">Reg. No.: {doctorInfo.reg_no}</div>}
                  </div>
                </div>

                {/* Screen footer */}
                <div className="screen-footer">
                  <FooterContent />
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}