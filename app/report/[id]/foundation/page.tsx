'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SectionHeader } from '@/components/SectionHeader'
import SectionAiPanel from '@/components/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/sectionPage'

// Keystone species with their clinical roles
const KEYSTONE_SPECIES: Record<string, {
  role: string
  produces: string
  importance: 'critical' | 'high' | 'moderate'
  color: string
}> = {
  'Faecalibacterium prausnitzii': {
    role: 'Master butyrate producer and anti-inflammatory keystone',
    produces: 'Butyrate, anti-inflammatory compounds',
    importance: 'critical',
    color: 'green',
  },
  'Akkermansia muciniphila': {
    role: 'Gut barrier specialist and mucin layer maintainer',
    produces: 'Propionate, barrier-strengthening signals',
    importance: 'critical',
    color: 'green',
  },
  'Bifidobacterium longum': {
    role: 'Immune modulator and GABA producer',
    produces: 'GABA, acetate, B vitamins',
    importance: 'critical',
    color: 'blue',
  },
  'Bifidobacterium adolescentis': {
    role: 'Prebiotic fibre degrader and acetate producer',
    produces: 'Acetate, lactate',
    importance: 'high',
    color: 'blue',
  },
  'Roseburia intestinalis': {
    role: 'Butyrate producer feeding colonocytes',
    produces: 'Butyrate',
    importance: 'high',
    color: 'green',
  },
  'Roseburia inulinivorans': {
    role: 'Inulin fermenter and butyrate producer',
    produces: 'Butyrate, propionate',
    importance: 'high',
    color: 'green',
  },
  'Roseburia faecis': {
    role: 'Resistant starch fermenter',
    produces: 'Butyrate',
    importance: 'high',
    color: 'green',
  },
  'Ruminococcus bromii': {
    role: 'Resistant starch degrader - keystone crossfeeder',
    produces: 'Acetate (feeds other butyrate producers)',
    importance: 'critical',
    color: 'amber',
  },
  'Prevotella copri': {
    role: 'Plant fibre degrader - can be pro or anti-inflammatory',
    produces: 'Propionate, SCFA',
    importance: 'high',
    color: 'purple',
  },
  'Bacteroides thetaiotaomicron': {
    role: 'Polysaccharide degrader and community anchor',
    produces: 'Propionate, acetate, vitamins',
    importance: 'high',
    color: 'blue',
  },
  'Bacteroides vulgatus': {
    role: 'Fibre degrader with immune modulatory effects',
    produces: 'Propionate, acetate',
    importance: 'moderate',
    color: 'blue',
  },
  'Anaerostipes hadrus': {
    role: 'Lactate consumer and butyrate producer',
    produces: 'Butyrate via lactate cross-feeding',
    importance: 'high',
    color: 'green',
  },
  'Eubacterium hallii': {
    role: 'Butyrate and propionate producer',
    produces: 'Butyrate, propionate',
    importance: 'high',
    color: 'green',
  },
  'Coprococcus comes': {
    role: 'Butyrate producer linked to mental health',
    produces: 'Butyrate, dopamine precursors',
    importance: 'high',
    color: 'purple',
  },
  'Gemmiger formicilis': {
    role: 'Mucosal community stabiliser',
    produces: 'SCFA',
    importance: 'moderate',
    color: 'amber',
  },
}

const IMPORTANCE_STYLE = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  high:     'bg-amber-50 border-amber-200 text-amber-700',
  moderate: 'bg-blue-50 border-blue-200 text-blue-700',
}

const COLOR_MAP: Record<string, string> = {
  green:  'bg-[#F2F9EC] border-[#C8E9A8]',
  blue:   'bg-blue-50 border-blue-200',
  amber:  'bg-amber-50 border-amber-200',
  purple: 'bg-purple-50 border-purple-200',
  red:    'bg-red-50 border-red-200',
}

