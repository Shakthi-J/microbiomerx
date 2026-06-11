'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { extractFromPDF } from '@/lib/extractSpecies'
import { uploadReportPdf } from '@/lib/reportPdf'
import { supabase } from '@/lib/supabase'

// ── extractDietaryViaGroq removed — was calling GROQ_API_KEY in browser (undefined)
// ── Nutrition is now extracted inside extractFromPDF via operator list (client-safe)

type PatientForm = {
  name: string
  age_sex: string
  patient_id: string
  sample_type: string
  sample_collection_date: string
  sample_received_date: string
  report_generated_date: string
}

type StepStatus = 'pending' | 'active' | 'done' | 'error'

const STEPS = [
  'Reading patient details',
  'Reading PDF pages',
  'Parsing report sections',
]

interface UploadModalProps {
  initialFile: File
  onClose: () => void
}

export default function UploadModal({ initialFile, onClose }: UploadModalProps) {
  const router = useRouter()

  const [file,         setFile]         = useState<File>(initialFile)
  const [processing,   setProcessing]   = useState(false)
  const [done,         setDone]         = useState(false)
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(['pending','pending','pending','pending'])
  const [species,      setSpecies]      = useState<string[]>([])
  const [reportData,   setReportData]   = useState<any>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [foodCount,    setFoodCount]    = useState(0)

  const [form, setForm] = useState<PatientForm>({
    name: '', age_sex: '', patient_id: '', sample_type: '',
    sample_collection_date: '', sample_received_date: '',
    report_generated_date: '',
  })

  const setStep = (i: number, s: StepStatus) =>
    setStepStatuses(prev => prev.map((v, idx) => idx === i ? s : v))

  const reset = () => {
    setDone(false); setSpecies([]); setReportData(null); setFoodCount(0)
    setError(null); setProcessing(false)
    setStepStatuses(['pending','pending','pending','pending'])
    setForm({ name:'', age_sex:'', patient_id:'', sample_type:'',
      sample_collection_date:'', sample_received_date:'', report_generated_date:'' })
  }

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith('.pdf')) { setError('Please upload a PDF file.'); return }
    setFile(f); setError(null); setProcessing(true); setDone(false)
    setSpecies([]); setReportData(null); setFoodCount(0)
    setStepStatuses(['pending','pending','pending','pending'])

    try {
      // ── Step 0: extract species + scores + nutrition (all inside extractFromPDF) ──
      setStep(0, 'active')
      const result = await extractFromPDF(f)
      setStep(0, 'done')

      // ── Step 1: validate species ───────────────────────────────────────────────
      setStep(1, 'active')
      if (result.species.length === 0) {
        setStep(1, 'error')
        setError('No species found. Make sure this is a microbiome report with selectable text.')
        setProcessing(false)
        return
      }
      setSpecies(result.species)
      setStep(1, 'done')

      // ── Step 2: report sections ────────────────────────────────────────────────
      setStep(2, 'active')
      if (result.reportData) {
        setReportData(result.reportData)
        setStep(2, 'done')
      } else {
        setStep(2, 'error')
      }

      // ── Patient form auto-fill ─────────────────────────────────────────────────
      const p = result.patient
      if (p?.name) {
        setForm(prev => ({
          ...prev,
          name:                   p.name || '',
          age_sex:                p.age_sex || '',
          patient_id:             result.reportData?.patient?.sample_id || '',
          sample_type:            result.reportData?.patient?.sample_type || 'Stool',
          sample_collection_date: result.reportData?.patient?.collection_date || '',
          sample_received_date:   result.reportData?.patient?.collection_date || '',
          report_generated_date:  result.reportData?.patient?.report_date || '',
        }))
      }

      // ── Step 3: nutrition status (extracted inside extractFromPDF already) ─────
      setStep(3, 'active')
      const nutrition = (result.reportData as any)?.nutrition
      if (nutrition && Object.keys(nutrition).length > 0) {
        const count = Object.values(nutrition as Record<string, Record<string, unknown>>)
          .reduce((s, cat) => s + Object.keys(cat).length, 0)
        setFoodCount(count)
        console.log(`[UploadModal] nutrition ready: ${count} foods across ${Object.keys(nutrition).length} categories`)
        setStep(3, 'done')
      } else {
        console.warn('[UploadModal] nutrition not extracted — operator list may be empty for this PDF')
        setStep(3, 'error')
      }

      setDone(true)

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setProcessing(false)
    }
  }, [])

  // Auto-start when modal opens
  useEffect(() => {
    handleFile(initialFile)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Patient name is required.'); return }
    if (species.length < 3) { setError('Not enough species detected.'); return }
    setSaving(true); setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      console.log('[UploadModal] saving — nutrition categories:',
        Object.keys((reportData as any)?.nutrition ?? {}).length)

      const { data, error: dbError } = await supabase
        .from('reports')
        .insert({
          doctor_id:       session.user.id,
          patient_name:    form.name,
          patient_age_sex: form.age_sex || null,
          pdf_filename:    file?.name || null,
          species_list:    species,
          species_count:   species.length,
          report_data:     reportData || null,
          nutrition_plan:  null,
        })
        .select()
        .single()

      if (dbError) throw dbError

      if (file) {
        await uploadReportPdf(data.id, file)
      }

      router.push(`/report/${data.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const StepIcon = ({ status }: { status: StepStatus }) => {
    if (status === 'done') return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#538A22' }}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
    if (status === 'active') return (
      <div className="w-5 h-5 rounded-full animate-spin flex-shrink-0"
        style={{ border: '2px solid #538A22', borderTopColor: 'transparent' }} />
    )
    if (status === 'error') return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center
        flex-shrink-0 text-xs font-bold"
        style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#D97706' }}>
        !
      </div>
    )
    return (
      <div className="w-5 h-5 rounded-full flex-shrink-0"
        style={{ border: '2px solid #E2F3D0' }} />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2F3D0] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Processing report</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-xs">{file?.name}</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none">×</button>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-3">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
              <StepIcon status={stepStatuses[i]} />
              <span className={`text-sm transition-colors
                ${stepStatuses[i] === 'done'   ? 'text-gray-700'
                : stepStatuses[i] === 'active'  ? 'text-gray-900 font-medium'
                : stepStatuses[i] === 'error'   ? 'text-amber-600'
                : 'text-gray-300'}`}>
                {label}
                {i === 3 && stepStatuses[i] === 'done' && foodCount > 0 && (
                  <span className="text-xs ml-2 text-[#538A22] font-mono">
                    {foodCount} foods
                  </span>
                )}
                {i === 3 && stepStatuses[i] === 'error' && (
                  <span className="text-xs ml-2 font-mono text-amber-500">
                    (unavailable for this report)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>


        {/* Patient form */}
        {done && (
          <div className="px-6 pb-4">
            <div className="border border-[#E2F3D0] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2F3D0] flex items-center justify-between bg-[#F2F9EC]">
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Patient details</p>
                {form.name && (
                  <span className="text-xs font-mono text-[#538A22]">auto-filled</span>
                )}
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { name:'name',                   label:'Patient name *', placeholder:'Full name'  },
                  { name:'age_sex',                label:'Age / Sex',      placeholder:'63M'        },
                  { name:'patient_id',             label:'Patient ID',     placeholder:'BS041850'   },
                  { name:'sample_type',            label:'Sample type',    placeholder:'Stool'      },
                  { name:'sample_collection_date', label:'Collection',     placeholder:'2026-05-05' },
                  { name:'report_generated_date',  label:'Report date',    placeholder:'2026-05-19' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">
                      {field.label}
                    </label>
                    <input
                      name={field.name}
                      value={form[field.name as keyof PatientForm]}
                      onChange={e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      className={`w-full border rounded-lg px-3 py-1.5 text-xs text-gray-900
                        outline-none focus:border-[#538A22] focus:ring-1 focus:ring-[#E2F3D0]
                        transition font-mono
                        ${form[field.name as keyof PatientForm]
                          ? 'bg-[#F2F9EC] border-green-200'
                          : 'bg-white border-gray-200'}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 font-mono">
              {error}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2F3D0] flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          {done && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
              style={{ backgroundColor: '#538A22' }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3D6B16' }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#538A22' }}
            >
              {saving ? 'Saving…' : `Save - ${form.name || 'patient'} →`}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
