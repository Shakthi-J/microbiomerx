import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import {
  hasDietarySection,
  extractDietaryFromOperatorList,
  extractDietaryViaGroq,
  sanitiseDietaryRx,
} from '@/lib/extractDietaryRx'
import { extractNutritionFromPages } from '@/lib/extractNutrition'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

function extractScoreBefore(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(\\d+\\.?\\d*)\\s*\\n\\s*${escaped}`, 'i')
  const match = text.match(pattern)
  if (match) return parseFloat(match[1])
  return null
}

function extractPercentAfter(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escaped}\\s+(\\d+\\.?\\d*)%`, 'i')
  const match = text.match(pattern)
  if (match) return parseFloat(match[1])
  return null
}

// ── Pathogen extraction ───────────────────────────────────────────────────────
const ALL_KNOWN_PATHOGENS = [
  'Campylobacter jejuni', 'Clostridioides difficile', 'Escherichia coli',
  'Helicobacter pylori', 'Salmonella enterica', 'Shigella dysenteriae',
  'Vibrio cholerae', 'Yersinia enterocolitica', 'Klebsiella pneumoniae',
  'Mycobacterium avium', 'Proteus mirabilis', 'Citrobacter freundii',
  'Fusobacterium nucleatum', 'Bacillus cereus', 'Enterococcus faecalis',
  'Enterococcus faecium', 'Listeria monocytogenes', 'Pseudomonas aeruginosa',
  'Staphylococcus aureus', 'Staphylococcus epidermidis', 'Staphylococcus saprophyticus',
  'Streptococcus agalactiae', 'Streptococcus pneumoniae', 'Giardia intestinalis',
  'Necator americanus', 'Trichuris trichiura', 'Ancylostoma duodenale',
  'Ascaris lumbricoides', 'Blastocystis hominis', 'Chilomastix mesnili',
  'Cryptosporidium', 'Dientamoeba fragilis', 'Endolimax nana', 'Entamoeba coli',
  'Entamoeba histolytica', 'Pentatrichomonas hominis', 'Candida albicans',
  'Candida glabrata', 'Candida tropicalis', 'Candida parapsilosis', 'Candida krusei',
  'Aspergillus fumigatus', 'Aspergillus flavus', 'Aspergillus niger',
  'Aspergillus terreus', 'Aspergillus nidulans',
]

function extractDetectedPathogens(text: string): string[] {
  const detected: string[] = []
  const badMicrobesMatch = text.match(
    /Pathogen[\s\S]{0,30}Bad Microbes[\s\S]*?abundance was found to be more than[\s\S]{0,800}/i
  )
  if (badMicrobesMatch) {
    for (const name of ALL_KNOWN_PATHOGENS) {
      if (badMicrobesMatch[0].includes(name)) detected.push(name)
    }
    if (detected.length > 0) return [...new Set(detected)]
  }
  const beforeSummary = text.match(/([\s\S]{0,1000})Summary Report/i)
  if (beforeSummary) {
    for (const name of ALL_KNOWN_PATHOGENS) {
      if (beforeSummary[1].includes(name)) detected.push(name)
    }
    if (detected.length > 0) return [...new Set(detected)]
  }
  const followRecsBlocks = [...text.matchAll(/Please follow recommendations[\s\S]{0,200}/gi)]
  for (const block of followRecsBlocks) {
    for (const name of ALL_KNOWN_PATHOGENS) {
      if (block[0].includes(name)) detected.push(name)
    }
  }
  return [...new Set(detected)]
}

function extractPathogenCategoryTag(text: string): string | null {
  const match = text.match(
    /Pathogen Characterization[\s\S]{0,300}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i
  )
  return match ? match[1] : null
}

// ── Antibiotic extraction ─────────────────────────────────────────────────────
/**
 * Complete list of all antibiotics tracked by BugSpeaks across all report versions.
 */
