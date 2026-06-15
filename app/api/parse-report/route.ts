import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import {
  hasDietarySection,
  extractDietaryFromOperatorList,
  extractDietaryViaGroq,
  sanitiseDietaryRx,
} from '@/lib/extractDietaryRx'
import { extractNutritionFromPages } from '@/lib/extractNutrition'
import { extractFoundationMicrobiota } from '@/lib/ExtractFoundationmicrobiota'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

function extractScoreBefore(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`(\\d+\\.?\\d*)\\s*\\n\\s*${escaped}`, 'i'))
  return match ? parseFloat(match[1]) : null
}

function extractPercentAfter(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`${escaped}\\s+(\\d+\\.?\\d*)%`, 'i'))
  return match ? parseFloat(match[1]) : null
}

// ── Pathogen extraction ───────────────────────────────────────────────────────

export interface PathogenSpecies {
  name: string
  patient_value: number
  min: number
  p25: number
  ref_low: number
  ref_high: number
  p75: number
  max: number
  status: 'low' | 'normal' | 'high'
}

function isPathogenName(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 60 || /\d/.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return /^[A-Z][a-z]{2,25}$/.test(words[0]) && /^[a-z]{3,30}$/.test(words[1])
}

function parseNums(line: string): number[] {
  return line.split(/\s+/).map(t => parseFloat(t)).filter(n => !isNaN(n) && isFinite(n) && n >= 0)
}

function derivePathogenStatus(v: number, lo: number, hi: number): 'low' | 'normal' | 'high' {
  if (v < lo) return 'low'
  if (v > hi) return 'high'
  return 'normal'
}

function extractPathogenData(text: string): PathogenSpecies[] {
  const ANCHOR_PATTERNS = [
    /Pathogen Characterization\s+BugSpeaks[\s\S]{0,300}Handbook Page No\.\s*21\)/i,
    /BugSpeaks[\s\S]{0,50}identifies and characterizes many pathogens[\s\S]{0,200}Handbook Page No\.\s*21\)/i,
    /identifies and characterizes many pathogens[\s\S]{0,100}gut infections[\s\S]{0,100}Handbook Page No\.\s*21\)/i,
    /PATHOGEN\s+CHARACTERIZATION/i,
  ]

  let startIdx = -1
  for (const pattern of ANCHOR_PATTERNS) {
    const m = text.match(pattern)
    if (m && m.index !== undefined) {
      startIdx = m.index + m[0].length
      console.log('[Pathogens] Anchor found, starting at index:', startIdx)
      break
    }
  }

  if (startIdx === -1) {
    console.warn('[Pathogens] Anchor not found')
    return []
  }

  const chunk = text.slice(startIdx, startIdx + 15000)
  const endMatch = chunk.search(/\n(?:ANTIBIOTIC|PROBIOTIC|FOUNDATION|DIVERSITY|SCFA|VITAMIN|NEURO|DISEASE|HEALTH|KINGDOM|Summary Report)/i)
  const sectionText = endMatch !== -1 ? chunk.slice(0, endMatch) : chunk

  console.log('[Pathogens] Section isolated, length:', sectionText.length)

  const lines = sectionText.split('\n').map((l: string) => l.trim()).filter(Boolean)
  const results: PathogenSpecies[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!isPathogenName(line)) { i++; continue }

    const words = line.split(/\s+/).filter((w: string) => /^[A-Za-z]+$/.test(w))
    const name = words.slice(0, words.length >= 3 ? 3 : 2).join(' ')

    let patientValue: number | null = null
    let boundaries: number[] | null = null

    if (i > 0) {
      const prev = parseNums(lines[i - 1])
      if (prev.length === 1) patientValue = prev[0]
    }

    for (let j = 1; j <= 5 && i + j < lines.length; j++) {
      const ahead = lines[i + j]
      if (isPathogenName(ahead)) break
      const nums = parseNums(ahead)
      if (nums.length === 6 && !boundaries) { boundaries = nums; break }
      if (nums.length === 7 && !boundaries) {
        if (!patientValue) patientValue = nums[0]
        boundaries = nums.slice(1)
        break
      }
      if (nums.length === 1 && !patientValue) patientValue = nums[0]
    }

    if (boundaries && patientValue !== null) {
      const [min, p25, ref_low, ref_high, p75, max] = boundaries
      if (min <= max && ref_low <= ref_high) {
        const status = derivePathogenStatus(patientValue, ref_low, ref_high)
        results.push({ name, patient_value: patientValue, min, p25, ref_low, ref_high, p75, max, status })
        console.log(`[Pathogens] + ${name} -> ${patientValue} (${status})`)
      }
    } else {
      console.log(`[Pathogens] - ${name} missing patient:${patientValue} boundaries:${JSON.stringify(boundaries)}`)
    }
    i++
  }

  console.log('[Pathogens] Total extracted:', results.length)
  return results
}

