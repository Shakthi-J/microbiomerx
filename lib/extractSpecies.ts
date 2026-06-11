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

// ── Nutrition trigger keywords — only pages with these get operatorList ───────
const NUTRITION_TRIGGERS = ['NUTRITIONAL', 'Greens', 'Vegetables', 'Legumes', 'Cereals']

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

type PageData = { text: string; words: any[]; operatorList?: any }

// ── Process a single page — text only, no operatorList ───────────────────────
async function extractPageText(
  pdf: any,
  pageNum: number
): Promise<{ text: string; words: any[] }> {
  const page    = await pdf.getPage(pageNum)
  const content = await page.getTextContent()
  const items   = content.items as any[]

  const lineMap = new Map<number, string[]>()
  const words: any[] = []

  for (const item of items) {
    if (!item.str?.trim()) continue
    const y = Math.round(item.transform?.[5] || 0)
    const x = item.transform?.[4] || 0
    const top = item.transform?.[5] || 0

    if (!lineMap.has(y)) lineMap.set(y, [])
    lineMap.get(y)!.push(item.str)

    const wordTokens = item.str.trim().split(/\s+/)
    let xOffset = x
    for (const token of wordTokens) {
      if (token) {
        words.push({ text: token, x0: xOffset, top: 850 - top })
        xOffset += token.length * 4
      }
    }
  }

  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
  let text = ''
  for (const y of sortedYs) {
    const line = lineMap.get(y)!.join(' ').trim()
    if (line) text += line + '\n'
  }

  return { text: text + '\n', words }
}

// ── Fetch operatorList for a single page (nutrition pages only) ───────────────
async function attachOperatorList(pdf: any, pageNum: number): Promise<any> {
  try {
    const page = await pdf.getPage(pageNum)
    return await page.getOperatorList()
  } catch {
    return undefined
  }
}

async function getPDFData(file: File): Promise<{ fullText: string; pages: PageData[] }> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // ── Pass 1: extract text from ALL pages in parallel ──────────────────────
  const textResults = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) => extractPageText(pdf, i + 1))
  )

  const fullText = textResults.map(r => r.text).join('')

  // ── Pass 2: fetch operatorList ONLY for nutrition pages, also in parallel ─
  // Patch nutrition trigger before checking so split text items are caught
  const patchedTexts = textResults.map(r => {
    let text = r.text
    if (!text.includes('NUTRITIONAL REPORT') && text.includes('NUTRITIONAL') && text.includes('REPORT')) {
      text = text.replace('NUTRITIONAL', 'NUTRITIONAL REPORT')
    }
    return text
  })

  const nutritionPageIndices = patchedTexts
    .map((text, i) => ({ i, isNutrition: NUTRITION_TRIGGERS.some(t => text.includes(t)) }))
    .filter(p => p.isNutrition)
    .map(p => p.i)

  console.log(`[getPDFData] ${pdf.numPages} pages total, ${nutritionPageIndices.length} nutrition pages`)

  // Fetch operator lists for nutrition pages only — all in parallel
  const operatorListMap = new Map<number, any>()
  await Promise.all(
    nutritionPageIndices.map(async (idx) => {
      const opList = await attachOperatorList(pdf, idx + 1)
      if (opList) operatorListMap.set(idx, opList)
    })
  )

  // ── Assemble final pages array ────────────────────────────────────────────
  const pages: PageData[] = textResults.map((r, i) => ({
    text:         patchedTexts[i],
    words:        r.words,
    operatorList: operatorListMap.get(i),
  }))

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
  // ── PDF parsing + API call run concurrently ───────────────────────────────
  // getPDFData is now fast (parallel pages), so we start it and the API call together
  const pdfDataPromise = getPDFData(file)

  // Wait for PDF data first (needed to build the API body)
  const { fullText, pages } = await pdfDataPromise

  const speciesFromText = extractSpeciesFromText(fullText)

  // ── Nutrition extraction + API call run concurrently ─────────────────────
  const [nutritionData, reportDataRaw] = await Promise.all([
    // Nutrition extraction (client-side, uses operatorList)
    (async () => {
      try {
        const { extractNutritionFromPages } = await import('./extractNutrition')
        const result = extractNutritionFromPages(pages) as Record<string, Record<string, [string, string, string]>> | null
        console.log('[extractFromPDF] nutrition:', result ? Object.keys(result).length + ' categories' : 'null')
        return result
      } catch (e) {
        console.error('[extractFromPDF] nutrition failed:', e instanceof Error ? e.message : String(e))
        return null
      }
    })(),

    // API call for full report parsing (runs at same time as nutrition)
    (async () => {
      try {
        const pagesForAPI = pages.map(({ text, words }) => ({ text, words }))
        const res = await fetch('/api/parse-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, pages: pagesForAPI }),
        })
        if (!res.ok) return null
        const json = await res.json()
        return json.data as ReportData | null
      } catch {
        return null
      }
    })(),
  ])

  // ── Merge results ─────────────────────────────────────────────────────────
  let reportData: ReportData | null = reportDataRaw

  if (reportData) {
    // Merge species
    if (reportData.species_list?.length > 0) {
      reportData.species_list = Array.from(new Set([...speciesFromText, ...reportData.species_list]))
    } else {
      reportData.species_list = speciesFromText
    }
    // Attach nutrition
    if (nutritionData && Object.keys(nutritionData).length > 0) {
      ;(reportData as any).nutrition = nutritionData
    }
  } else {
    // Fallback if API failed
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