const KNOWN_ANTIBIOTICS = [
  'Amikacin', 'Aminocoumarin', 'Amoxicillin', 'Amoxicillin+Clavulanic_Acid',
  'Ampicillin', 'Ampicillin+Clavulanic_Acid', 'Avilamycin', 'Azithromycin',
  'Aztreonam', 'Benzalkonium_Chloride', 'Bicyclomycin', 'Bleomycin',
  'Carbapenem', 'Carbomycin', 'Cefepime', 'Cefixime', 'Cefotaxime',
  'Cefotaxime+Clavulanic_Acid', 'Cefoxitin', 'Ceftazidime',
  'Ceftazidime+Avibactam', 'Ceftriaxone', 'Cephalothin', 'Cephamycin',
  'Ciprofloxacin', 'Clindamycin', 'Colistin', 'Dalfopristin',
  'Diaminopyrimidine', 'Doxycycline', 'Elfamycin', 'Ertapenem',
  'Erythromycin', 'Florfenicol', 'Fosfomycin', 'Fusidic_Acid',
  'Gentamicin', 'Glycylcycline', 'Hygromycin', 'Imipenem', 'Isoniazid',
  'Kanamycin', 'Kasugamycin', 'Lincomycin', 'Lincosamide', 'Linezolid',
  'Meropenem', 'Methicillin', 'Minocycline', 'Monobactam', 'Mupirocin',
  'Nalidixic_Acid', 'Nitrofuran', 'Nitroimidazole', 'Oleandomycin',
  'Penicillin', 'Phenicol', 'Piperacillin', 'Piperacillin+Tazobactam',
  'Pleuromutilin', 'Pristinamycin', 'Quinupristin', 'Quinupristin+Dalfopristin',
  'Rhodamine', 'Rifampin', 'Rifamycin', 'Spectinomycin', 'Spiramycin',
  'Streptomycin', 'Streptothricin', 'Sulfamethoxazole', 'Teicoplanin',
  'Telithromycin', 'Temocillin', 'Tetracenomycin', 'Tetracycline',
  'Thiostrepton', 'Tiamulin', 'Ticarcillin', 'Ticarcillin+Clavulanic_Acid',
  'Tigecycline', 'Tobramycin', 'Triclosan', 'Trimethoprim', 'Tylosin',
  'Vancomycin', 'Viomycin', 'Virginiamycin_M', 'Virginiamycin_S', 'Zorbamycin',
]

/**
 * Extract antibiotic → status from BugSpeaks report.
 *
 * BugSpeaks uses two different status labels depending on report version:
 *   Newer reports:  "Sensitive"   / "Resistant"
 *   Older reports:  "Susceptible" / "Resistant"
 *
 * Both are normalized to "Sensitive" / "Resistant" for consistency.
 *
 * Strategy: search for each known antibiotic name individually (no section
 * isolation) — same proven approach as pathogen extraction.
 */
function extractAntibioticResistance(text: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const ab of KNOWN_ANTIBIOTICS) {
    const escaped = ab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Handles both same-line and newline-separated name + status
    // Matches: "Amikacin Sensitive", "Amikacin\nSensitive", "Amikacin Susceptible"
    const pattern = new RegExp(
      `${escaped}\\s*\\n?\\s*(Sensitive|Susceptible|Resistant)`,
      'i'
    )
    const match = text.match(pattern)
    if (match) {
      const rawStatus = match[1].trim()
      // Normalize: Susceptible → Sensitive (older report format)
      result[ab] = rawStatus.toLowerCase() === 'susceptible' ? 'Sensitive' : rawStatus
    }
  }

  return result
}

function extractAntibioticResistanceCategoryTag(text: string): string | null {
  const match = text.match(
    /Antibiotic Resistance[\s\S]{0,300}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i
  )
  return match ? match[1] : null
}

function extractAntibioticRecoveryCategoryTag(text: string): string | null {
  const match = text.match(
    /(?:Microbiota Recovery|Antibiotic Recovery)[\s\S]{0,300}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i
  )
  return match ? match[1] : null
}


// ── Antibiotic recovery score extraction ──────────────────────────────────────
/**
 * Extracts the Antibiotic Recovery Potential score.
 *
 * BUG FIX: extractScoreBefore was matching the PAGE NUMBER (e.g. "29" from
 * "Page 29 of 45") that appears in the PDF footer just before the section
 * heading "Antibiotic Recovery Potential".
 *
 * FIX: Require a decimal point in the score (e.g. 72.997, 62.283).
 * Page numbers are always integers — they never have decimal points.
 */
