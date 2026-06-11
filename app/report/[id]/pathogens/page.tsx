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

type PathogenCategory = 'bacterial' | 'autoimmune' | 'opportunistic' | 'worms' | 'protozoa' | 'dysbiotic' | 'fungi'

interface PathogenEntry {
  name: string
  category: PathogenCategory
  clinicalNote: string
}

const PATHOGEN_MASTER: PathogenEntry[] = [
  { name: 'Campylobacter jejuni',         category: 'bacterial',     clinicalNote: 'Campylobacteriosis — diarrhoea, fever, abdominal cramps' },
  { name: 'Clostridioides difficile',     category: 'bacterial',     clinicalNote: 'C. diff colitis — severe diarrhoea, pseudomembranous colitis' },
  { name: 'Escherichia coli',             category: 'bacterial',     clinicalNote: 'Pathogenic E. coli — diarrhoea, UTI, systemic infection risk' },
  { name: 'Helicobacter pylori',          category: 'bacterial',     clinicalNote: 'Peptic ulcers, gastritis, gastric cancer risk' },
  { name: 'Salmonella enterica',          category: 'bacterial',     clinicalNote: 'Salmonellosis — fever, diarrhoea, vomiting' },
  { name: 'Shigella dysenteriae',         category: 'bacterial',     clinicalNote: 'Bacillary dysentery — bloody diarrhoea, fever' },
  { name: 'Vibrio cholerae',              category: 'bacterial',     clinicalNote: 'Cholera — severe watery diarrhoea, dehydration' },
  { name: 'Yersinia enterocolitica',      category: 'bacterial',     clinicalNote: 'Yersiniosis — diarrhoea, pseudoappendicitis' },
  { name: 'Klebsiella pneumoniae',        category: 'autoimmune',    clinicalNote: 'Linked to ankylosing spondylitis and autoimmune joint disease' },
  { name: 'Mycobacterium avium',          category: 'autoimmune',    clinicalNote: 'Opportunistic lung infection; associated with immune dysregulation' },
  { name: 'Proteus mirabilis',            category: 'autoimmune',    clinicalNote: 'Trigger for rheumatoid arthritis via molecular mimicry' },
  { name: 'Citrobacter freundii',         category: 'autoimmune',    clinicalNote: 'Opportunistic pathogen; IBD and autoimmune trigger' },
  { name: 'Fusobacterium nucleatum',      category: 'autoimmune',    clinicalNote: 'Linked to colorectal cancer, periodontal disease, IBD risk' },
  { name: 'Bacillus cereus',              category: 'opportunistic', clinicalNote: 'Food poisoning — emetic and diarrheal toxin production' },
  { name: 'Enterococcus faecalis',        category: 'opportunistic', clinicalNote: 'UTI and wound infections; antibiotic resistance risk' },
  { name: 'Enterococcus faecium',         category: 'opportunistic', clinicalNote: 'Vancomycin-resistant enterococci (VRE) risk' },
  { name: 'Listeria monocytogenes',       category: 'opportunistic', clinicalNote: 'Listeriosis — serious risk in immunocompromised and pregnant' },
  { name: 'Pseudomonas aeruginosa',       category: 'opportunistic', clinicalNote: 'Antibiotic-resistant infections in immunocompromised patients' },
  { name: 'Staphylococcus aureus',        category: 'opportunistic', clinicalNote: 'MRSA risk; skin, wound, and systemic infections' },
  { name: 'Staphylococcus epidermidis',   category: 'opportunistic', clinicalNote: 'Catheter-related biofilm infections' },
  { name: 'Staphylococcus saprophyticus', category: 'opportunistic', clinicalNote: 'Urinary tract infections, especially in young women' },
  { name: 'Streptococcus agalactiae',     category: 'opportunistic', clinicalNote: 'Group B Strep; neonatal infection and adult bacteraemia risk' },
  { name: 'Streptococcus pneumoniae',     category: 'opportunistic', clinicalNote: 'Pneumonia, meningitis, otitis media' },
  { name: 'Giardia intestinalis',         category: 'worms',         clinicalNote: 'Giardiasis — chronic diarrhoea, malabsorption, bloating' },
  { name: 'Necator americanus',           category: 'worms',         clinicalNote: 'Hookworm — anaemia, protein deficiency' },
  { name: 'Trichuris trichiura',          category: 'worms',         clinicalNote: 'Whipworm — colitis, rectal prolapse in heavy infections' },
  { name: 'Ancylostoma duodenale',        category: 'worms',         clinicalNote: 'Hookworm — iron-deficiency anaemia, malnutrition' },
  { name: 'Ascaris lumbricoides',         category: 'worms',         clinicalNote: 'Roundworm — intestinal obstruction, malabsorption' },
  { name: 'Blastocystis hominis',         category: 'protozoa',      clinicalNote: 'IBS-like symptoms; associated with gut dysbiosis' },
  { name: 'Chilomastix mesnili',          category: 'protozoa',      clinicalNote: 'Generally non-pathogenic; faecal contamination indicator' },
  { name: 'Cryptosporidium',              category: 'protozoa',      clinicalNote: 'Cryptosporidiosis — severe diarrhoea, dehydration' },
  { name: 'Dientamoeba fragilis',         category: 'protozoa',      clinicalNote: 'Intermittent diarrhoea, abdominal pain' },
  { name: 'Endolimax nana',               category: 'protozoa',      clinicalNote: 'Non-pathogenic commensal; faecal-oral exposure indicator' },
  { name: 'Entamoeba coli',               category: 'protozoa',      clinicalNote: 'Non-pathogenic; presence indicates faecal-oral exposure' },
  { name: 'Entamoeba histolytica',        category: 'protozoa',      clinicalNote: 'Amoebiasis — amoebic dysentery, liver abscess risk' },
  { name: 'Pentatrichomonas hominis',     category: 'protozoa',      clinicalNote: 'Debated pathogenicity; monitor in immunocompromised' },
  { name: 'Citrobacter freundii',         category: 'dysbiotic',     clinicalNote: 'Gut overgrowth indicator; IBD and opportunistic infection risk' },
  { name: 'Candida albicans',             category: 'fungi',         clinicalNote: 'Gut candidiasis; systemic infection risk in immunocompromised' },
  { name: 'Candida glabrata',             category: 'fungi',         clinicalNote: 'Antifungal-resistant candidiasis; fluconazole resistance common' },
  { name: 'Candida tropicalis',           category: 'fungi',         clinicalNote: 'IBD-associated gut inflammation and biofilm formation' },
  { name: 'Candida parapsilosis',         category: 'fungi',         clinicalNote: 'Catheter-related bloodstream infections' },
  { name: 'Candida krusei',               category: 'fungi',         clinicalNote: 'Inherently fluconazole-resistant fungal infection' },
  { name: 'Aspergillus fumigatus',        category: 'fungi',         clinicalNote: 'Invasive aspergillosis risk; lung infections in immunocompromised' },
  { name: 'Aspergillus flavus',           category: 'fungi',         clinicalNote: 'Aflatoxin production; aspergillosis in high-risk patients' },
  { name: 'Aspergillus niger',            category: 'fungi',         clinicalNote: 'Otomycosis, pulmonary aspergillosis' },
  { name: 'Aspergillus terreus',          category: 'fungi',         clinicalNote: 'Resistant to amphotericin B; high mortality invasive infection' },
  { name: 'Aspergillus nidulans',         category: 'fungi',         clinicalNote: 'Chronic granulomatous disease risk' },
]

