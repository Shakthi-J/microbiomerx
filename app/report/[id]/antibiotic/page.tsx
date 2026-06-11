'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/SectionHeader'
import SectionAiPanel from '@/components/SectionAiPanel'
import SectionPageShell, { SectionLoading, SectionOverviewCard } from '@/components/SectionPageShell'
import {
  buildAiContextFields,
  type SectionReport,
  useSectionAnalysis,
  useSectionReport,
} from '@/lib/sectionPage'

const RECOVERY_REF_LOW = 65.14
const RECOVERY_REF_HIGH = 88.66

const DRUG_CLASSES: Record<string, string[]> = {
  'Beta-lactams': [
    'Amoxicillin', 'Amoxicillin+Clavulanic_Acid', 'Ampicillin', 'Ampicillin+Clavulanic_Acid',
    'Aztreonam', 'Carbapenem', 'Cefepime', 'Cefixime', 'Cefotaxime',
    'Cefotaxime+Clavulanic_Acid', 'Cefoxitin', 'Ceftazidime', 'Ceftazidime+Avibactam',
    'Ceftriaxone', 'Cephalothin', 'Cephamycin', 'Ertapenem', 'Imipenem',
    'Meropenem', 'Methicillin', 'Monobactam', 'Penicillin', 'Piperacillin',
    'Piperacillin+Tazobactam', 'Temocillin', 'Ticarcillin', 'Ticarcillin+Clavulanic_Acid',
  ],
  'Aminoglycosides': ['Amikacin', 'Gentamicin', 'Hygromycin', 'Kanamycin', 'Kasugamycin', 'Spectrumycin', 'Streptomycin', 'Tobramycin'],
  'Macrolides': ['Azithromycin', 'Carbomycin', 'Erythromycin', 'Oleandomycin', 'Spiramycin', 'Telithromycin', 'Tylosin'],
  'Tetracyclines': ['Doxycycline', 'Glycylcycline', 'Minocycline', 'Tetracenomycin', 'Tetracycline', 'Tigecycline'],
  'Fluoroquinolones': ['Ciprofloxacin', 'Nalidixic_Acid'],
  'Glycopeptides': ['Teicoplanin', 'Vancomycin'],
  'Lincosamides': ['Clindamycin', 'Lincomycin', 'Lincosamide'],
  'Oxazolidinones': ['Linezolid'],
  'Streptogramins': ['Dalfopristin', 'Pristinamycin', 'Quinupristin', 'Quinupristin+Dalfopristin', 'Virginiamycin_M', 'Virginiamycin_S'],
  'Rifamycins': ['Rifampin', 'Rifamycin'],
  'Polymyxins': ['Colistin'],
  'Others': [
    'Aminocoumarin', 'Avilamycin', 'Benzalkonium_Chloride', 'Bicyclomycin',
    'Bleomycin', 'Diaminopyrimidine', 'Elfamycin', 'Florfenicol', 'Fosfomycin',
    'Fusidic_Acid', 'Isoniazid', 'Mupirocin', 'Nitrofuran', 'Nitroimidazole',
    'Phenicol', 'Pleuromutilin', 'Rhodamine', 'Streptothricin', 'Sulfamethoxazole',
    'Thiostrepton', 'Tiamulin', 'Triclosan', 'Trimethoprim', 'Viomycin', 'Zorbamycin',
  ],
}

type ResistanceEntry = {
  name: string
  status: string
  cls: string
  isResistant: boolean
}

type RecoveryStatus = 'low' | 'high' | 'optimal' | 'unknown'

function getStringField(rd: Record<string, unknown> | null, key: string): string | null {
  const value = rd?.[key]
  return typeof value === 'string' ? value : null
}

function getNumberField(rd: Record<string, unknown> | null, key: string): number | null {
  const value = rd?.[key]
  return typeof value === 'number' ? value : null
}