function extractAntibioticRecoveryScore(text: string): number | null {
  // Pattern 1: decimal score on line BEFORE the label
  const beforeMatch = text.match(/(\d+\.\d+)\s*\n\s*Antibiotic Recovery Potential/i)
  if (beforeMatch) return parseFloat(beforeMatch[1])

  // Pattern 2: decimal score on line AFTER the label
  const afterMatch = text.match(/Antibiotic Recovery Potential\s*\n\s*(\d+\.\d+)/i)
  if (afterMatch) return parseFloat(afterMatch[1])

  // Pattern 3: decimal score on SAME line as label
  const sameLineMatch = text.match(/Antibiotic Recovery Potential\s+(\d+\.\d+)/i)
  if (sameLineMatch) return parseFloat(sameLineMatch[1])

  return null
}

function parseScores(text: string) {
  const nameMatch       = text.match(/Name:\s*([^\n]+?)\s*Sample Collection/m)
  const ageMatch        = text.match(/Age:\s*(\d+)\s*Yrs/i)
  const genderMatch     = text.match(/Gender:\s*(Male|Female)/i)
  const idMatch         = text.match(/ID:\s*([A-Z0-9]+)/i)
  const collectionMatch = text.match(/Sample Collection Date:\s*(\d{4}-\d{2}-\d{2})/i)
  const reportMatch     = text.match(/Report Generated Date:\s*(\d{4}-\d{2}-\d{2})/i)

  const rychMatch    = text.match(/YOUR SCORE\s*\n\s*(\d+)\s*\n\s*0\s+20/i)
  const rychFallback = text.match(/Rych Index[^\n]*\n\s*(\d+(?:\.\d+)?)\s*\n/i)
  const rych_index   = rychMatch
    ? parseFloat(rychMatch[1])
    : rychFallback ? parseFloat(rychFallback[1]) : null

  return {
    patient: {
      name:            nameMatch?.[1]?.trim() || null,
      age:             ageMatch?.[1] || null,
      gender:          genderMatch?.[1] || null,
      sample_id:       idMatch?.[1] || null,
      collection_date: collectionMatch?.[1] || null,
      report_date:     reportMatch?.[1] || null,
    },
    rych_index,
    scfa: {
      acetate:            extractScoreBefore(text, 'Acetate'),
      propionate:         extractScoreBefore(text, 'Propionate'),
      butyrate:           extractScoreBefore(text, 'Butyrate'),
      isobutyric_acid:    extractScoreBefore(text, 'Isobutyric acid'),
      valeric_acid:       extractScoreBefore(text, 'Valeric acid'),
      isovaleric_acid:    extractScoreBefore(text, 'Isovaleric acid'),
      methylbutyric_acid: extractScoreBefore(text, '2-Methylbutyric acid'),
      formate:            extractScoreBefore(text, 'Formate'),
      caproate:           extractScoreBefore(text, 'Caproate'),
    },
    vitamins: {
      b1:  extractScoreBefore(text, 'Vitamin B1'),
      b2:  extractScoreBefore(text, 'Vitamin B2'),
      b3:  extractScoreBefore(text, 'Vitamin B3'),
      b5:  extractScoreBefore(text, 'Vitamin B5'),
      b6:  extractScoreBefore(text, 'Vitamin B6'),
      b7:  extractScoreBefore(text, 'Vitamin B7'),
      b9:  extractScoreBefore(text, 'Vitamin B9'),
      b12: extractScoreBefore(text, 'Vitamin B12'),
      c:   extractScoreBefore(text, 'Vitamin C'),
    },
    neurotransmitters: {
      acetylcholine:  extractScoreBefore(text, 'Acetylcholine'),
      dopamine:       extractScoreBefore(text, 'Dopamine'),
      epinephrine:    extractScoreBefore(text, 'Epinephrine'),
      gaba:           extractScoreBefore(text, 'GABA'),
      glutamate:      extractScoreBefore(text, 'Glutamate'),
      histamine:      extractScoreBefore(text, 'Histamine'),
      norepinephrine: extractScoreBefore(text, 'Norepinephrine'),
      serotonin:      extractScoreBefore(text, 'Serotonin'),
      tryptamine:     extractScoreBefore(text, 'Tryptamine'),
      tryptophan:     extractScoreBefore(text, 'Tryptophan'),
    },
    macronutrients: {
      carbohydrate: extractScoreBefore(text, 'Carbohydrate Metabolism Potential'),
      fat:          extractScoreBefore(text, 'Fat Metabolism Potential'),
      protein:      extractScoreBefore(text, 'Protein Metabolism Potential'),
    },
    gut_function: {
      intestinal_motility:     extractScoreBefore(text, 'Intestinal Motility Potential'),
      mineral_bioavailability: extractScoreBefore(text, 'Mineral Bioavailability Potential'),
    },
    intolerance: {
      lactose:               extractScoreBefore(text, 'Lactose Intolerance Management'),
      fructose:              extractScoreBefore(text, 'Fructose Intolerance Management'),
      gluten:                extractScoreBefore(text, 'Gluten Intolerance Management'),
      histamine_sensitivity: extractScoreBefore(text, 'Histamine Sensitivity Management'),
    },
    endurance: {
      aerobic:  extractScoreBefore(text, 'Aerobic Endurance Potential'),
      physical: extractScoreBefore(text, 'Physical Endurance Potential'),
    },
    health_indicators: {
      microplastic:     extractScoreBefore(text, 'Microplastic Exposure Indicator'),
      fatigue:          extractScoreBefore(text, 'Prone to Fatigue'),
      gut_inflammation: extractScoreBefore(text, 'Potential Gut Inflammation'),
      leaky_gut:        extractScoreBefore(text, 'Leaky Gut Potential'),
      tmao:             extractScoreBefore(text, 'TMAO Production Potential'),
    },
    disease_risk: {
      constipation:         extractPercentAfter(text, 'Constipation'),
      ibs:                  extractPercentAfter(text, 'Irritable Bowel Syndrome'),
      type2_diabetes:       extractPercentAfter(text, 'Type 2 Diabetes'),
      hypertension:         extractPercentAfter(text, 'Hypertension'),
      nafld:                extractPercentAfter(text, 'Non-alcoholic Fatty Liver Disease'),
      rheumatoid_arthritis: extractPercentAfter(text, 'Rheumatoid Arthritis'),
      obesity:              extractPercentAfter(text, 'Obesity'),
      ibd:                  extractPercentAfter(text, 'Inflammatory Bowel Disease'),
    },
    diversity: {
      shannon: extractScoreBefore(text, 'Shannon Diversity'),
    },
    kingdom: {
      bacteria:  extractScoreBefore(text, 'Bacteria'),
      archaea:   extractScoreBefore(text, 'Archaea'),
      fungi:     extractScoreBefore(text, 'Fungi'),
      eukaryota: extractScoreBefore(text, 'Eukaryota [Protozoa & Metazoa]'),
      viruses:   extractScoreBefore(text, 'Viruses'),
    },
    antibiotic_recovery: extractAntibioticRecoveryScore(text),
  }
}