export default function FoundationMicrobiotaPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [filter, setFilter] = useState<'all' | 'critical' | 'present' | 'absent'>('all')

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null; species_list?: string[] }) => ({
      species_present: rep.species_list,
      keystone_present: rep.species_list?.filter(s =>
        Object.keys(KEYSTONE_SPECIES).some(k =>
          s.toLowerCase().includes(k.toLowerCase().split(' ')[0])
        )
      ),
      rych_index: rep.report_data?.rych_index,
      scfa: rep.report_data?.scfa,
    }),
    []
  )

  const hasData = (report?.species_list?.length ?? 0) > 0

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Foundation Microbiota',
    getSectionData,
    hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const speciesList = report.species_list || []

  // Check which keystone species are present
  const keystoneStatus = Object.entries(KEYSTONE_SPECIES).map(([name, info]) => {
    const present = speciesList.some(s =>
      s.toLowerCase().includes(name.toLowerCase().split(' ')[0].toLowerCase()) &&
      s.toLowerCase().includes(name.toLowerCase().split(' ')[1]?.toLowerCase() || '')
    )
    return { name, ...info, present }
  })

  const presentCount = keystoneStatus.filter(s => s.present).length
  const absentCount = keystoneStatus.filter(s => !s.present).length
  const criticalAbsent = keystoneStatus.filter(s => !s.present && s.importance === 'critical')

  const filtered = keystoneStatus.filter(s => {
    if (filter === 'all') return true
    if (filter === 'critical') return s.importance === 'critical'
    if (filter === 'present') return s.present
    if (filter === 'absent') return !s.present
    return true
  })

  const pageData = {
    keystone_present_count: presentCount,
    keystone_absent_count: absentCount,
    critical_absent: criticalAbsent.map(s => s.name),
    species_count: speciesList.length,
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="foundation"
      label="Foundation Microbiota"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Foundation" />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-[#538A22] mb-1">{presentCount}</div>
          <div className="text-xs font-mono text-[#538A22] uppercase tracking-wide">
            Keystone present
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-600 mb-1">{absentCount}</div>
          <div className="text-xs font-mono text-red-600 uppercase tracking-wide">
            Keystone absent
          </div>
        </div>
        <div className="bg-white border border-[#E2F3D0] rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-700 mb-1">
            {speciesList.length}
          </div>
          <div className="text-xs font-mono text-gray-400 uppercase tracking-wide">
            Total species
          </div>
        </div>
      </div>

      {/* Critical absent alert */}
      {criticalAbsent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <p className="text-xs font-mono text-red-700 uppercase tracking-wide
            font-medium mb-3">
            ⚠ Critical keystone species absent
          </p>
          <div className="space-y-2">
            {criticalAbsent.map(s => (
              <div key={s.name} className="flex items-start gap-3">
                <span className="text-red-500 flex-shrink-0 mt-0.5">✗</span>
                <div>
                  <span className="text-sm font-medium text-red-800 italic">
                    {s.name}
                  </span>
                  <p className="text-xs text-red-600 mt-0.5">{s.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What is foundation microbiota */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
        <p className="text-xs font-mono text-blue-600 uppercase tracking-wide mb-2">
          What is foundation microbiota
        </p>
        <p className="text-sm text-blue-900 leading-relaxed">
          Foundation microbiota are keystone species whose presence or absence has
          outsized effects on the entire microbiome ecosystem. Like a keystone in an arch,
          removing them destabilises the whole structure. BugSpeaks tracks{' '}
          {keystoneStatus.length} keystone species - perturbations in these can affect
          SCFA production, immune function, gut barrier integrity, and mental health.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { id: 'all', label: `All (${keystoneStatus.length})` },
          { id: 'critical', label: `Critical (${keystoneStatus.filter(s => s.importance === 'critical').length})` },
          { id: 'present', label: `Present (${presentCount})` },
          { id: 'absent', label: `Absent (${absentCount})` },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
              ${filter === f.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Species grid */}
      <div className="space-y-3 mb-6">
        {filtered.map(species => (
          <div
            key={species.name}
            className={`border rounded-xl p-4 transition
              ${species.present
                ? COLOR_MAP[species.color] || 'bg-background border-[#E2F3D0]'
                : 'bg-background border-gray-200 opacity-60'
              }`}
          >
            <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium
                  ${species.present ? '' : 'line-through text-gray-400'}`}>
                  {species.present ? '✓' : '✗'}
                </span>
                <span className={`text-sm font-medium italic
                  ${species.present ? 'text-gray-900' : 'text-gray-400'}`}>
                  {species.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border
                  ${IMPORTANCE_STYLE[species.importance]}`}>
                  {species.importance}
                </span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded border
                  ${species.present
                    ? 'bg-green-100 text-green-700 border-[#C8E9A8]'
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                  {species.present ? 'Present' : 'Absent'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-1">{species.role}</p>
            <p className="text-xs font-mono text-gray-400">
              Produces: {species.produces}
            </p>
          </div>
        ))}
      </div>

      {/* Keystone importance legend */}
      <div className="bg-white border border-[#E2F3D0] rounded-xl p-5 mb-6">
        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4">
          Importance classification
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              level: 'critical',
              label: 'Critical keystone',
              desc: 'Absence significantly impacts SCFA production, gut barrier, or immune function',
              style: IMPORTANCE_STYLE.critical,
            },
            {
              level: 'high',
              label: 'High importance',
              desc: 'Important contributors to microbiome resilience and metabolic function',
              style: IMPORTANCE_STYLE.high,
            },
            {
              level: 'moderate',
              label: 'Moderate importance',
              desc: 'Beneficial presence but absence has lower immediate clinical impact',
              style: IMPORTANCE_STYLE.moderate,
            },
          ].map(item => (
            <div key={item.level} className={`border rounded-xl p-3 ${item.style}`}>
              <div className="text-xs font-medium mb-1">{item.label}</div>
              <div className="text-xs leading-relaxed opacity-80">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <SectionAiPanel
        analysis={analysis}
        analysing={analysing}
        error={error}
        onRegenerate={() => report && analyse(report)}
        loadingMessage="Analysing keystone species profile…"
      />
    </SectionPageShell>
  )
}
