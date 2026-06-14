'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import SectionPageShell from '@/components/SectionPageShell'
import { useSectionReport } from '@/lib/sectionPage'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type ItemStatus = 'kb' | 'modified' | 'added' | 'removed'
interface EditableItem { key: string; label: string; detail: string; rationale: string; doctorNote: string; status: ItemStatus; priority?: string; category?: string; phase?: string; contraindications?: string }
interface ReviewSections { supplements: EditableItem[]; therapies: EditableItem[]; dietary: EditableItem[] }
interface ReportSummary { id: string; patient_name: string; patient_age_sex: string; rych_index: number; rych_tier: number; rych_tier_label: string; marker_count: number; conditions_flagged: string[]; contraindication_alerts: Array<{ marker: string; alert: string; severity: string }> }

function rychBadge(tier: number) {
  if (tier === 3) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Severe' }
  if (tier === 2) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Moderate' }
  return { bg: 'bg-[#E2F3D0]', text: 'text-[#3D6B16]', border: 'border-[#C8E9A8]', label: 'Mild' }
}

function statusBadge(status: ItemStatus) {
  switch (status) {
    case 'kb':       return 'bg-slate-100 text-slate-500 border-slate-200'
    case 'modified': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'added':    return 'bg-[#E2F3D0] text-[#3D6B16] border-[#C8E9A8]'
    case 'removed':  return 'bg-red-100 text-red-500 border-red-200'
  }
}

function statusLabel(status: ItemStatus) {
  switch (status) {
    case 'kb':       return 'From KB'
    case 'modified': return 'Modified'
    case 'added':    return 'Added'
    case 'removed':  return 'Removed'
  }
}