function parseProbioticSummary(pages: { text: string; words: any[] }[]): {
  absent: string[]; low_optimal: string[]; high_optimal: string[]
  optimal: string[]; atypical_high: string[]
} | null {
  const GENERA = [
    'Lactobacillus', 'Bifidobacterium', 'Lacticaseibacillus', 'Lactiplantibacillus',
    'Limosilactobacillus', 'Ligilactobacillus', 'Levilactobacillus', 'Akkermansia',
    'Clostridium', 'Enterococcus', 'Streptococcus', 'Saccharomyces',
    'Bacillus', 'Leuconostoc', 'Pediococcus', 'Lactococcus',
  ]
  for (const page of pages) {
    if (!page.text.includes('Probiotic Supplementation Summary')) continue
    const result = { absent: [] as string[], low_optimal: [] as string[], high_optimal: [] as string[], optimal: [] as string[], atypical_high: [] as string[] }
    const lineMap = new Map<number, any[]>()
    for (const w of page.words) {
      const y = Math.round(w.top / 4) * 4
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push(w)
    }
    let col2Category: 'low_optimal' | 'high_optimal' | 'atypical_high' = 'low_optimal'
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => a - b)
    for (const y of sortedYs) {
      const lw = lineMap.get(y)!.sort((a, b) => a.x0 - b.x0)
      const lineText = lw.map((w: any) => w.text).join(' ')
      if (lineText.includes('High') && lineText.includes('Optimal') && lw.some((w: any) => w.text === 'High' && w.x0 < 400)) col2Category = 'high_optimal'
      if (lineText.includes('Atypical')) col2Category = 'atypical_high'
      let i = 0
      while (i < lw.length) {
        const w = lw[i]; const x = w.x0; const t = w.text
        if (GENERA.includes(t)) {
          const speciesParts = [t]; let j = i + 1
          while (j < lw.length) {
            const nw = lw[j]
            if (Math.abs(nw.x0 - x) < 220 && nw.text && nw.text[0] === nw.text[0].toLowerCase()) { speciesParts.push(nw.text); j++ } else break
          }
          const species = speciesParts.join(' ')
          if (x < 200) result.absent.push(species)
          else if (x < 405) { if (col2Category === 'high_optimal') result.high_optimal.push(species); else result.low_optimal.push(species) }
          else { if (col2Category === 'atypical_high') result.atypical_high.push(species); else result.optimal.push(species) }
          i = j
        } else i++
      }
    }
    return result
  }
  return null
}

