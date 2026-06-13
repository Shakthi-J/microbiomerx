'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
interface Section {
  key: string
  label: string
  detail: string
  rationale: string
  doctorNote: string
  status: 'kb' | 'modified' | 'added' | 'removed'
  category?: string
  phase?: string
  contraindications?: string
}

interface PrescriptionData {
  patient_name: string
  patient_age_sex: string
  rych_index: number
  rych_tier_label: string
  conditions_flagged: string[]
  contraindication_alerts: Array<{ marker: string; alert: string; severity: string }>
  sections: {
    supplements: Section[]
    therapies: Section[]
    dietary: Section[]
  }
  clinical_impression: string
  doctor_notes: string
  approved_at: string | null
  approved_by: string | null
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function rychColor(tier: string) {
  if (tier === 'Severe')   return '#B91C1C'
  if (tier === 'Moderate') return '#B45309'
  return '#166534'
}

// ─────────────────────────────────────────────────────────────────
// PRINT PAGE
// ─────────────────────────────────────────────────────────────────
export default function PrescriptionPrintPage() {
  const params = useParams()
  const reportId = params.id as string
  const [data, setData] = useState<PrescriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      // Load report
      const { data: rep } = await supabase
        .from('reports')
        .select('patient_name, patient_age_sex, rules_output')
        .eq('id', reportId)
        .single()

      if (!rep) { setError('Report not found'); setLoading(false); return }

      // Load prescription
      const { data: rx } = await supabase
        .from('prescriptions')
        .select('rx_data, approved_at, approved_by')
        .eq('report_id', reportId)
        .maybeSingle()

      const ro = rep.rules_output as any
      const rxData = rx?.rx_data as any

      // Build sections from prescription rx_data (doctor's saved version)
      // or fall back to rules_output
      const sections = rxData?.sections ?? {
        supplements: (ro?.supplements ?? []).map((s: any, i: number) => ({
          key: `supp_${i}`, label: s.product_name,
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
          key: `diet_${i}`, label: `${d.condition_name} — ${d.phase}`,
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
        clinical_impression: rxData?.clinical_impression || '',
        doctor_notes:        rxData?.doctor_notes || '',
        approved_at:         rx?.approved_at ?? null,
        approved_by:         rx?.approved_by ?? null,
      })
      setLoading(false)
    }
    load()
  }, [reportId])