const CATEGORY_CONFIG: Record<PathogenCategory, { label: string; color: string; bg: string; border: string }> = {
  bacterial:     { label: 'Bacterial Pathogens / Primary Pathogens', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200'    },
  autoimmune:    { label: 'Potential Autoimmune Triggers',           color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  opportunistic: { label: 'Opportunistic Bacteria',                  color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200'  },
  worms:         { label: 'Worms',                                   color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  protozoa:      { label: 'Protozoa',                                color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  dysbiotic:     { label: 'Dysbiotic / Overgrowth Bacteria',        color: 'text-pink-700',   bg: 'bg-pink-50',    border: 'border-pink-200'   },
  fungi:         { label: 'Fungi / Yeast',                          color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
}

const CATEGORY_ORDER: PathogenCategory[] = ['bacterial', 'autoimmune', 'opportunistic', 'worms', 'protozoa', 'dysbiotic', 'fungi']

function getStringField(rd: Record<string, unknown> | null, key: string): string | null {
  const value = rd?.[key]
  return typeof value === 'string' ? value : null
}

function getStringArray(rd: Record<string, unknown> | null, key: string): string[] {
  const value = rd?.[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function buildPathogenData(rd: Record<string, unknown> | null) {
  const detectedNames = getStringArray(rd, 'pathogens_detected')
  const detectedSet = new Set(detectedNames.map(name => name.trim()))
  const enriched = PATHOGEN_MASTER.map(p => ({ ...p, detected: detectedSet.has(p.name) }))
  const detected = enriched.filter(p => p.detected)
  const categoryTag = getStringField(rd, 'pathogen_category_tag') ?? 'Below Average'
  return { enriched, detected, categoryTag }
}

export default function PathogensPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [activeCategory, setActiveCategory] = useState<'all' | PathogenCategory>('all')

  const getSectionData = useMemo(
    () => (rep: SectionReport) => {
      const { detected, categoryTag } = buildPathogenData(rep.report_data)
      return {
        detected: detected.map(p => ({ name: p.name, category: p.category, clinicalNote: p.clinicalNote })),
        total_tracked: PATHOGEN_MASTER.length,
        category_tag: categoryTag,
      }
    },
    [],
  )

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'pathogen_characterization',
    getSectionData,
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const rd = report.report_data
  const { enriched, detected, categoryTag } = buildPathogenData(rd)
  const filtered = enriched.filter(p => activeCategory === 'all' || p.category === activeCategory)
  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof enriched>>((acc, cat) => {
    const items = filtered.filter(p => p.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  const pageData = {
    flagged_count: detected.length,
    total_tracked: PATHOGEN_MASTER.length,
    category_tag: categoryTag,
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="pathogens"
      label="Pathogen Characterization"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Pathogen Characterization" />

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">Category Tag:</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              {categoryTag}
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            BugSpeaks® identifies and characterizes pathogens known to cause gut infections and other health issues.
            Icons: ❌ Nothing to Worry · ℹ️ Follow Recommendations (above average healthy individuals).
            This is not a diagnostic report — please correlate clinically.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
          ℹ️ Values represent relative abundance from sequencing — not a culture-based diagnostic. Indicative tags do not represent CFU/g. Please correlate clinically and consult a doctor if symptoms are present.
        </div>

        <SectionOverviewCard
          stats={[
            {
              label: 'ℹ️ Flagged',
              value: String(detected.length),
              tone: detected.length > 0 ? 'amber' : 'green',
            },
            {
              label: '❌ Not Detected',
              value: String(PATHOGEN_MASTER.length - detected.length),
              tone: 'green',
            },
            {
              label: 'Total Tracked',
              value: String(PATHOGEN_MASTER.length),
              tone: 'blue',
            },
          ]}
        />

        {detected.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">
              ℹ️ {detected.length} pathogen{detected.length > 1 ? 's' : ''} above average healthy individuals — please follow recommendations and correlate clinically
            </p>
            <div className="space-y-3">
              {detected.map(p => {
                const cfg = CATEGORY_CONFIG[p.category]
                return (
                  <div key={`alert-${p.name}`} className="bg-white border border-amber-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold italic text-amber-900">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.clinicalNote}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded border bg-white ${cfg.color} border-gray-200 font-medium`}>
                          {cfg.label.split('/')[0].split('(')[0].trim()}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                          ℹ️ Follow Recommendations
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-2xl p-5 text-center">
            <p className="text-2xl mb-1">✓</p>
            <p className="text-sm font-semibold text-[#1A3207]">No pathogens flagged above average healthy individuals</p>
            <p className="text-xs text-[#538A22] mt-0.5">All tracked pathogens show ❌ Nothing to Worry status</p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${activeCategory === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
          >
            All ({PATHOGEN_MASTER.length})
          </button>
          {CATEGORY_ORDER.map(cat => {
            const count = PATHOGEN_MASTER.filter(p => p.category === cat).length
            const detCount = detected.filter(p => p.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium flex items-center gap-1.5 ${activeCategory === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                {detCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
              </button>
            )
          })}
        </div>

        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, items]) => {
            const cfg = CATEGORY_CONFIG[cat as PathogenCategory]
            const flaggedInCat = items.filter(p => p.detected).length
            return (
              <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className={`px-5 py-3 border-b flex items-center justify-between ${cfg.bg} ${cfg.border}`}>
                  <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                  {flaggedInCat > 0 && (
                    <span className="text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">
                      {flaggedInCat} flagged
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map(p => (
                    <div key={p.name} className={`px-5 py-3 flex items-start justify-between gap-4 ${p.detected ? 'bg-amber-50' : ''}`}>
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${p.detected ? 'bg-amber-500' : 'bg-gray-200'}`} />
                        <div>
                          <p className={`text-sm italic font-medium ${p.detected ? 'text-amber-900' : 'text-gray-600'}`}>{p.name}</p>
                          {p.detected && <p className="text-xs text-amber-700 mt-0.5 leading-snug">{p.clinicalNote}</p>}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${p.detected ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                        {p.detected ? 'ℹ️ Follow Recs' : '❌ Nothing to Worry'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <SectionAiPanel
          analysis={analysis}
          analysing={analysing}
          error={error}
          onRegenerate={() => report && analyse(report)}
          subtitle="Pathogen profile interpretation and clinical recommendations"
        />
      </div>
    </SectionPageShell>
  )
}
