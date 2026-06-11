export type ExtractedPatient = {
  name: string
  age_sex: string
  complaint: string
  diet_type: string
  medical_history: string
  allergies: string
}

export type ReportData = {
  patient: any
  rych_index: number | null
  scfa: Record<string, number | null>
  vitamins: Record<string, number | null>
  neurotransmitters: Record<string, number | null>
  macronutrients: Record<string, number | null>
  gut_function: Record<string, number | null>
  intolerance: Record<string, number | null>
  endurance: Record<string, number | null>
  health_indicators: Record<string, number | null>
  disease_risk: Record<string, number | null>
  diversity: Record<string, number | null>
  kingdom: Record<string, number | null>
  antibiotic_recovery: number | null
  probiotics: {
    absent: string[]
    low_optimal: string[]
    high_optimal: string[]
    optimal: string[]
    atypical_high: string[]
  }
  probiotic_recommendations: string[]
  pathogens_detected: string[]
  species_list: string[]
  nutrition_data?: Record<string, Record<string, [string, string, string]>>
}

export type PDFExtractResult = {
  species: string[]
  patient: ExtractedPatient
  reportData: ReportData | null
  rawText: string
}

const KNOWN_GENERA = [
  'Agathobaculum','Alistipes','Anaerostipes','Bacteroides','Barnesiella',
  'Bifidobacterium','Blautia','Butyricicoccus','Butyrivibrio','Clostridium',
  'Collinsella','Coprococcus','Dialister','Dorea','Enterococcus',
  'Eubacterium','Faecalibacterium','Fusicatenibacter','Gemmiger',
  'Helicobacter','Holdemanella','Intestinimonas','Klebsiella',
  'Lachnoclostridium','Lactobacillus','Lacticaseibacillus',
  'Lactiplantibacillus','Ligilactobacillus','Limosilactobacillus',
  'Levilactobacillus','Megamonas','Methanobrevibacter','Mitsuokella',
  'Odoribacter','Parabacteroides','Phascolarctobacterium','Prevotella',
  'Roseburia','Ruminococcus','Streptococcus','Subdoligranulum',
  'Veillonella','Akkermansia','Desulfovibrio','Fusobacterium',
  'Peptostreptococcus','Oscillibacter','Butyricimonas',
  'Mediterraneibacter','Lawsonibacter','Anaerobutyricum',
  'Pediococcus','Bacillus','Enterobacter','Escherichia',
  'Salmonella','Campylobacter','Clostridoides','Clostridioides',
  'Erysipelatoclostridium','Holdemania','Coprobacillus',
  'Eisenbergiella','Flavonifractor','Intestinibacter','Mogibacterium',
  'Parasutterella','Rothia','Sutterella','Turicibacter',
]

function extractSpeciesFromText(text: string): string[] {
  const speciesFound = new Set<string>()
  for (const genus of KNOWN_GENERA) {
    const pattern = new RegExp(`${genus}\\s+([a-z][a-z]{2,})`, 'g')
    let match
    while ((match = pattern.exec(text)) !== null) {
      const species = match[1]
      if (['the','and','for','are','with','from','this','that'].includes(species)) continue
      speciesFound.add(`${genus} ${species}`)
    }
  }
  return Array.from(speciesFound)
}

// ── UPDATED: added operatorList field ────────────────────────────────────────
type PageData = { text: string; words: any[]; operatorList?: any }

async function getPDFData(file: File): Promise<{ fullText: string; pages: PageData[] }> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''
  const pages: PageData[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items = content.items as any[]

    // Group by Y for text
    const lineMap = new Map<number, string[]>()
    const words: any[] = []

    for (const item of items) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform?.[5] || 0)
      const x = item.transform?.[4] || 0
      const top = item.transform?.[5] || 0

      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push(item.str)

      // Build word objects for column detection
      const wordTokens = item.str.trim().split(/\s+/)
      let xOffset = x
      for (const token of wordTokens) {
        if (token) {
          words.push({ text: token, x0: xOffset, top: 850 - top }) // flip y
          xOffset += token.length * 4 // approximate
        }
      }
    }

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
    let pageText = ''
    for (const y of sortedYs) {
      const lineText = lineMap.get(y)!.join(' ').trim()
      if (lineText) pageText += lineText + '\n'
    }
    pageText += '\n'
    fullText += pageText

    // ── NEW: fetch operatorList for nutrition dot extraction ─────────────────
    // Required by extractNutritionFromPages() in parse-report/route.ts.
    // Non-critical — if it fails, nutrition extraction is skipped for this page.
    let operatorList: any = undefined
    try {
      operatorList = await page.getOperatorList()
    } catch {
      // silently skip
    }

    pages.push({ text: pageText, words, operatorList })
  }

  return { fullText, pages }
}