function ItemCard({ item, onToggle, onNoteChange, onDetailChange, disabled }: { item: EditableItem; onToggle: (key: string) => void; onNoteChange: (key: string, note: string) => void; onDetailChange: (key: string, detail: string) => void; disabled?: boolean }) {
  const [editingDetail, setEditingDetail] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const isRemoved = item.status === 'removed'
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${isRemoved ? 'border-red-200 bg-red-50 opacity-60' : 'border-slate-200 bg-white hover:border-[#8BC44F] hover:shadow-sm'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button onClick={() => !disabled && onToggle(item.key)} disabled={disabled} className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isRemoved ? 'border-red-300 bg-white' : 'border-[#538A22] bg-[#538A22]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} title={disabled ? 'Locked' : isRemoved ? 'Click to include' : 'Click to remove'}>
            {!isRemoved && (<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>)}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${isRemoved ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.label}</p>
            {editingDetail ? (
              <textarea autoFocus className="mt-1 w-full text-xs text-slate-600 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400" rows={2} value={item.detail} onChange={e => onDetailChange(item.key, e.target.value)} onBlur={() => setEditingDetail(false)} />
            ) : (
              <p className={`mt-0.5 text-xs text-slate-500 ${!disabled && !isRemoved ? 'cursor-text hover:text-slate-700' : ''}`} onClick={() => !disabled && !isRemoved && setEditingDetail(true)} title={!disabled ? 'Click to edit' : undefined}>
                {item.detail || <span className="italic text-slate-300">No detail</span>}
              </p>
            )}
            {item.rationale && (<p className="mt-1.5 text-xs text-slate-400 leading-relaxed border-l-2 border-slate-200 pl-2">{item.rationale}</p>)}
            {item.contraindications && (<p className="mt-1.5 text-xs text-red-600 font-medium">⚠ {item.contraindications}</p>)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusBadge(item.status)}`}>{statusLabel(item.status)}</span>
          {item.category && (<span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.category}</span>)}
          {item.phase && (<span className="text-[10px] text-[#538A22] bg-[#F2F9EC] px-2 py-0.5 rounded-full">{item.phase}</span>)}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {editingNote ? (
          <textarea autoFocus className="w-full text-xs bg-[#F2F9EC] border border-[#C8E9A8] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#538A22] placeholder:text-slate-400" rows={2} placeholder="Add doctor note…" value={item.doctorNote} onChange={e => onNoteChange(item.key, e.target.value)} onBlur={() => setEditingNote(false)} />
        ) : (
          <button onClick={() => !disabled && !isRemoved && setEditingNote(true)} disabled={disabled} className={`w-full text-left text-xs text-slate-400 transition-colors ${!disabled ? 'hover:text-[#538A22]' : 'cursor-default'}`}>
            {item.doctorNote ? <span className="text-[#3D6B16] font-medium">📝 {item.doctorNote}</span> : <span className="italic">{disabled ? '' : '+ Add doctor note'}</span>}
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, count, children, onAddItem, disabled }: { title: string; icon: string; count: number; children: React.ReactNode; onAddItem: () => void; disabled?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#F2F9EC] border-b border-[#C8E9A8]">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="font-semibold text-[#2A4D0D] text-sm">{title}</h3>
          <span className="text-xs text-[#538A22] bg-[#E2F3D0] px-2 py-0.5 rounded-full font-medium">{count}</span>
        </div>
        {!disabled && (<button onClick={onAddItem} className="text-xs text-[#538A22] hover:text-[#3D6B16] font-medium flex items-center gap-1 transition-colors"><span className="text-base leading-none">+</span> Add</button>)}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

export default function DoctorReviewPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { report: shellReport, loading: shellLoading } = useSectionReport(reportId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isApproved, setIsApproved] = useState(false)
  const [approvedAt, setApprovedAt] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [sections, setSections] = useState<ReviewSections>({ supplements: [], therapies: [], dietary: [] })
  const [clinicalImpression, setClinicalImpression] = useState('')
  const [doctorNotes, setDoctorNotes] = useState('')
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null)
  const isEditable = !isApproved || isEditMode

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: rep } = await supabase.from('reports').select('id, patient_name, patient_age_sex, patient_id, rules_output').eq('id', reportId).single()
      if (!rep) { router.push('/dashboard'); return }
      const ro = rep.rules_output as Record<string, unknown> | null
      setReport({ id: rep.id, patient_name: rep.patient_name || 'Unknown Patient', patient_age_sex: rep.patient_age_sex || '', rych_index: Number((ro as any)?.rych_index ?? 0), rych_tier: Number((ro as any)?.rych_tier ?? 1), rych_tier_label: (ro as any)?.rych_tier_label ?? 'Unknown', marker_count: Number((ro as any)?.marker_count ?? 0), conditions_flagged: ((ro as any)?.conditions_flagged ?? []) as string[], contraindication_alerts: ((ro as any)?.contraindication_alerts ?? []) as any[] })
      if (ro) {
        const supps = ((ro as any).supplements ?? []) as any[]
        const therapies = ((ro as any).therapies ?? []) as any[]
        const dietary = ((ro as any).dietary ?? []) as any[]
        setSections({
          supplements: supps.map((s, i) => ({ key: `supp_${i}`, label: s.product_name, detail: [s.dose, s.timing, s.duration].filter(Boolean).join(' · '), rationale: s.mechanism, doctorNote: '', status: 'kb' as ItemStatus, category: s.aic_category, phase: s.protocol_phase, contraindications: '' })),
          therapies: therapies.map((t, i) => ({ key: `ther_${i}`, label: t.modality || t.therapy_type, detail: [t.frequency, t.course_length].filter(Boolean).join(' · '), rationale: t.dosing_protocol, doctorNote: '', status: 'kb' as ItemStatus, category: t.therapy_type, phase: t.tier_indication, contraindications: t.contraindication_screen })),
          dietary: dietary.map((d, i) => ({ key: `diet_${i}`, label: `${d.condition_name} — ${d.phase}`, detail: d.duration, rationale: d.specific_instructions, doctorNote: '', status: 'kb' as ItemStatus, phase: d.phase, contraindications: '' })),
        })
      }
      const { data: rx } = await supabase.from('prescriptions').select('*').eq('report_id', reportId).maybeSingle()
      if (rx) {
        setPrescriptionId(rx.id); setIsApproved(!!rx.approved_at); setApprovedAt(rx.approved_at ?? null)
        const rxData = rx.rx_data as Record<string, unknown> | null
        if (rxData) {
          if ((rxData as any).sections) setSections((rxData as any).sections)
          if ((rxData as any).clinical_impression) setClinicalImpression((rxData as any).clinical_impression)
          if ((rxData as any).doctor_notes) setDoctorNotes((rxData as any).doctor_notes)
        }
      }
      setLoading(false)
    }
    load()
  }, [reportId, supabase, router])

  const toggleItem = useCallback((section: keyof ReviewSections, key: string) => { setSections(prev => ({ ...prev, [section]: prev[section].map(item => item.key === key ? { ...item, status: item.status === 'removed' ? 'kb' : 'removed' } : item) })) }, [])
  const updateNote = useCallback((section: keyof ReviewSections, key: string, note: string) => { setSections(prev => ({ ...prev, [section]: prev[section].map(item => item.key === key ? { ...item, doctorNote: note, status: item.status === 'kb' ? 'modified' : item.status } : item) })) }, [])
  const updateDetail = useCallback((section: keyof ReviewSections, key: string, detail: string) => { setSections(prev => ({ ...prev, [section]: prev[section].map(item => item.key === key ? { ...item, detail, status: item.status === 'kb' ? 'modified' : item.status } : item) })) }, [])
  const addItem = useCallback((section: keyof ReviewSections) => { const key = `${section}_added_${Date.now()}`; setSections(prev => ({ ...prev, [section]: [...prev[section], { key, label: 'New item — click to edit', detail: '', rationale: '', doctorNote: '', status: 'added' as ItemStatus }] })) }, [])

  const buildPayload = () => ({ sections, clinical_impression: clinicalImpression, doctor_notes: doctorNotes, rules_version: 'v2.0.0', saved_at: new Date().toISOString() })

  const saveDraft = async () => {
    setSaving(true)
    const payload = buildPayload()
    const session = await supabase.auth.getSession()
    const doctorId = session.data.session?.user.id
    const patientId = (report as any)?.patient_id ?? null
    let error: any = null, data: any = null
    if (prescriptionId) {
      const res = await supabase.from('prescriptions').update({ rx_data: payload, doctor_id: doctorId }).eq('id', prescriptionId).select('id').single()
      error = res.error; data = res.data
    } else {
      const res = await supabase.from('prescriptions').upsert({ report_id: reportId, patient_id: patientId, doctor_id: doctorId, rx_data: payload }, { onConflict: 'report_id' }).select('id').single()
      error = res.error; data = res.data
    }
    if (error) { console.error('Save failed:', error.code, error.message); setSaveStatus('error') }
    else { if (data?.id) setPrescriptionId(data.id); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2500) }
    setSaving(false)
  }

  const approveRx = async () => {
    setApproving(true)
    await saveDraft()
    const now = new Date().toISOString()
    const session = await supabase.auth.getSession()
    const doctorId = session.data.session?.user.id
    setTimeout(async () => {
      const currentId = prescriptionId
      if (currentId) {
        const { error } = await supabase.from('prescriptions').update({ approved_at: now, doctor_id: doctorId }).eq('id', currentId)
        if (!error) { setIsApproved(true); setApprovedAt(now); setIsEditMode(false) }
        else console.error('Approve failed:', error.message)
      } else {
        const { error } = await supabase.from('prescriptions').upsert({ report_id: reportId, doctor_id: doctorId, rx_data: buildPayload(), approved_at: now }, { onConflict: 'report_id' })
        if (!error) { setIsApproved(true); setApprovedAt(now); setIsEditMode(false) }
      }
      setApproving(false)
    }, 300)
  }

  const unlockForEdit = async () => {
    if (!prescriptionId) return
    setUnlocking(true)
    const { error } = await supabase.from('prescriptions').update({ approved_at: null, approved_by: null }).eq('id', prescriptionId)
    if (!error) { setIsApproved(false); setApprovedAt(null); setIsEditMode(false) }
    else console.error('Unlock failed:', error.message)
    setUnlocking(false)
  }

  // ── Page data for Clinical Assistant ────────────────────────────────────
  const pageData = useMemo(() => {
    if (!report) return {}
    const activeSupps    = sections.supplements.filter(s => s.status !== 'removed')
    const activeTherapies = sections.therapies.filter(s => s.status !== 'removed')
    const activeDietary  = sections.dietary.filter(s => s.status !== 'removed')
    return {
      rych_index:            report.rych_index,
      rych_tier_label:       report.rych_tier_label,
      marker_count:          report.marker_count,
      conditions_flagged:    report.conditions_flagged,
      contraindication_alerts: report.contraindication_alerts,
      is_approved:           isApproved,
      approved_at:           approvedAt,
      clinical_impression:   clinicalImpression,
      doctor_notes:          doctorNotes,
      active_supplements: activeSupps.map(s => ({
        name: s.label, detail: s.detail, rationale: s.rationale,
        phase: s.phase, category: s.category, doctor_note: s.doctorNote,
      })),
      active_therapies: activeTherapies.map(t => ({
        name: t.label, detail: t.detail, rationale: t.rationale,
        contraindications: t.contraindications, doctor_note: t.doctorNote,
      })),
      active_dietary: activeDietary.map(d => ({
        name: d.label, detail: d.detail, rationale: d.rationale, doctor_note: d.doctorNote,
      })),
      removed_items: [...sections.supplements, ...sections.therapies, ...sections.dietary]
        .filter(i => i.status === 'removed').map(i => i.label),
      doctor_added: [...sections.supplements, ...sections.therapies, ...sections.dietary]
        .filter(i => i.status === 'added').map(i => i.label),
    }
  }, [report, sections, clinicalImpression, doctorNotes, isApproved, approvedAt])

  if (loading || shellLoading) return (<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 rounded-full border-3 border-[#538A22] border-t-transparent animate-spin" /><p className="text-sm text-slate-500">Loading review…</p></div></div>)
  if (!report || !shellReport) return null

  const rychColor = rychBadge(report.rych_tier)
  const activeSupps = sections.supplements.filter(s => s.status !== 'removed')
  const activeTherapies = sections.therapies.filter(s => s.status !== 'removed')
  const activeDietary = sections.dietary.filter(s => s.status !== 'removed')

  return (
    <SectionPageShell
      reportId={reportId}
      section="review"
      label="Doctor Review"
      patientName={report.patient_name}
      pageData={pageData}
    >
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* ── Top bar — white, no green band ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-700 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <p className="text-slate-800 font-semibold text-sm leading-tight">{report.patient_name}</p>
              <p className="text-slate-500 text-xs">{report.patient_age_sex} · Doctor Review</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${rychColor.bg} ${rychColor.border}`}>
              <span className={`text-xs font-bold ${rychColor.text}`}>Rych {report.rych_index}</span>
              <span className={`text-[10px] ${rychColor.text}`}>· {rychColor.label}</span>
            </div>
            <span className="text-slate-500 text-xs">{report.marker_count} markers flagged</span>
            <span className="text-slate-500 text-xs">{report.conditions_flagged.length} conditions</span>
          </div>
          <div className="flex items-center gap-2">
            {isApproved && !isEditMode && (<span className="text-xs text-[#538A22] hidden sm:block">✓ Approved {approvedAt ? new Date(approvedAt).toLocaleDateString() : ''}</span>)}
            {isEditMode && (<span className="text-xs text-amber-500 hidden sm:block animate-pulse">✏ Editing approved RX</span>)}
          </div>
        </div>
      </div>

      {/* Edit mode banner */}
      {isApproved && isEditMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <span className="text-amber-600 text-xs font-medium">✏ You are editing an approved prescription. Re-approve to lock changes.</span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-6 gap-5 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {report.contraindication_alerts.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2"><span>⚠</span> Contraindication Alerts</p>
              {report.contraindication_alerts.map((a, i) => (
                <div key={i} className={`text-xs rounded-lg px-3 py-2 ${a.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 font-medium border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <span className="font-semibold">{a.marker}:</span> {a.alert}
                </div>
              ))}
            </div>
          )}
          {report.conditions_flagged.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.conditions_flagged.map(c => (<span key={c} className="text-xs bg-[#E2F3D0] text-[#3D6B16] border border-[#C8E9A8] px-3 py-1 rounded-full font-medium">{c}</span>))}
            </div>
          )}
          <Section title="Supplements" icon="💊" count={activeSupps.length} onAddItem={() => addItem('supplements')} disabled={!isEditable}>
            {sections.supplements.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No supplements generated. Run the recommendations engine first.</p>
              : sections.supplements.map(item => (<ItemCard key={item.key} item={item} onToggle={key => toggleItem('supplements', key)} onNoteChange={(key, note) => updateNote('supplements', key, note)} onDetailChange={(key, detail) => updateDetail('supplements', key, detail)} disabled={!isEditable} />))}
          </Section>
          <Section title="CLP Therapies" icon="⚗️" count={activeTherapies.length} onAddItem={() => addItem('therapies')} disabled={!isEditable}>
            {sections.therapies.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No therapies generated for this Rych tier.</p>
              : sections.therapies.map(item => (<ItemCard key={item.key} item={item} onToggle={key => toggleItem('therapies', key)} onNoteChange={(key, note) => updateNote('therapies', key, note)} onDetailChange={(key, detail) => updateDetail('therapies', key, detail)} disabled={!isEditable} />))}
          </Section>
          <Section title="Dietary Protocol" icon="🥗" count={activeDietary.length} onAddItem={() => addItem('dietary')} disabled={!isEditable}>
            {sections.dietary.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No dietary protocols generated.</p>
              : sections.dietary.map(item => (<ItemCard key={item.key} item={item} onToggle={key => toggleItem('dietary', key)} onNoteChange={(key, note) => updateNote('dietary', key, note)} onDetailChange={(key, detail) => updateDetail('dietary', key, detail)} disabled={!isEditable} />))}
          </Section>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">RX Summary</p>
            <div className="space-y-2">
              {[{ label: 'Supplements', count: activeSupps.length }, { label: 'Therapies', count: activeTherapies.length }, { label: 'Dietary phases', count: activeDietary.length }, { label: 'Removed items', count: [...sections.supplements, ...sections.therapies, ...sections.dietary].filter(i => i.status === 'removed').length }, { label: 'Doctor added', count: [...sections.supplements, ...sections.therapies, ...sections.dietary].filter(i => i.status === 'added').length }].map(row => (
                <div key={row.label} className="flex justify-between text-xs"><span className="text-slate-500">{row.label}</span><span className="font-semibold text-slate-700">{row.count}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Clinical Impression</p>
            <textarea className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#538A22] focus:border-transparent placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed" rows={5} placeholder="Overall clinical assessment, key findings, treatment rationale…" value={clinicalImpression} onChange={e => setClinicalImpression(e.target.value)} disabled={!isEditable} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Doctor Notes</p>
            <textarea className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#538A22] focus:border-transparent placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed" rows={4} placeholder="Internal notes, follow-up plan, medication interactions…" value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} disabled={!isEditable} />
          </div>
          {isApproved && !isEditMode && (
            <div className="bg-[#F2F9EC] rounded-2xl border border-[#C8E9A8] p-4 text-center">
              <p className="text-xs text-[#3D6B16] font-semibold">RX Approved</p>
              {approvedAt && (<p className="text-xs text-[#538A22] mt-1">{new Date(approvedAt).toLocaleString()}</p>)}
              <p className="text-[10px] text-slate-400 mt-2">Use the Edit button below to make changes.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom action bar — white, no green band ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {saveStatus === 'saved' && (<span className="text-xs text-[#538A22] animate-pulse whitespace-nowrap">✓ Draft saved</span>)}
            {saveStatus === 'error' && (<span className="text-xs text-red-500 whitespace-nowrap">Save failed — try again</span>)}
            {isApproved && !isEditMode && saveStatus === 'idle' && (<span className="text-xs text-[#538A22] truncate">✓ Approved · {approvedAt ? new Date(approvedAt).toLocaleString() : ''}</span>)}
            {isEditMode && saveStatus === 'idle' && (<span className="text-xs text-amber-500 whitespace-nowrap">✏ Editing — re-approve to lock</span>)}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => window.open(`/report/${reportId}/prescription-print`, '_blank')} className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
            {isApproved && !isEditMode && (<button onClick={() => setIsEditMode(true)} className="px-3 py-2 text-xs font-medium rounded-lg border border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Edit RX</button>)}
            {isEditMode && (<button onClick={() => setIsEditMode(false)} className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>)}
            {isEditMode && (<button onClick={unlockForEdit} disabled={unlocking} className="px-3 py-2 text-xs font-medium rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 flex items-center gap-1.5">{unlocking ? 'Unlocking…' : '🔓 Remove Approval'}</button>)}
            {isEditable && (<button onClick={saveDraft} disabled={saving} className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button>)}
            {!isApproved ? (
              <button onClick={approveRx} disabled={approving} className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#538A22] text-white hover:bg-[#3D6B16] transition-colors disabled:opacity-50 flex items-center gap-1.5">{approving ? 'Approving…' : '✓ Approve RX'}</button>
            ) : isEditMode ? (
              <button onClick={approveRx} disabled={approving} className="px-5 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">{approving ? 'Saving…' : '✓ Re-approve RX'}</button>
            ) : (
              <span className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E2F3D0] text-[#3D6B16] border border-[#C8E9A8]">✓ Approved</span>
            )}
          </div>
        </div>
      </div>
    </div>
    </SectionPageShell>
  )
}