function extractDetectedPathogens(text: string): string[] {
  return extractPathogenData(text).map(p => p.name)
}

function extractPathogenCategoryTag(text: string): string | null {
  const m = text.match(/Pathogen Characterization[\s\S]{0,300}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i)
  return m ? m[1] : null
}

// ── Antibiotic extraction — anchor-based ──────────────────────────────────────

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

function isolateAntibioticSection(text: string): string {
  const patterns = [
    /Antibiotic Recovery Potential[\s\S]{0,50}Antibiotics are known to disrupt[\s\S]{0,300}Handbook Page No\.\s*21\)/i,
    /Antibiotics are known to disrupt the microbiota ecosystem[\s\S]{0,300}Handbook Page No\.\s*21\)/i,
    /ANTIBIOTIC\s+RESISTANCE[\s\S]{0,20}RECOVERY/i,
    /Antibiotic Resistance[\s\S]{0,100}Handbook Page No\.\s*21\)/i,
  ]
  for (const pattern of patterns) {
    const m = text.match(pattern)
    if (m && m.index !== undefined) {
      const chunk = text.slice(m.index, m.index + 12000)
      const endMatch = chunk.search(/\n(?:PROBIOTIC|PATHOGEN|FOUNDATION|DIVERSITY|SCFA|VITAMIN|NEURO|DISEASE|HEALTH|KINGDOM|Summary Report)/i)
      const section = endMatch !== -1 ? chunk.slice(0, endMatch) : chunk
      console.log('[Antibiotics] Section isolated, length:', section.length)
      return section
    }
  }
  console.warn('[Antibiotics] Anchor not found - using full text')
  return text
}

function extractAntibioticResistance(text: string): Record<string, string> {
  const section = isolateAntibioticSection(text)
  const result: Record<string, string> = {}
  for (const ab of KNOWN_ANTIBIOTICS) {
    const escaped = ab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`${escaped}\\s*\\n?\\s*(Sensitive|Susceptible|Resistant)`, 'i')
    const m = section.match(pattern)
    if (m) result[ab] = m[1].toLowerCase() === 'susceptible' ? 'Sensitive' : m[1]
  }
  console.log('[Antibiotics] Resistance entries found:', Object.keys(result).length)
  return result
}

function extractAntibioticResistanceCategoryTag(text: string): string | null {
  const section = isolateAntibioticSection(text)
  const m = section.match(/(Ideal|Average|Below Average|Above Average|Non-Ideal)/i)
  return m ? m[1] : null
}

function extractAntibioticRecoveryCategoryTag(text: string): string | null {
  const section = isolateAntibioticSection(text)
  const m = section.match(/(?:Microbiota Recovery|Antibiotic Recovery)[\s\S]{0,300}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i)
  return m ? m[1] : null
}

function extractAntibioticRecoveryScore(text: string): number | null {
  const section = isolateAntibioticSection(text)
  const a = section.match(/(\d+\.\d+)\s*\n\s*Antibiotic Recovery Potential/i)
  if (a) { console.log('[Antibiotics] Recovery score (before):', a[1]); return parseFloat(a[1]) }
  const b = section.match(/Antibiotic Recovery Potential\s*\n\s*(\d+\.\d+)/i)
  if (b) { console.log('[Antibiotics] Recovery score (after):', b[1]); return parseFloat(b[1]) }
  const c = section.match(/Antibiotic Recovery Potential\s+(\d+\.\d+)/i)
  if (c) { console.log('[Antibiotics] Recovery score (inline):', c[1]); return parseFloat(c[1]) }
  const d = section.match(/(\d{2,3}\.\d+)\s*\n?\s*65\.14/i)
  if (d) { console.log('[Antibiotics] Recovery score (ref-adjacent):', d[1]); return parseFloat(d[1]) }
  console.warn('[Antibiotics] Recovery score not found')
  return null
}

// ── Scores ────────────────────────────────────────────────────────────────────