function buildPatientForm(data: ReportData | null): ExtractedPatient {
  if (!data?.patient) {
    return { name: '', age_sex: '', complaint: '', diet_type: '', medical_history: '', allergies: '' }
  }
  const p = data.patient
  const age_sex = p.age && p.gender
    ? `${p.age}${p.gender.toLowerCase().startsWith('m') ? 'M' : 'F'}`
    : ''
  return { name: p.name || '', age_sex, complaint: '', diet_type: '', medical_history: '', allergies: '' }
}

export async function extractFromPDF(file: File): Promise<PDFExtractResult> {
  const { fullText, pages } = await getPDFData(file)

  const speciesFromText = extractSpeciesFromText(fullText)

  // ── Extract nutrition client-side (operatorList can't survive JSON serialisation) ──
  let nutritionData: Record<string, Record<string, [string, string, string]>> | null = null
  try {
    console.log('[extractFromPDF] starting nutrition extraction, pages:', pages.length)
    const { extractNutritionFromPages } = await import('./extractNutrition')
    console.log('[extractFromPDF] extractNutritionFromPages imported OK')

    // BugSpeaks splits 'NUTRITIONAL REPORT' across two text items at slightly different Y.
    // Patch each page's text to ensure the trigger string is present if both words exist.
    const patchedPages = pages.map(p => {
      let text = p.text
      if (
        !text.includes('NUTRITIONAL REPORT') &&
        text.includes('NUTRITIONAL') &&
        text.includes('REPORT')
      ) {
        text = text.replace('NUTRITIONAL', 'NUTRITIONAL REPORT')
      }
      // Also handle 'Greens & Vegetables' as fallback trigger
      return { ...p, text }
    })

    // Debug: show what pages contain nutrition-related text
    const nutritionPageNums = patchedPages
      .map((p, i) => ({ i, hasNutritional: p.text.includes('NUTRITIONAL'), hasGreens: p.text.includes('Greens'), hasReport: p.text.includes('NUTRITIONAL REPORT') }))
      .filter(p => p.hasNutritional || p.hasGreens)
    console.log('[extractFromPDF] nutrition-related pages:', nutritionPageNums)
    if (nutritionPageNums.length > 0) {
      const idx = nutritionPageNums[0].i
      console.log('[extractFromPDF] page', idx, 'text sample:', patchedPages[idx].text.slice(0, 300))
      console.log('[extractFromPDF] page', idx, 'has operatorList:', !!patchedPages[idx].operatorList, 'fnArray length:', patchedPages[idx].operatorList?.fnArray?.length ?? 0)
    }

    nutritionData = extractNutritionFromPages(patchedPages) as Record<string, Record<string, [string, string, string]>> | null
    console.log('[extractFromPDF] nutrition extracted:', nutritionData ? Object.keys(nutritionData).length + ' categories' : 'null')
  } catch (e) {
    console.error('[extractFromPDF] nutrition extraction FAILED:', e instanceof Error ? e.message : String(e))
  }

  // Strip operatorList before JSON serialisation — it contains non-serialisable objects
  const pagesForAPI = pages.map(({ text, words }) => ({ text, words }))

  let reportData: ReportData | null = null

  try {
    const res = await fetch('/api/parse-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fullText, pages: pagesForAPI }),
    })
    if (res.ok) {
      const json = await res.json()
      reportData = json.data

      if (reportData) {
        if (reportData.species_list?.length > 0) {
          const allSpecies = new Set([...speciesFromText, ...reportData.species_list])
          reportData.species_list = Array.from(allSpecies)
        } else {
          reportData.species_list = speciesFromText
        }
        // Attach client-side nutrition extraction result
        if (nutritionData && Object.keys(nutritionData).length > 0) {
          ;(reportData as any).nutrition = nutritionData
        }
      }
    }
  } catch {
    reportData = null
  }

  if (!reportData) {
    reportData = {
      patient: null, rych_index: null, scfa: {}, vitamins: {},
      neurotransmitters: {}, macronutrients: {}, gut_function: {},
      intolerance: {}, endurance: {}, health_indicators: {},
      disease_risk: {}, diversity: {}, kingdom: {},
      antibiotic_recovery: null,
      probiotics: { absent: [], low_optimal: [], high_optimal: [], optimal: [], atypical_high: [] },
      probiotic_recommendations: [], pathogens_detected: [],
      species_list: speciesFromText,
    }
  }

  const species = reportData.species_list || speciesFromText
  const patient = buildPatientForm(reportData)

  return { species, patient, reportData, rawText: fullText }
}

export async function extractSpeciesFromPDF(file: File): Promise<string[]> {
  const result = await extractFromPDF(file)
  return result.species
}