async function parseDietaryRx(pages: Array<{ text: string; words: any[]; operatorList?: any }>, fullText: string): Promise<{ categories: any[]; method: string } | null> {
  try {
    if (!hasDietarySection(fullText)) return null
    if (pages?.length) {
      const opResult = extractDietaryFromOperatorList(pages)
      if (opResult && opResult.length >= 3) return { categories: sanitiseDietaryRx(opResult), method: 'operator_list' }
    }
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) return null
    const groqResult = await extractDietaryViaGroq(fullText, groqKey)
    if (groqResult.length >= 3) return { categories: groqResult, method: 'groq_70b' }
    return null
  } catch (e) {
    console.warn('[parse-report] dietary_rx failed (non-critical):', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, pages } = await req.json()
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

    const scoresData = parseScores(text)

    let probiotics = null
    if (pages && Array.isArray(pages)) probiotics = parseProbioticSummary(pages)

    let speciesList: string[] = []
    try {
      const speciesResponse = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant', max_tokens: 2000, temperature: 0,
        messages: [
          { role: 'system', content: `Extract ALL microbial species names from this gut microbiome report. Include bacteria, fungi, archaea. Use genus + species format. Return ONLY: { "species": ["species 1", "species 2", ...] } No duplicates.` },
          { role: 'user', content: text.slice(0, 20000) },
        ],
        response_format: { type: 'json_object' },
      })
      speciesList = JSON.parse(speciesResponse.choices[0]?.message?.content || '{}').species || []
    } catch { speciesList = [] }

    const pathogensDetected        = extractDetectedPathogens(text)
    const pathogenCategoryTag      = extractPathogenCategoryTag(text)
    const antibioticResistance     = extractAntibioticResistance(text)
    const antibioticResistanceTag  = extractAntibioticResistanceCategoryTag(text)
    const antibioticRecoveryTag    = extractAntibioticRecoveryCategoryTag(text)

    const dietaryResult = await parseDietaryRx(pages ?? [], text)
    const nutrition     = pages?.length ? extractNutritionFromPages(pages) : null

    const finalData = {
      ...scoresData,
      species_list:              speciesList,
      probiotics:                probiotics || { absent: [], low_optimal: [], high_optimal: [], optimal: [], atypical_high: [] },
      pathogens_detected:        pathogensDetected,
      pathogen_category_tag:     pathogenCategoryTag,
      antibiotic_resistance:     antibioticResistance,
      antibiotic_resistance_tag: antibioticResistanceTag,
      antibiotic_recovery_tag:   antibioticRecoveryTag,
      probiotic_recommendations: [],
      dietary_rx:                dietaryResult?.categories ?? null,
      dietary_rx_parsed_at:      dietaryResult ? new Date().toISOString() : null,
      dietary_rx_method:         dietaryResult?.method ?? null,
      nutrition,
    }

    return NextResponse.json({ data: finalData })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('parse-report error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