  // Auto-print once loaded
  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => window.print(), 600)
    }
  }, [loading, data])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Georgia, serif' }}>
      <p>Preparing prescription plan…</p>
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: 40, fontFamily: 'Georgia, serif' }}>
      <p>Error: {error || 'Could not load prescription'}</p>
    </div>
  )

  const activeSupps    = data.sections.supplements.filter(s => s.status !== 'removed')
  const activeTherapies = data.sections.therapies.filter(s => s.status !== 'removed')
  const activeDietary  = data.sections.dietary.filter(s => s.status !== 'removed')

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Georgia', serif; background: #fff; color: #1a1a1a; }

        .page {
          max-width: 780px;
          margin: 0 auto;
          padding: 40px 48px;
        }

        /* ── Header ── */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #1A3207;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .clinic-name {
          font-size: 11px;
          font-family: Arial, sans-serif;
          font-weight: bold;
          letter-spacing: 1.5px;
          color: #1A3207;
          text-transform: uppercase;
        }
        .doc-title {
          font-size: 20px;
          font-weight: normal;
          color: #1A3207;
          letter-spacing: 0.5px;
        }
        .confidential {
          font-size: 9px;
          font-family: Arial, sans-serif;
          color: #888;
          text-align: right;
          margin-top: 4px;
        }

        /* ── Patient card ── */
        .patient-card {
          background: #F2F9EC;
          border: 1px solid #C8E9A8;
          border-radius: 8px;
          padding: 16px 20px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }
        .patient-field label {
          font-size: 9px;
          font-family: Arial, sans-serif;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #538A22;
          display: block;
          margin-bottom: 3px;
        }
        .patient-field p {
          font-size: 14px;
          font-weight: bold;
          color: #1A3207;
        }
        .rych-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 14px;
        }

        /* ── Contraindications ── */
        .alert-box {
          border: 1.5px solid #FCA5A5;
          background: #FEF2F2;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 20px;
        }
        .alert-box h4 {
          font-size: 10px;
          font-family: Arial, sans-serif;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #B91C1C;
          margin-bottom: 8px;
        }
        .alert-item {
          font-size: 11px;
          color: #7F1D1D;
          margin-bottom: 4px;
          padding-left: 12px;
          position: relative;
        }
        .alert-item::before { content: '⚠ '; position: absolute; left: 0; }

        /* ── Conditions ── */
        .conditions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 24px;
        }
        .condition-tag {
          font-size: 10px;
          font-family: Arial, sans-serif;
          background: #E2F3D0;
          border: 1px solid #C8E9A8;
          color: #2A4D0D;
          padding: 3px 10px;
          border-radius: 20px;
        }

        /* ── Section ── */
        .section {
          margin-bottom: 28px;
          page-break-inside: avoid;
        }
        .section-header {
          background: #1A3207;
          color: white;
          padding: 8px 14px;
          border-radius: 6px 6px 0 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .section-header h3 {
          font-size: 11px;
          font-family: Arial, sans-serif;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-weight: bold;
        }
        .section-header .count {
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          padding: 1px 8px;
          font-size: 10px;
          font-family: Arial, sans-serif;
        }
        .section-body {
          border: 1px solid #C8E9A8;
          border-top: none;
          border-radius: 0 0 6px 6px;
          overflow: hidden;
        }

        /* ── Item rows ── */
        .item {
          padding: 12px 16px;
          border-bottom: 1px solid #E2F3D0;
        }
        .item:last-child { border-bottom: none; }
        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 4px;
        }
        .item-name {
          font-size: 13px;
          font-weight: bold;
          color: #1A3207;
          flex: 1;
        }
        .item-badges {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }
        .badge {
          font-size: 9px;
          font-family: Arial, sans-serif;
          padding: 2px 7px;
          border-radius: 3px;
        }
        .badge-category { background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; }
        .badge-phase { background: #F2F9EC; color: #538A22; border: 1px solid #C8E9A8; }
        .badge-added { background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; }
        .badge-modified { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }

        .item-detail {
          font-size: 11px;
          color: #374151;
          margin-bottom: 4px;
          font-family: Arial, sans-serif;
        }
        .item-rationale {
          font-size: 10px;
          color: #6B7280;
          border-left: 2px solid #C8E9A8;
          padding-left: 8px;
          line-height: 1.5;
          font-style: italic;
          margin-bottom: 4px;
        }
        .item-contraindication {
          font-size: 10px;
          color: #B91C1C;
          font-family: Arial, sans-serif;
          margin-top: 4px;
        }
        .item-doctor-note {
          font-size: 10px;
          color: #1A3207;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          border-radius: 4px;
          padding: 4px 8px;
          margin-top: 6px;
          font-family: Arial, sans-serif;
        }
        .item-doctor-note::before { content: '📝 Dr. Note: '; font-weight: bold; }

        /* ── Clinical notes ── */
        .notes-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }
        .notes-box {
          border: 1px solid #E5E7EB;
          border-radius: 6px;
          overflow: hidden;
        }
        .notes-box h4 {
          background: #F9FAFB;
          padding: 8px 12px;
          font-size: 9px;
          font-family: Arial, sans-serif;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #6B7280;
          border-bottom: 1px solid #E5E7EB;
        }
        .notes-box p {
          padding: 10px 12px;
          font-size: 11px;
          color: #374151;
          line-height: 1.6;
          min-height: 60px;
        }

        /* ── Footer ── */
        .footer {
          border-top: 1px solid #C8E9A8;
          padding-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .footer-left p {
          font-size: 10px;
          font-family: Arial, sans-serif;
          color: #6B7280;
          margin-bottom: 3px;
        }
        .approval-stamp {
          border: 2px solid #1A3207;
          border-radius: 6px;
          padding: 8px 16px;
          text-align: center;
        }
        .approval-stamp .approved-text {
          font-size: 11px;
          font-family: Arial, sans-serif;
          font-weight: bold;
          color: #1A3207;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .approval-stamp .approved-date {
          font-size: 10px;
          font-family: Arial, sans-serif;
          color: #538A22;
          margin-top: 2px;
        }
        .pending-stamp {
          border: 2px dashed #D1D5DB;
          border-radius: 6px;
          padding: 8px 16px;
          text-align: center;
        }
        .pending-stamp p {
          font-size: 10px;
          font-family: Arial, sans-serif;
          color: #9CA3AF;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* ── Print media ── */
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .page { padding: 20px 28px; max-width: 100%; }
          .no-print { display: none !important; }
          .section { page-break-inside: avoid; }
          @page { margin: 15mm; size: A4; }
        }

        /* ── Print button (screen only) ── */
        .print-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          background: #1A3207;
          padding: 10px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
        }
        .print-bar p { font-size: 13px; font-family: Arial, sans-serif; color: #A8D878; }
        .print-btn {
          background: #538A22;
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-family: Arial, sans-serif;
          font-weight: bold;
          cursor: pointer;
        }
        .print-btn:hover { background: #3D6B16; }
        @media print { .print-bar { display: none; } .page { padding-top: 20px; } }
      `}</style>

      {/* Print bar — screen only */}
      <div className="print-bar no-print">
        <p>Prescription Plan — {data.patient_name}</p>
        <button className="print-btn" onClick={() => window.print()}>
          ⬇ Download / Print PDF
        </button>
      </div>

      <div className="page" style={{ marginTop: 52 }}>

        {/* Header */}
        <div className="header">
          <div>
            <p className="clinic-name">Clinic Living Plus · Gut Microbiome Report</p>
            <h1 className="doc-title">Prescription Plan</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#6B7280' }}>
              Date: {formatDate(new Date().toISOString())}
            </p>
            <p className="confidential">CONFIDENTIAL · FOR PHYSICIAN USE ONLY · NOT A PRESCRIPTION</p>
          </div>
        </div>

        {/* Patient card */}
        <div className="patient-card">
          <div className="patient-field">
            <label>Patient</label>
            <p>{data.patient_name}</p>
          </div>
          <div className="patient-field">
            <label>Age / Sex</label>
            <p>{data.patient_age_sex || '—'}</p>
          </div>
          <div className="patient-field">
            <label>Rych Index</label>
            <p>
              <span className="rych-badge" style={{ color: rychColor(data.rych_tier_label), background: rychColor(data.rych_tier_label) + '20' }}>
                {data.rych_index} — {data.rych_tier_label}
              </span>
            </p>
          </div>
        </div>

        {/* Contraindication alerts */}
        {data.contraindication_alerts.length > 0 && (
          <div className="alert-box">
            <h4>⚠ Contraindication Alerts — Review Before Prescribing</h4>
            {data.contraindication_alerts.map((a, i) => (
              <p key={i} className="alert-item">
                <strong>{a.marker}:</strong> {a.alert}
              </p>
            ))}
          </div>
        )}

        {/* Conditions */}
        {data.conditions_flagged.length > 0 && (
          <div className="conditions">
            {data.conditions_flagged.map(c => (
              <span key={c} className="condition-tag">{c}</span>
            ))}
          </div>
        )}

        {/* Supplements */}
        {activeSupps.length > 0 && (
          <div className="section">
            <div className="section-header">
              <span>💊</span>
              <h3>Supplements</h3>
              <span className="count">{activeSupps.length}</span>
            </div>
            <div className="section-body">
              {activeSupps.map(item => (
                <div key={item.key} className="item">
                  <div className="item-header">
                    <span className="item-name">{item.label}</span>
                    <div className="item-badges">
                      {item.category && <span className="badge badge-category">{item.category}</span>}
                      {item.phase && <span className="badge badge-phase">{item.phase}</span>}
                      {item.status === 'added' && <span className="badge badge-added">Doctor Added</span>}
                      {item.status === 'modified' && <span className="badge badge-modified">Modified</span>}
                    </div>
                  </div>
                  {item.detail && <p className="item-detail">{item.detail}</p>}
                  {item.rationale && <p className="item-rationale">{item.rationale}</p>}
                  {item.contraindications && (
                    <p className="item-contraindication">⚠ {item.contraindications}</p>
                  )}
                  {item.doctorNote && (
                    <p className="item-doctor-note">{item.doctorNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Therapies */}
        {activeTherapies.length > 0 && (
          <div className="section">
            <div className="section-header">
              <span>⚗️</span>
              <h3>CLP Therapies</h3>
              <span className="count">{activeTherapies.length}</span>
            </div>
            <div className="section-body">
              {activeTherapies.map(item => (
                <div key={item.key} className="item">
                  <div className="item-header">
                    <span className="item-name">{item.label}</span>
                    <div className="item-badges">
                      {item.category && <span className="badge badge-category">{item.category}</span>}
                      {item.phase && <span className="badge badge-phase">{item.phase}</span>}
                    </div>
                  </div>
                  {item.detail && <p className="item-detail">{item.detail}</p>}
                  {item.rationale && <p className="item-rationale">{item.rationale}</p>}
                  {item.contraindications && (
                    <p className="item-contraindication">⚠ {item.contraindications}</p>
                  )}
                  {item.doctorNote && (
                    <p className="item-doctor-note">{item.doctorNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dietary */}
        {activeDietary.length > 0 && (
          <div className="section">
            <div className="section-header">
              <span>🥗</span>
              <h3>Dietary Protocol</h3>
              <span className="count">{activeDietary.length}</span>
            </div>
            <div className="section-body">
              {activeDietary.map(item => (
                <div key={item.key} className="item">
                  <div className="item-header">
                    <span className="item-name">{item.label}</span>
                    <div className="item-badges">
                      {item.phase && <span className="badge badge-phase">{item.phase}</span>}
                    </div>
                  </div>
                  {item.detail && <p className="item-detail">{item.detail}</p>}
                  {item.rationale && <p className="item-rationale">{item.rationale}</p>}
                  {item.doctorNote && (
                    <p className="item-doctor-note">{item.doctorNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical notes */}
        {(data.clinical_impression || data.doctor_notes) && (
          <div className="notes-grid">
            {data.clinical_impression && (
              <div className="notes-box">
                <h4>Clinical Impression</h4>
                <p>{data.clinical_impression}</p>
              </div>
            )}
            {data.doctor_notes && (
              <div className="notes-box">
                <h4>Doctor Notes</h4>
                <p>{data.doctor_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <div className="footer-left">
            <p>Clinic Living Plus · Gut Management Programme</p>
            <p>Generated: {formatDate(new Date().toISOString())}</p>
            <p style={{ marginTop: 6, fontSize: 9, color: '#9CA3AF' }}>
              This document is for physician review only. Not a patient-facing prescription.
              Clinical judgment, medication interactions and patient context must be assessed.
            </p>
          </div>
          <div>
            {data.approved_at ? (
              <div className="approval-stamp">
                <p className="approved-text">✓ Approved</p>
                <p className="approved-date">{formatDate(data.approved_at)}</p>
              </div>
            ) : (
              <div className="pending-stamp">
                <p>Pending Approval</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}