function getResistanceMap(rd: Record<string, unknown> | null): Record<string, string> {
  const value = rd?.antibiotic_resistance
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, status]) => typeof status === 'string')
      .map(([name, status]) => [name, status as string]),
  )
}

function getDrugClass(name: string): string {
  return Object.entries(DRUG_CLASSES).find(([, names]) => names.includes(name))?.[0] || 'Others'
}

function buildResistanceEntries(resistanceMap: Record<string, string>): ResistanceEntry[] {
  return Object.entries(resistanceMap)
    .map(([name, status]) => ({
      name,
      status,
      cls: getDrugClass(name),
      isResistant: status === 'Resistant',
    }))
    .sort((a, b) => {
      if (a.isResistant !== b.isResistant) return a.isResistant ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

function getRecoveryStatus(recoveryScore: number | null, recoveryTag: string | null): RecoveryStatus {
  if (recoveryScore != null) {
    if (recoveryScore < RECOVERY_REF_LOW) return 'low'
    if (recoveryScore > RECOVERY_REF_HIGH) return 'high'
    return 'optimal'
  }
  if (recoveryTag === 'Ideal') return 'optimal'
  if (recoveryTag === 'Non-Ideal') return 'low'
  return 'unknown'
}

function buildAntibioticData(rd: Record<string, unknown> | null) {
  const resistanceMap = getResistanceMap(rd)
  const allEntries = buildResistanceEntries(resistanceMap)
  const resistantEntries = allEntries.filter(entry => entry.isResistant)
  const sensitiveEntries = allEntries.filter(entry => !entry.isResistant)
  const resistanceTag = getStringField(rd, 'antibiotic_resistance_tag')
  const recoveryTag = getStringField(rd, 'antibiotic_recovery_tag')
  const recoveryScore = getNumberField(rd, 'antibiotic_recovery')
  const recoveryStatus = getRecoveryStatus(recoveryScore, recoveryTag)

  return {
    allEntries,
    resistantEntries,
    sensitiveEntries,
    resistanceTag,
    recoveryTag,
    recoveryScore,
    recoveryStatus,
    totalCount: allEntries.length,
    hasNoData: allEntries.length === 0 && recoveryScore == null && !recoveryTag,
  }
}

function RecoveryBar({ score, refLow, refHigh }: { score: number; refLow: number; refHigh: number }) {
  const max = refHigh * 1.25
  const isLow = score < refLow
  const isHigh = score > refHigh
  const isOptimal = !isLow && !isHigh
  const scorePct = Math.min((score / max) * 100, 100)
  const refLowPct = (refLow / max) * 100
  const refHighPct = (refHigh / max) * 100
  const barColor = isOptimal ? '#16A34A' : isHigh ? '#DC2626' : '#F59E0B'

  return (
    <div className="mt-4">
      <div className="relative h-7 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-green-100 border-l-2 border-r-2 border-green-400"
          style={{ left: `${refLowPct}%`, width: `${refHighPct - refLowPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-700"
          style={{ width: `${scorePct}%`, backgroundColor: barColor }}
        />
        <span className="absolute inset-0 flex items-center justify-end pr-3 text-sm font-bold text-white">
          {score.toFixed(3)}
        </span>
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
        <span>0</span>
        <span className="text-green-700 font-medium">Ref: {refLow} – {refHigh}</span>
        <span>{max.toFixed(0)}</span>
      </div>
    </div>
  )
}

export default function AntibioticsPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [search, setSearch] = useState('')
  const [activeClass, setActiveClass] = useState('All')
  const [activeTab, setActiveTab] = useState<'resistance' | 'recovery'>('resistance')
  const [viewMode, setViewMode] = useState<'split' | 'all'>('split')

  const getSectionData = useMemo(
    () => (rep: SectionReport) => {
      const data = buildAntibioticData(rep.report_data)
      return {
        recovery_score: data.recoveryScore,
        recovery_ref_low: RECOVERY_REF_LOW,
        recovery_ref_high: RECOVERY_REF_HIGH,
        recovery_tag: data.recoveryTag,
        recovery_status: data.recoveryStatus,
        resistance_tag: data.resistanceTag,
        total_antibiotics: data.totalCount,
        resistant_count: data.resistantEntries.length,
        sensitive_count: data.sensitiveEntries.length,
        resistant_antibiotics: data.resistantEntries.map(entry => ({ name: entry.name, class: entry.cls })),
      }
    },
    [],
  )

  const antibioticData = report ? buildAntibioticData(report.report_data) : null
  const hasData = antibioticData != null && !antibioticData.hasNoData

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'antibiotic_resistance_recovery',
    getSectionData,
    hasData,
  )

  if (loading) return <SectionLoading />
  if (!report || !antibioticData) return null

  const {
    allEntries,
    resistantEntries,
    sensitiveEntries,
    resistanceTag,
    recoveryTag,
    recoveryScore,
    recoveryStatus,
    totalCount,
    hasNoData,
  } = antibioticData

  const filtered = allEntries.filter(entry => {
    const matchClass = activeClass === 'All' || entry.cls === activeClass
    const matchSearch = entry.name.toLowerCase().replace(/_/g, ' ').includes(search.toLowerCase())
    return matchClass && matchSearch
  })
  const filteredResistant = filtered.filter(entry => entry.isResistant)
  const filteredSensitive = filtered.filter(entry => !entry.isResistant)

  const pageData = {
    active_tab: activeTab,
    resistant_count: resistantEntries.length,
    sensitive_count: sensitiveEntries.length,
    total_antibiotics: totalCount,
    resistance_tag: resistanceTag,
    recovery_score: recoveryScore,
    recovery_tag: recoveryTag,
    recovery_status: recoveryStatus,
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="antibiotic"
      label="Antibiotic Resistance & Recovery"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Antibiotic Resistance & Recovery" />

      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          Identifies acquired resistance genes present within your overall gut microbiome rather than testing specific pathogens.
          These results provide an overview to help your clinician make more informed, data-driven decisions regarding antibiotic selection.
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
          ⚠️ This screening identifies <strong>acquired resistance genes</strong> from metagenomic sequencing — not equivalent to standard AST/MIC testing. Results should be interpreted alongside clinical presentation and validated microbiology data before treatment decisions.
        </div>

        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 shadow-sm w-fit">
          {(['resistance', 'recovery'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium px-5 py-2 rounded-lg transition-colors ${
                activeTab === tab ? 'bg-[#538A22] text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'resistance' ? ' Antibiotic Resistance' : ' Recovery Potential'}
            </button>
          ))}
        </div>

        {activeTab === 'resistance' && (
          <>
            {!hasNoData && (
              <SectionOverviewCard
                stats={[
                  {
                    label: 'Resistant',
                    value: String(resistantEntries.length),
                    tone: resistantEntries.length > 0 ? 'amber' : 'green',
                  },
                  {
                    label: 'Sensitive',
                    value: String(sensitiveEntries.length),
                    tone: 'green',
                  },
                  {
                    label: resistanceTag ? `Tracked · ${resistanceTag}` : 'Tracked',
                    value: String(totalCount),
                    tone: 'blue',
                  },
                ]}
              />
            )}

            {resistantEntries.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-3">
                  ⚠ {resistantEntries.length} antibiotic resistance gene{resistantEntries.length > 1 ? 's' : ''} detected — clinical review recommended
                </p>
                <div className="flex flex-wrap gap-2">
                  {resistantEntries.map(entry => (
                    <span key={entry.name} className="text-xs font-medium px-3 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-300">
                      {entry.name.replace(/_/g, ' ')} <span className="text-orange-500 font-normal">· {entry.cls}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {resistantEntries.length === 0 && totalCount > 0 && (
              <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="text-sm font-semibold text-[#1A3207]">No antibiotic resistance genes detected</p>
                  <p className="text-xs text-[#538A22] mt-0.5">All {totalCount} tracked antibiotics show Sensitive status</p>
                </div>
              </div>
            )}

            {hasNoData && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                No antibiotic resistance data found. Re-upload the PDF to extract resistance profile.
              </p>
            )}

            {!hasNoData && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search antibiotic..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#538A22] w-48"
                  />
                  <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
                    {(['split', 'all'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`text-xs px-3 py-1 rounded-md font-medium transition ${viewMode === mode ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                      >
                        {mode === 'split' ? '⚡ Split view' : '☰ Full list'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['All', ...Object.keys(DRUG_CLASSES)].map(cls => (
                      <button
                        key={cls}
                        onClick={() => setActiveClass(cls)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium ${
                          activeClass === cls ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                {viewMode === 'split' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-orange-800">⚠ Resistant</span>
                        <span className="text-xs text-orange-600 font-medium bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                          {filteredResistant.length}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                        {filteredResistant.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-gray-400 italic text-center">None detected ✓</p>
                        ) : (
                          filteredResistant.map(entry => (
                            <div key={entry.name} className="px-4 py-2.5 flex items-center justify-between gap-3 bg-orange-50">
                              <div>
                                <p className="text-sm font-medium text-orange-900">{entry.name.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-orange-500">{entry.cls}</p>
                              </div>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-200 text-orange-800 border border-orange-300 shrink-0">
                                Resistant
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#C8E9A8] shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-[#F2F9EC] border-b border-[#E2F3D0] flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#3D6B16]">✓ Sensitive</span>
                        <span className="text-xs text-[#538A22] font-medium bg-[#E2F3D0] px-2 py-0.5 rounded-full border border-[#A8D878]">
                          {filteredSensitive.length}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                        {filteredSensitive.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-gray-400 italic text-center">No results</p>
                        ) : (
                          filteredSensitive.map(entry => (
                            <div key={entry.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-gray-700">{entry.name.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-gray-400">{entry.cls}</p>
                              </div>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E2F3D0] text-[#3D6B16] border border-[#A8D878] shrink-0">
                                Sensitive
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'all' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">All Antibiotics</span>
                      <span className="text-xs text-gray-400">{filtered.length} shown</span>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                      {filtered.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-gray-400 italic">No antibiotics match your search.</p>
                      ) : (
                        filtered.map(entry => (
                          <div key={entry.name} className={`px-5 py-2.5 flex items-center justify-between gap-4 ${entry.isResistant ? 'bg-orange-50' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.isResistant ? 'bg-orange-500' : 'bg-[#8BC44F]'}`} />
                              <div>
                                <p className={`text-sm font-medium ${entry.isResistant ? 'text-orange-900' : 'text-gray-700'}`}>
                                  {entry.name.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-gray-400">{entry.cls}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                              entry.isResistant
                                ? 'bg-orange-100 text-orange-800 border-orange-300'
                                : 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]'
                            }`}>
                              {entry.isResistant ? 'Resistant' : 'Sensitive'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'recovery' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 mb-1">
                <h2 className="font-semibold text-gray-800">Antibiotic Recovery Potential</h2>
                {recoveryTag && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                    recoveryTag === 'Ideal' ? 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]' :
                    recoveryTag === 'Non-Ideal' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>{recoveryTag}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-1">Handbook Page No. 21</p>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Antibiotics are known to disrupt the microbiota ecosystem dramatically. Research suggests that recovery of the
                microbial ecosystem may be dependent on a few species of bacteria among other factors.
              </p>

              {recoveryScore != null ? (
                <RecoveryBar score={recoveryScore} refLow={RECOVERY_REF_LOW} refHigh={RECOVERY_REF_HIGH} />
              ) : (
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500">
                    {recoveryTag
                      ? `Recovery potential: ${recoveryTag} (numeric score not found in this report)`
                      : 'Recovery score not found — re-upload PDF to extract data'}
                  </p>
                </div>
              )}

              {(recoveryScore != null || recoveryTag) && (
                <div className={`mt-4 rounded-xl border p-4 text-sm leading-relaxed ${
                  recoveryStatus === 'optimal' ? 'bg-[#F2F9EC] border-[#C8E9A8] text-[#3D6B16]' :
                  recoveryStatus === 'high' ? 'bg-red-50 border-red-200 text-red-700' :
                  recoveryStatus === 'low' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                  'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  {recoveryStatus === 'optimal' && (
                    <>
                      ✓ <strong>Good recovery potential.</strong> Score is within the healthy reference range ({RECOVERY_REF_LOW}–{RECOVERY_REF_HIGH}).
                      The microbiome has sufficient resilience to recover well post-antibiotic treatment. Probiotic supplementation during the course is still recommended.
                    </>
                  )}
                  {recoveryStatus === 'low' && (
                    <>
                      ⚠ <strong>Below reference range.</strong> Score ({recoveryScore?.toFixed(3)}) is below the healthy range ({RECOVERY_REF_LOW}–{RECOVERY_REF_HIGH}).
                      The microbiome may struggle to recover after antibiotics. Strong probiotic and prebiotic support during and after the course is recommended.
                    </>
                  )}
                  {recoveryStatus === 'high' && (
                    <>
                      ↑ <strong>Above reference range.</strong> Score ({recoveryScore?.toFixed(3)}) is above the healthy upper limit ({RECOVERY_REF_HIGH}).
                      Clinical correlation recommended.
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3">What Affects Recovery Potential</h3>
              <div className="space-y-3">
                {[
                  { title: 'Keystone species', desc: 'Higher abundance of Faecalibacterium prausnitzii, Akkermansia muiniphila, and Lactobacillus species correlates with faster microbiome recovery.' },
                  { title: 'Dietary fibre', desc: 'Varied fibre intake feeds surviving microbes and accelerates ecosystem building. Target 25–30g fibre/day during and after antibiotic treatment.' },
                  { title: 'Probiotic supplementation', desc: 'Multi-strain probiotics (Lactobacillus + Bifidobacterium) taken 2 hours apart from antibiotics significantly improve recovery speed.' },
                  { title: 'Antibiotic class & duration', desc: 'Broad-spectrum antibiotics (fluoroquinolones, carbapenems) cause deeper dysbiosis requiring longer recovery than narrow-spectrum alternatives.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-[#F2F9EC] border border-[#E2F3D0]">
                    <div>
                      <p className="text-sm font-medium text-[#1A3207]">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Support Protocol</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  {
                    phase: 'During antibiotic course',
                    color: 'border-amber-200 bg-amber-50',
                    tc: 'text-amber-700',
                    items: ['Take probiotics 2h apart from antibiotics', 'Increase dietary fibre (oats, legumes, vegetables)', 'Eat fermented foods: yoghurt, kefir, kimchi', 'Avoid alcohol and ultra-processed foods', 'Stay well hydrated (2L+ water/day)'],
                  },
                  {
                    phase: 'After antibiotic course',
                    color: 'border-[#C8E9A8] bg-[#F2F9EC]',
                    tc: 'text-[#538A22]',
                    items: ['Continue probiotics 4–8 weeks post-course', 'Prebiotic foods: garlic, onion, banana, oats', 'Fermented foods: kefir, sauerkraut, yoghurt', 'Monitor for C. diff symptoms (diarrhoea, fever)', 'Consider retesting microbiome after 3 months'],
                  },
                ].map(({ phase, color, tc, items }) => (
                  <div key={phase} className={`rounded-xl border p-4 ${color}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-2.5 ${tc}`}>{phase}</p>
                    <ul className="space-y-1.5">
                      {items.map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="text-[#538A22] flex-shrink-0 mt-0.5">→</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasData && (
          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            subtitle="Resistance profile and recovery potential interpretation"
          />
        )}
      </div>
    </SectionPageShell>
  )
}