function parseScores(text: string) {
  const nameMatch       = text.match(/Name:\s*([^\n]+?)\s*Sample Collection/m)
  const ageMatch        = text.match(/Age:\s*(\d+)\s*Yrs/i)
  const genderMatch     = text.match(/Gender:\s*(Male|Female)/i)
  const idMatch         = text.match(/ID:\s*([A-Z0-9]+)/i)
  const collectionMatch = text.match(/Sample Collection Date:\s*(\d{4}-\d{2}-\d{2})/i)
  const reportMatch     = text.match(/Report Generated Date:\s*(\d{4}-\d{2}-\d{2})/i)
  const rychMatch       = text.match(/YOUR SCORE\s*\n\s*(\d+)\s*\n\s*0\s+20/i)
  const rychFallback    = text.match(/Rych Index[^\n]*\n\s*(\d+(?:\.\d+)?)\s*\n/i)

  return {
    patient: {
      name:            nameMatch?.[1]?.trim() || null,
      age:             ageMatch?.[1] || null,
      gender:          genderMatch?.[1] || null,
      sample_id:       idMatch?.[1] || null,
      collection_date: collectionMatch?.[1] || null,
      report_date:     reportMatch?.[1] || null,
    },
    rych_index: rychMatch ? parseFloat(rychMatch[1]) : rychFallback ? parseFloat(rychFallback[1]) : null,
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

// ── Probiotics ────────────────────────────────────────────────────────────────

function parseProbioticSummary(pages: { text: string; words: any[] }[]): {
  absent: string[]; low_optimal: string[]; high_optimal: string[]
  optimal: string[]; atypical_high: string[]
} | null {
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
        if (/^[A-Z][a-z]{2,}$/.test(t) && i + 1 < lw.length && /^[a-z]{3,}$/.test(lw[i + 1]?.text || '')) {
          const speciesParts = [t]; let j = i + 1
          while (j < lw.length) {
            const nw = lw[j]
            if (Math.abs(nw.x0 - x) < 220 && /^[a-z]{2,}$/.test(nw.text)) { speciesParts.push(nw.text); j++ } else break
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

// ── Dietary Rx ────────────────────────────────────────────────────────────────

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
    console.warn('[parse-report] dietary_rx failed:', e)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { text, pages } = await req.json()
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

    const scoresData = parseScores(text)

    let probiotics = null
    if (pages && Array.isArray(pages)) probiotics = parseProbioticSummary(pages)

    let speciesList: string[] = []
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant', max_tokens: 2000, temperature: 0,
        messages: [
          { role: 'system', content: 'Extract ALL microbial species names from this gut microbiome report. Include bacteria, fungi, archaea. Use genus + species format. Return ONLY: { "species": ["species 1", "species 2", ...] } No duplicates.' },
          { role: 'user', content: text.slice(0, 20000) },
        ],
        response_format: { type: 'json_object' },
      })
      speciesList = JSON.parse(res.choices[0]?.message?.content || '{}').species || []
    } catch { speciesList = [] }

    const foundation_microbiota     = extractFoundationMicrobiota(text)
    const pathogens_data            = extractPathogenData(text)
    const pathogensDetected         = pathogens_data.map(p => p.name)
    const pathogenCategoryTag       = extractPathogenCategoryTag(text)
    const antibioticResistance      = extractAntibioticResistance(text)
    const antibioticResistanceTag   = extractAntibioticResistanceCategoryTag(text)
    const antibioticRecoveryTag     = extractAntibioticRecoveryCategoryTag(text)
    const dietaryResult             = await parseDietaryRx(pages ?? [], text)
    const nutrition                 = pages?.length ? extractNutritionFromPages(pages) : null

    const finalData = {
      ...scoresData,
      species_list:              speciesList,
      probiotics:                probiotics || { absent: [], low_optimal: [], high_optimal: [], optimal: [], atypical_high: [] },
      pathogens_detected:        pathogensDetected,
      pathogens_data:            pathogens_data,
      pathogen_category_tag:     pathogenCategoryTag,
      antibiotic_resistance:     antibioticResistance,
      antibiotic_resistance_tag: antibioticResistanceTag,
      antibiotic_recovery_tag:   antibioticRecoveryTag,
      probiotic_recommendations: [],
      dietary_rx:                dietaryResult?.categories ?? null,
      dietary_rx_parsed_at:      dietaryResult ? new Date().toISOString() : null,
      dietary_rx_method:         dietaryResult?.method ?? null,
      nutrition,
      foundation_microbiota,
    }

    return NextResponse.json({ data: finalData })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('parse-report error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}