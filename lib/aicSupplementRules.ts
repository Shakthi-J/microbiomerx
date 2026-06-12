// lib/aicSupplementRules.ts
// AIC Supplement Rules Engine — v1.0.0
// Deterministic mapping: report findings → AIC product recommendations
// AI NEVER generates supplement names or doses — this engine does that.
// Groq only writes the clinical rationale explanation.

export const AIC_RULES_VERSION = 'v1.0.0'

// ─── AIC Product Catalogue ────────────────────────────────────────────────────
// Source: AIC Medical Professional Product Guide (Sept 2025)
// Names are exact — do not alter

export const AIC_PRODUCTS = {
  COLOSTRUM_GUT_REVIVE: {
    name: 'Colostrum Gut Revive',
    subtitle: 'Leaky Gut Care Complex',
    dose: '1–2 scoops (6g) with breakfast drink',
    timing: 'With breakfast',
    phase: 1,
    category: 'gut_lining',
    ingredients: ['Native Cow Colostrum (70% protein, 40% IgG)', 'L-Glutamine', 'Zinc Carnosine', 'N-Acetyl D-Glucosamine', 'Slippery Elm bark', 'Marshmallow root', 'Aloe Vera'],
    note: 'Contains bovine colostrum — not suitable for strict vegans',
  },
  IBS_CARE: {
    name: 'IBS Care',
    subtitle: 'Promotes Intestinal Motility',
    dose: '1 cap before sleep',
    timing: 'Before sleep',
    phase: 1,
    category: 'probiotic',
    ingredients: ['Bacillus Subtilis 1B CFU', 'Bacillus Coagulans 1B CFU', 'Bacillus Clausii 1B CFU', 'Bacillus Licheniformis 1B CFU', 'Saccharomyces Boulardii 10B CFU', 'Protease', 'Lipase', 'Bromelain'],
    note: null,
  },
  BIOFILM_CARE: {
    name: 'Biofilm Care',
    subtitle: 'Biofilm Breaker',
    dose: '1 cap before sleep',
    timing: 'Before sleep (alongside probiotics)',
    phase: 2,
    category: 'infection_control',
    ingredients: ['Bacillus species', 'Protease', 'Lipase', 'Bromelain (biofilm matrix enzymes)'],
    note: 'Use when antibiotic resistance or low antibiotic recovery detected',
  },
  S_BOULARDII_CARE: {
    name: 'S. Boulardii Care',
    subtitle: 'Also known as Esboladi Care',
    dose: '1 cap at bedtime',
    timing: 'Bedtime — alternate nights with Optibiotic',
    phase: 2,
    category: 'probiotic',
    ingredients: ['Saccharomyces boulardii (high CFU)'],
    note: 'Alternate nights: S. Boulardii → Optibiotic → S. Boulardii → Optibiotic',
  },
  OPTIBIOTIC: {
    name: 'Optibiotic',
    subtitle: 'Spore Probiotic Care',
    dose: '1 cap at bedtime',
    timing: 'Bedtime — alternate nights with S. Boulardii Care',
    phase: 2,
    category: 'probiotic',
    ingredients: ['Tributyrin (butyrate precursor)', 'Lactobacillus strains', 'Bifidobacterium strains (spore-based)'],
    note: 'Spore-based — survives stomach acid. Primary SCFA/butyrate support',
  },
  CANDIDA_CARE: {
    name: 'Candida Care',
    subtitle: 'Broad Spectrum Probiotic',
    dose: '1 cap at bedtime',
    timing: 'Bedtime — alternate with Optibiotic',
    phase: 2,
    category: 'probiotic',
    ingredients: ['Phido strain', 'Streptococcus strain', 'Saccharomyces boulardii', '3 combined strains'],
    note: 'Use when Candida elevated OR multiple Lactobacillus/Bifidobacterium absent',
  },
  GUT_CLEANSE_CARE: {
    name: 'Gut Cleanse Care',
    subtitle: 'Month 1 Infection Control',
    dose: '1 cap after lunch + 1 cap after dinner',
    timing: 'After lunch and after dinner — Month 1 only, then rotate',
    phase: 2,
    category: 'infection_control',
    ingredients: ['Berberine', 'Betaine HCl'],
    note: 'Rotation: Month 1 = Gut Cleanse Care | Month 2 = Black Cumin Seed Oil | Month 3 = Oregano Oil',
    rotation: {
      month1: 'Gut Cleanse Care — 1 cap after lunch + 1 cap after dinner',
      month2: 'Black Cumin Seed Oil — 1 cap daily',
      month3: 'Oregano Oil — 1 cap daily',
    },
  },
  LYME_CO_CARE: {
    name: 'Lyme Co Care',
    subtitle: 'Parasitic / Multi-Infection Support',
    dose: '1–2 ml before evening meal',
    timing: 'Before dinner',
    phase: 2,
    category: 'infection_control',
    ingredients: ['Multi-herb parasitic + fungal + bacterial formula'],
    note: 'Parasitic protocol order: Month 1 = Lyme Co Care | Month 2 = Candida Care | Month 3 = Gut Cleanse Care',
  },
  TOTAL_ACTIVE_B: {
    name: 'Total Active B Complex',
    subtitle: 'Full B Vitamin + Amino Acid Support',
    dose: '1 cap after breakfast',
    timing: 'After breakfast',
    phase: 2,
    category: 'nutrition',
    ingredients: ['B1 2.3mg', 'B2 3.2mg', 'Niacinamide 23mg', 'B6 3.1mg', 'Methyl Folate 100mcg', 'B12 2.2mcg', 'Biotin 40mcg', 'Pantothenic Acid 5mg', 'Zinc Gluconate 10mg', 'Amino acid blend'],
    note: null,
  },
  BRAIN_HEART_CARE: {
    name: 'Brain + Heart Care',
    subtitle: 'Omega-3 / Gut-Brain Axis Support',
    dose: '10ml after dinner',
    timing: 'After dinner',
    phase: 2,
    category: 'nutrition',
    ingredients: ['Omega-3 fatty acids (EPA + DHA)'],
    note: 'Vegan Omega option available for plant-based patients',
  },
  ZMAG: {
    name: 'ZMAG',
    subtitle: 'Zinc + Magnesium Capsules',
    dose: '3 caps after dinner',
    timing: 'After dinner',
    phase: 2,
    category: 'nutrition',
    ingredients: ['Zinc', 'Magnesium (combined formula)'],
    note: 'Separate product from Optimal Magnesium Care — do not conflate',
  },
  OPTIMAL_MAGNESIUM: {
    name: 'Optimal Magnesium Care',
    subtitle: 'Magnesium Powder — Bedtime',
    dose: '1 scoop at bedtime (up to 2 scoops for severe constipation)',
    timing: 'Bedtime',
    phase: 2,
    category: 'nutrition',
    ingredients: ['Magnesium Citrate 200mg', 'Potassium Citrate 100mg', 'Calcium Citrate 100mg', 'Molybdenum 45mcg', 'Vitamin C 80mg'],
    note: 'Separate from ZMAG — this is powder format, primary for motility + sleep',
  },
  DIGEST_ALL_CARE: {
    name: 'Digest All Care',
    subtitle: 'Digestive Enzyme Support',
    dose: '1–2 caps with lunch + 1–2 caps with dinner',
    timing: 'WITH meals (not before, not after)',
    phase: 3,
    category: 'enzyme',
    ingredients: ['Protease', 'Amylase', 'Lipase', 'Ox Bile (standard) / Betaine HCl (veg variant)'],
    note: 'Two variants: Standard (non-veg, contains Ox Bile) | Veg Digest All Care (Betaine HCl). Clarify patient preference.',
  },
  TOXIN_CLEANSE: {
    name: 'Toxin Cleanse Care',
    subtitle: 'Binder + Detox Support',
    dose: 'As directed — 2+ hours away from ALL other supplements and food',
    timing: 'Away from all food and supplements (2+ hour window)',
    phase: 1,
    category: 'detox',
    ingredients: ['Activated charcoal', 'Diatomaceous earth', 'Kelp powder'],
    note: '⚠️ Confirm exact current product name with AIC. Binds minerals — NEVER take with other supplements.',
  },
  OPT_HISTAMINE: {
    name: 'Opt Histamine',
    subtitle: 'Histamine Sensitivity Support',
    dose: '1 scoop in water daily',
    timing: 'Daily (any time)',
    phase: 2,
    category: 'nutrition',
    ingredients: ['Stinging nettle', 'Bromelain', 'Licorice', 'Butterbur', 'Quercetin', 'NAC', 'Turmeric', 'Milk thistle', 'Papain (810mg blend)'],
    note: null,
  },
} as const

export type AICProductKey = keyof typeof AIC_PRODUCTS
export type AICProduct = typeof AIC_PRODUCTS[AICProductKey]

// ─── Finding Type ─────────────────────────────────────────────────────────────

export interface AICFinding {
  biomarker: string
  observed_value: string | number
  reference_range: string
  severity: 'critical' | 'high' | 'moderate' | 'low'
  clinical_note: string
}

// ─── Recommendation Type ──────────────────────────────────────────────────────

export interface AICRecommendation {
  product: AICProduct
  product_key: AICProductKey
  phase: 1 | 2 | 3
  priority: 'critical' | 'high' | 'moderate' | 'supportive'
  triggered_by: AICFinding[]       // which report findings triggered this
  rationale_prompt: string         // sent to Groq to write clinical rationale
  ai_rationale?: string            // filled in by Groq after API call
}

// ─── Rules Engine Output ──────────────────────────────────────────────────────

export interface AICRulesOutput {
  version: string
  patient_name: string
  rych_index: number
  phase1: AICRecommendation[]
  phase2_infection_control: AICRecommendation[]
  phase2_probiotics: AICRecommendation[]
  phase2_nutrition: AICRecommendation[]
  phase3: AICRecommendation[]
  clinical_warnings: string[]
  probiotic_alternation_schedule: string
  infection_control_rotation: string | null
  die_off_warning: boolean
  generated_at: string
}

// ─── Main Rules Engine ────────────────────────────────────────────────────────

export function runAICSupplementRules(reportData: Record<string, unknown>): AICRulesOutput {

  const findings: AICFinding[] = []
  const phase1: AICRecommendation[] = []
  const phase2Infection: AICRecommendation[] = []
  const phase2Probiotics: AICRecommendation[] = []
  const phase2Nutrition: AICRecommendation[] = []
  const phase3: AICRecommendation[] = []
  const warnings: string[] = []
  let needsInfectionControl = false
  let hasFungal = false
  let hasParasitic = false
  let needsDieOff = false

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const score = (key: string): number => {
    const val = reportData[key]
    return typeof val === 'number' ? val : parseFloat(String(val ?? '0')) || 0
  }

  const probiotics = (reportData.probiotics as Record<string, string>) ?? {}
  const isAbsent = (species: string): boolean => probiotics[species] === 'absent'

  const pathogens = (reportData.pathogens as Record<string, number>) ?? {}
  const pathogenElevated = (species: string, threshold = 0.02): boolean =>
    (pathogens[species] ?? 0) >= threshold

  const healthRisk = (reportData.health_indicators as Record<string, string>) ?? {}
  const isModerateOrHigh = (indicator: string): boolean =>
    ['moderate', 'high'].includes((healthRisk[indicator] ?? '').toLowerCase())

  const diseaseRisk = (reportData.disease_risk as Record<string, number>) ?? {}
  const diseaseOver = (condition: string, pct = 15): boolean =>
    (diseaseRisk[condition] ?? 0) >= pct

  // ── Rych Index ───────────────────────────────────────────────────────────────

  const rychIndex = score('rych_index')
  if (rychIndex < 40) {
    findings.push({
      biomarker: 'Rych Index',
      observed_value: rychIndex,
      reference_range: 'Ideal: 60–100',
      severity: rychIndex < 25 ? 'critical' : 'high',
      clinical_note: `Rych Index of ${rychIndex} indicates severely compromised gut health`,
    })
  }

  // ── PHASE 1: LEAKY GUT / GUT LINING ─────────────────────────────────────────

  const leakyGut = isModerateOrHigh('leaky_gut')
  const gutInflammation = isModerateOrHigh('gut_inflammation')
  const mineralBioavail = score('mineral_bioavailability') < 35

  if (leakyGut || gutInflammation) {
    const triggered: AICFinding[] = []

    if (leakyGut) triggered.push({
      biomarker: 'Leaky Gut Potential',
      observed_value: healthRisk['leaky_gut'] ?? 'Moderate',
      reference_range: 'Target: Low Risk',
      severity: 'high',
      clinical_note: 'Compromised gut barrier — must be addressed before infection control',
    })

    if (gutInflammation) triggered.push({
      biomarker: 'Potential Gut Inflammation',
      observed_value: healthRisk['gut_inflammation'] ?? 'Moderate',
      reference_range: 'Target: Low Risk',
      severity: 'high',
      clinical_note: 'Active gut inflammation detected — gut lining repair is priority',
    })

    phase1.push({
      product: AIC_PRODUCTS.COLOSTRUM_GUT_REVIVE,
      product_key: 'COLOSTRUM_GUT_REVIVE',
      phase: 1,
      priority: 'critical',
      triggered_by: triggered,
      rationale_prompt: `Patient has ${triggered.map(f => f.biomarker).join(' and ')}. Explain why Colostrum Gut Revive (with its IgG immunoglobulins, L-Glutamine, Zinc Carnosine, and Slippery Elm) is the first-line intervention to repair the gut lining before any infection control is started. Keep it to 2-3 clinical sentences.`,
    })
  }

  // IBS Care — Phase 1 (constipation, motility, absent Bacillus, absent S.boulardii)
  const constipationRisk = diseaseRisk['constipation'] ?? 0
  const motilityLow = score('intestinal_motility') < 60
  const bacillusAbsent = ['bacillus_clausii', 'bacillus_coagulans', 'bacillus_subtilis', 'bacillus_indicus'].some(s => isAbsent(s))
  const sBoulardiiAbsent = isAbsent('saccharomyces_boulardii')

  if (bacillusAbsent || sBoulardiiAbsent || constipationRisk > 20 || motilityLow) {
    const triggered: AICFinding[] = []

    if (bacillusAbsent) triggered.push({
      biomarker: 'Bacillus Species (Probiotic)',
      observed_value: 'ABSENT (0.000)',
      reference_range: 'Should be present',
      severity: 'high',
      clinical_note: 'One or more Bacillus strains completely absent from gut microbiome',
    })

    if (sBoulardiiAbsent) triggered.push({
      biomarker: 'Saccharomyces boulardii',
      observed_value: 'ABSENT (0.000)',
      reference_range: 'Should be present',
      severity: 'high',
      clinical_note: 'S. boulardii absent — critical for inflammation control and neurotransmitter support',
    })

    if (constipationRisk > 20) triggered.push({
      biomarker: 'Constipation Risk',
      observed_value: `${constipationRisk.toFixed(1)}%`,
      reference_range: 'Target: <15%',
      severity: constipationRisk > 35 ? 'high' : 'moderate',
      clinical_note: `${constipationRisk.toFixed(1)}% constipation predisposition — motility support needed`,
    })

    if (motilityLow) triggered.push({
      biomarker: 'Intestinal Motility Potential',
      observed_value: score('intestinal_motility').toFixed(1),
      reference_range: 'Ideal: >62',
      severity: 'moderate',
      clinical_note: 'Low intestinal motility — supports constipation risk',
    })

    phase1.push({
      product: AIC_PRODUCTS.IBS_CARE,
      product_key: 'IBS_CARE',
      phase: 1,
      priority: bacillusAbsent || sBoulardiiAbsent ? 'critical' : 'high',
      triggered_by: triggered,
      rationale_prompt: `Patient shows: ${triggered.map(f => `${f.biomarker} (${f.observed_value})`).join(', ')}. Explain in 2-3 clinical sentences why IBS Care is indicated — covering how Bacillus strains and S. boulardii (10B CFU) together address gut dysbiosis, restore motility, and reduce inflammation.`,
    })
  }

  // Toxin Cleanse — Phase 1 (TMAO or significant infection control planned)
  const tmao = isModerateOrHigh('tmao_production')
  if (tmao) {
    phase1.push({
      product: AIC_PRODUCTS.TOXIN_CLEANSE,
      product_key: 'TOXIN_CLEANSE',
      phase: 1,
      priority: 'moderate',
      triggered_by: [{
        biomarker: 'TMAO Production Potential',
        observed_value: healthRisk['tmao_production'] ?? 'Moderate',
        reference_range: 'Target: Low Risk',
        severity: 'moderate',
        clinical_note: 'Elevated TMAO indicates toxic metabolite burden — binder support needed',
      }],
      rationale_prompt: `Patient has ${healthRisk['tmao_production']} TMAO production risk. Explain in 2 sentences why a binder (activated charcoal + diatomaceous earth) is used during treatment to capture toxic metabolites and TMAO precursors before they enter circulation. Note it must be taken 2+ hours away from all other supplements.`,
    })
    needsDieOff = true
  }

  // ── PHASE 2: INFECTION CONTROL ──────────────────────────────────────────────

  // Pathogen-driven infection control
  const bacterialPathogens = [
    'helicobacter_pylori', 'klebsiella_pneumoniae', 'shigella_dysenteriae',
    'fusobacterium_nucleatum', 'clostridioides_difficile',
  ]
  const hasBacterialPathogen = bacterialPathogens.some(p => pathogenElevated(p))
  const prevatellaDominant = (pathogens['prevotella_copri'] ?? 0) >= 0.25
  const blastocystisElevated = pathogenElevated('blastocystis_hominis', 0.01)

  if (hasBacterialPathogen || prevatellaDominant || blastocystisElevated) {
    const triggered: AICFinding[] = []
    needsInfectionControl = true
    needsDieOff = true

    bacterialPathogens.forEach(p => {
      if (pathogenElevated(p)) triggered.push({
        biomarker: p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        observed_value: `${((pathogens[p] ?? 0) * 100).toFixed(3)}% abundance`,
        reference_range: 'Should be in Safe Zone (Bins 1–3)',
        severity: 'high',
        clinical_note: `${p.replace(/_/g, ' ')} in Warning/Danger Zone`,
      })
    })

    if (prevatellaDominant) triggered.push({
      biomarker: 'Prevotella copri',
      observed_value: `${((pathogens['prevotella_copri'] ?? 0) * 100).toFixed(1)}% dominance`,
      reference_range: 'Healthy: <25% relative abundance',
      severity: 'high',
      clinical_note: 'Prevotella copri overgrowth linked to gut inflammation and autoimmune risk',
    })

    phase2Infection.push({
      product: AIC_PRODUCTS.GUT_CLEANSE_CARE,
      product_key: 'GUT_CLEANSE_CARE',
      phase: 2,
      priority: 'high',
      triggered_by: triggered,
      rationale_prompt: `Patient has the following pathogens elevated: ${triggered.map(f => f.biomarker).join(', ')}. Explain in 2-3 clinical sentences how berberine (in Gut Cleanse Care) works as a broad-spectrum antimicrobial against these specific organisms, and why it should be given for only 1 month then rotated to Black Cumin Seed Oil (Month 2) and Oregano Oil (Month 3) to prevent resistance.`,
    })
  }

  // Biofilm Care — low antibiotic recovery or resistance
  const antibioticRecovery = score('antibiotic_recovery') < 60
  const hasResistance = Array.isArray(reportData.antibiotic_resistance) &&
    (reportData.antibiotic_resistance as string[]).some(r =>
      r.toLowerCase().includes('resistant'))

  if (antibioticRecovery || hasResistance) {
    phase2Infection.push({
      product: AIC_PRODUCTS.BIOFILM_CARE,
      product_key: 'BIOFILM_CARE',
      phase: 2,
      priority: hasResistance ? 'critical' : 'high',
      triggered_by: [{
        biomarker: hasResistance ? 'Antibiotic Resistance' : 'Antibiotic Recovery Potential',
        observed_value: hasResistance ? 'Resistant genes detected' : score('antibiotic_recovery').toFixed(1),
        reference_range: 'Target: >65',
        severity: hasResistance ? 'critical' : 'high',
        clinical_note: hasResistance
          ? 'Antibiotic resistance genes detected — biofilm-sheltered pathogens likely'
          : 'Low antibiotic recovery — pathogens may be protected by biofilm matrix',
      }],
      rationale_prompt: `Patient has ${hasResistance ? 'antibiotic resistance genes detected' : `low antibiotic recovery potential (${score('antibiotic_recovery').toFixed(1)})`}. Explain in 2 sentences why Biofilm Care (Bacillus species + protease/lipase/bromelain enzymes) is needed to physically break down the polysaccharide biofilm matrix that protects pathogens from antimicrobials.`,
    })
  }

  // Parasitic/Fungal pathogens — Lyme Co Care
  const parasiticPathogens = ['cryptosporidium', 'giardia_intestinalis', 'entamoeba_histolytica']
  hasParasitic = parasiticPathogens.some(p => pathogenElevated(p, 0.005))
  const candidas = ['candida_albicans', 'candida_tropicalis', 'candida_glabrata', 'candida_krusei']
  hasFungal = candidas.some(p => pathogenElevated(p, 0.01))

  if (hasParasitic) {
    const triggered: AICFinding[] = parasiticPathogens
      .filter(p => pathogenElevated(p, 0.005))
      .map(p => ({
        biomarker: p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        observed_value: `${((pathogens[p] ?? 0) * 100).toFixed(3)}% abundance`,
        reference_range: 'Should be absent or in Safe Zone',
        severity: 'high' as const,
        clinical_note: `Parasitic pathogen detected — requires dedicated anti-parasitic protocol`,
      }))

    phase2Infection.push({
      product: AIC_PRODUCTS.LYME_CO_CARE,
      product_key: 'LYME_CO_CARE',
      phase: 2,
      priority: 'high',
      triggered_by: triggered,
      rationale_prompt: `Patient has parasitic pathogens: ${triggered.map(f => f.biomarker).join(', ')}. Explain in 2-3 sentences why Lyme Co Care (multi-herb parasitic formula) should be used in Month 1, followed by Candida Care (Month 2) and Gut Cleanse Care/berberine (Month 3) in the infection control rotation.`,
    })
    needsDieOff = true
    needsInfectionControl = true
  }

  // ── PHASE 2: PROBIOTICS ──────────────────────────────────────────────────────

  // S. Boulardii Care — if absent (separately from IBS Care)
  if (sBoulardiiAbsent) {
    phase2Probiotics.push({
      product: AIC_PRODUCTS.S_BOULARDII_CARE,
      product_key: 'S_BOULARDII_CARE',
      phase: 2,
      priority: 'high',
      triggered_by: [{
        biomarker: 'Saccharomyces boulardii',
        observed_value: 'ABSENT (0.000)',
        reference_range: 'Should be present',
        severity: 'high',
        clinical_note: 'S. boulardii absent — critical for reducing gut inflammation, supporting neurotransmitter production, and managing IBS symptoms',
      }],
      rationale_prompt: `Saccharomyces boulardii is completely absent (0.000) in this patient's gut microbiome. Explain in 2 sentences the clinical importance of S. boulardii for gut inflammation reduction, neurotransmitter support (serotonin/GABA pathway), and digestive symptom management. Mention it should be alternated nightly with Optibiotic.`,
    })
  }

  // Optibiotic — low SCFA / low butyrate / absent Lactobacillus/Bifido
  const butyrateScore = score('butyrate')
  const propionateScore = score('propionate')
  const acetateScore = score('acetate')
  const lactobacillusAbsent = ['lactobacillus_acidophilus', 'lactobacillus_plantarum', 'lactobacillus_rhamnosus', 'lactobacillus_bulgaricus'].some(s => isAbsent(s))
  const bifidoAbsent = isAbsent('bifidobacterium_animalis') || isAbsent('bifidobacterium_lactis')

  if (butyrateScore < 55 || propionateScore < 45 || acetateScore < 65 || lactobacillusAbsent || bifidoAbsent) {
    const triggered: AICFinding[] = []

    if (butyrateScore < 55) triggered.push({
      biomarker: 'Butyrate Production Potential',
      observed_value: butyrateScore.toFixed(1),
      reference_range: 'Ideal: >59.9',
      severity: 'high',
      clinical_note: 'Low butyrate — primary fuel for colonocytes; essential for gut lining integrity',
    })

    if (propionateScore < 45) triggered.push({
      biomarker: 'Propionate Production Potential',
      observed_value: propionateScore.toFixed(1),
      reference_range: 'Ideal: >53.9',
      severity: 'moderate',
      clinical_note: 'Low propionate — needed for hepatic glucose metabolism',
    })

    if (acetateScore < 65) triggered.push({
      biomarker: 'Acetate Production Potential',
      observed_value: acetateScore.toFixed(1),
      reference_range: 'Ideal: >71.7',
      severity: 'moderate',
      clinical_note: 'Low acetate — required for peripheral glucose metabolism and energy',
    })

    if (lactobacillusAbsent) triggered.push({
      biomarker: 'Lactobacillus Species (Multiple)',
      observed_value: 'ABSENT (0.000)',
      reference_range: 'Should be present',
      severity: 'high',
      clinical_note: 'Multiple Lactobacillus strains absent — gut barrier and immune function compromised',
    })

    if (bifidoAbsent) triggered.push({
      biomarker: 'Bifidobacterium animalis / B. lactis',
      observed_value: 'ABSENT (0.000)',
      reference_range: 'Should be present',
      severity: 'high',
      clinical_note: 'Key Bifidobacterium strains absent — SCFA production and immune modulation impaired',
    })

    phase2Probiotics.push({
      product: AIC_PRODUCTS.OPTIBIOTIC,
      product_key: 'OPTIBIOTIC',
      phase: 2,
      priority: butyrateScore < 45 ? 'critical' : 'high',
      triggered_by: triggered,
      rationale_prompt: `Patient shows: ${triggered.map(f => `${f.biomarker} (${f.observed_value})`).join(', ')}. Explain in 2-3 sentences why Optibiotic (spore-based probiotic with tributyrin) is the primary intervention — covering how tributyrin directly feeds butyrate-producing bacteria, why the spore format is necessary for survival through stomach acid, and that it should alternate nightly with S. Boulardii Care.`,
    })
  }

  // Candida Care — if Candida elevated OR widespread Lactobacillus/Bifido absence
  const candida = hasFungal
  const widespreadLactoAbsence = ['lactobacillus_acidophilus', 'lactobacillus_plantarum', 'lactobacillus_gasseri', 'lactobacillus_reuteri', 'lactobacillus_helveticus'].filter(s => isAbsent(s)).length >= 3

  if (candida || widespreadLactoAbsence) {
    const triggered: AICFinding[] = []

    if (candida) triggered.push({
      biomarker: 'Candida Species',
      observed_value: 'Elevated (Warning/Danger Zone)',
      reference_range: 'Should be in Safe Zone',
      severity: 'high',
      clinical_note: 'Candida overgrowth detected — broad-spectrum probiotic needed alongside anti-fungal',
    })

    if (widespreadLactoAbsence) triggered.push({
      biomarker: 'Multiple Lactobacillus Strains',
      observed_value: '3+ strains ABSENT',
      reference_range: 'All should be present',
      severity: 'high',
      clinical_note: 'Widespread Lactobacillus depletion — broad-spectrum probiotic replenishment needed',
    })

    phase2Probiotics.push({
      product: AIC_PRODUCTS.CANDIDA_CARE,
      product_key: 'CANDIDA_CARE',
      phase: 2,
      priority: candida ? 'critical' : 'high',
      triggered_by: triggered,
      rationale_prompt: `Patient has ${triggered.map(f => f.biomarker).join(' and ')}. Explain in 2 sentences why Candida Care (3-strain broad-spectrum probiotic including S. boulardii) is indicated — covering how it addresses both Candida overgrowth and the widespread probiotic deficiency simultaneously. Mention it should alternate nightly with Optibiotic.`,
    })
  }

  // ── PHASE 2: NUTRITION ───────────────────────────────────────────────────────

  // Total Active B Complex — low vitamin production
  const bVitaminsLow = [
    score('vitamin_b1') < 42,
    score('vitamin_b2') < 40,
    score('vitamin_b3') < 43,
    score('vitamin_b5') < 47,
    score('vitamin_b6') < 43,
    score('vitamin_b7') < 47,
    score('vitamin_b12') < 47,
    score('vitamin_c') < 28,
  ].filter(Boolean).length

  if (bVitaminsLow >= 3) {
    const lowVits = [
      { key: 'vitamin_b1', label: 'B1', ideal: 42 },
      { key: 'vitamin_b2', label: 'B2', ideal: 40 },
      { key: 'vitamin_b3', label: 'B3', ideal: 43 },
      { key: 'vitamin_b5', label: 'B5', ideal: 47 },
      { key: 'vitamin_b6', label: 'B6', ideal: 43 },
      { key: 'vitamin_b7', label: 'B7', ideal: 47 },
      { key: 'vitamin_b12', label: 'B12', ideal: 47 },
      { key: 'vitamin_c', label: 'Vitamin C', ideal: 28 },
    ].filter(v => score(v.key) < v.ideal)

    phase2Nutrition.push({
      product: AIC_PRODUCTS.TOTAL_ACTIVE_B,
      product_key: 'TOTAL_ACTIVE_B',
      phase: 2,
      priority: bVitaminsLow >= 5 ? 'high' : 'moderate',
      triggered_by: lowVits.map(v => ({
        biomarker: `Vitamin ${v.label} Production Potential`,
        observed_value: score(v.key).toFixed(1),
        reference_range: `Ideal: >${v.ideal}`,
        severity: 'moderate' as const,
        clinical_note: `Gut microbiome is not producing adequate ${v.label}`,
      })),
      rationale_prompt: `Patient's gut microbiome shows low production potential for ${lowVits.map(v => `Vitamin ${v.label}`).join(', ')}. Explain in 2 sentences why exogenous B vitamin supplementation (Total Active B Complex) is needed while the microbiome is being rebuilt, and how the amino acid blend in the formula supports neurotransmitter precursor availability.`,
    })
  }

  // Brain + Heart Care — low neurotransmitters
  const gabaLow = score('gaba') < 50
  const tryptophanLow = score('tryptophan') < 38
  const acetylcholineLow = score('acetylcholine') < 25
  const tryptamineLow = score('tryptamine') < 18

  if (gabaLow || tryptophanLow || acetylcholineLow) {
    const triggered: AICFinding[] = []

    if (gabaLow) triggered.push({ biomarker: 'GABA Production Potential', observed_value: score('gaba').toFixed(1), reference_range: 'Ideal: >52.7', severity: 'high', clinical_note: 'Low GABA — anxiety, poor sleep, nervous system imbalance' })
    if (tryptophanLow) triggered.push({ biomarker: 'Tryptophan Production Potential', observed_value: score('tryptophan').toFixed(1), reference_range: 'Ideal: >40.7', severity: 'high', clinical_note: 'Low Tryptophan — serotonin precursor deficiency' })
    if (acetylcholineLow) triggered.push({ biomarker: 'Acetylcholine Production Potential', observed_value: score('acetylcholine').toFixed(1), reference_range: 'Ideal: >26.2', severity: 'moderate', clinical_note: 'Low Acetylcholine — cognition and memory affected' })
    if (tryptamineLow) triggered.push({ biomarker: 'Tryptamine Production Potential', observed_value: score('tryptamine').toFixed(1), reference_range: 'Ideal: >20.1', severity: 'moderate', clinical_note: 'Low Tryptamine — gut-brain signalling disrupted' })

    phase2Nutrition.push({
      product: AIC_PRODUCTS.BRAIN_HEART_CARE,
      product_key: 'BRAIN_HEART_CARE',
      phase: 2,
      priority: gabaLow && tryptophanLow ? 'high' : 'moderate',
      triggered_by: triggered,
      rationale_prompt: `Patient shows low production potential for: ${triggered.map(f => f.biomarker).join(', ')}. Explain in 2-3 sentences how Omega-3 (Brain + Heart Care) supports the gut-brain axis, reduces neuroinflammation, and aids neurotransmitter synthesis — particularly for GABA and serotonin pathways dependent on gut microbiome health.`,
    })
  }

  // ZMAG — low mineral bioavailability or endurance
  const mineralLow = score('mineral_bioavailability') < 35
  const enduranceLow = score('physical_endurance') < 40 || score('aerobic_endurance') < 50

  if (mineralLow || enduranceLow) {
    phase2Nutrition.push({
      product: AIC_PRODUCTS.ZMAG,
      product_key: 'ZMAG',
      phase: 2,
      priority: mineralLow ? 'high' : 'moderate',
      triggered_by: [
        ...(mineralLow ? [{
          biomarker: 'Mineral Bioavailability Potential',
          observed_value: score('mineral_bioavailability').toFixed(1),
          reference_range: 'Ideal: >35.9',
          severity: 'high' as const,
          clinical_note: 'Gut cannot absorb minerals properly — zinc and magnesium deficiency risk',
        }] : []),
        ...(enduranceLow ? [{
          biomarker: 'Physical/Aerobic Endurance Potential',
          observed_value: `${score('physical_endurance').toFixed(1)} / ${score('aerobic_endurance').toFixed(1)}`,
          reference_range: 'Physical: >46 | Aerobic: >59',
          severity: 'moderate' as const,
          clinical_note: 'Low endurance correlates with zinc-magnesium depletion in the microbiome',
        }] : []),
      ],
      rationale_prompt: `Patient has ${mineralLow ? `low Mineral Bioavailability (${score('mineral_bioavailability').toFixed(1)})` : ''}${mineralLow && enduranceLow ? ' and ' : ''}${enduranceLow ? 'low endurance potential' : ''}. Explain in 2 sentences why zinc-magnesium supplementation (ZMAG capsules) is needed, and how compromised gut lining directly causes mineral malabsorption regardless of dietary intake.`,
    })
  }

  // Optimal Magnesium Care — constipation, motility, poor sleep
  const sleepRelated = gabaLow || tryptophanLow

  if (constipationRisk > 15 || motilityLow || sleepRelated) {
    phase2Nutrition.push({
      product: AIC_PRODUCTS.OPTIMAL_MAGNESIUM,
      product_key: 'OPTIMAL_MAGNESIUM',
      phase: 2,
      priority: constipationRisk > 35 ? 'high' : 'moderate',
      triggered_by: [
        ...(constipationRisk > 15 ? [{
          biomarker: 'Constipation Risk',
          observed_value: `${constipationRisk.toFixed(1)}%`,
          reference_range: 'Target: <15%',
          severity: (constipationRisk > 35 ? 'high' : 'moderate') as 'high' | 'moderate',
          clinical_note: 'Constipation predisposition — magnesium supports bowel regularity',
        }] : []),
        ...(motilityLow ? [{
          biomarker: 'Intestinal Motility Potential',
          observed_value: score('intestinal_motility').toFixed(1),
          reference_range: 'Ideal: >62',
          severity: 'moderate' as const,
          clinical_note: 'Low motility — magnesium relaxes intestinal smooth muscle',
        }] : []),
        ...(sleepRelated ? [{
          biomarker: 'GABA / Tryptophan (Sleep)',
          observed_value: 'LOW',
          reference_range: 'Both should be in ideal range',
          severity: 'moderate' as const,
          clinical_note: 'Low GABA/Tryptophan production — magnesium glycinate supports sleep quality',
        }] : []),
      ],
      rationale_prompt: `Patient has ${[constipationRisk > 15 ? `constipation risk (${constipationRisk.toFixed(1)}%)` : '', motilityLow ? 'low intestinal motility' : '', sleepRelated ? 'low GABA/Tryptophan (sleep disruption)' : ''].filter(Boolean).join(', ')}. Explain in 2 sentences why Optimal Magnesium Care (magnesium citrate/potassium blend, bedtime powder) directly addresses both bowel regularity through smooth muscle relaxation and sleep quality through magnesium's role in GABA receptor activation.`,
    })
  }

  // Opt Histamine — if histamine sensitivity low in intolerances OR histamine atypically high
  const histamineSensLow = score('histamine_sensitivity') < 55
  const histamineHigh = (reportData.neurotransmitters as Record<string, string>)?.histamine === 'atypical_high'

  if (histamineSensLow || histamineHigh) {
    phase2Nutrition.push({
      product: AIC_PRODUCTS.OPT_HISTAMINE,
      product_key: 'OPT_HISTAMINE',
      phase: 2,
      priority: 'moderate',
      triggered_by: [{
        biomarker: histamineHigh ? 'Histamine Production (Atypically High)' : 'Histamine Sensitivity Management',
        observed_value: histamineHigh ? 'Atypical High' : score('histamine_sensitivity').toFixed(1),
        reference_range: histamineHigh ? 'Should be Optimal' : 'Ideal: >45.6',
        severity: 'moderate',
        clinical_note: histamineHigh ? 'Gut is overproducing histamine — anti-histamine support needed' : 'Low histamine sensitivity management — dietary histamine reactions likely',
      }],
      rationale_prompt: `Patient has ${histamineHigh ? 'atypically high histamine production' : 'low histamine sensitivity management'}. Explain in 2 sentences how Opt Histamine (quercetin, NAC, stinging nettle, milk thistle blend) works to naturally reduce histamine burden and support DAO enzyme activity that breaks down dietary histamine.`,
    })
  }

  // ── PHASE 3: ENZYME SUPPORT ──────────────────────────────────────────────────

  const carbMetLow = score('carbohydrate_metabolism') < 28
  const fatMetLow = score('fat_metabolism') < 39
  const proteinMetLow = score('protein_metabolism') < 45

  if (carbMetLow || fatMetLow || proteinMetLow) {
    const triggered: AICFinding[] = [
      ...(carbMetLow ? [{ biomarker: 'Carbohydrate Metabolism Potential', observed_value: score('carbohydrate_metabolism').toFixed(1), reference_range: 'Ideal: >29.7', severity: 'moderate' as const, clinical_note: 'Low carbohydrate metabolic capacity' }] : []),
      ...(fatMetLow ? [{ biomarker: 'Fat Metabolism Potential', observed_value: score('fat_metabolism').toFixed(1), reference_range: 'Ideal: >40.9', severity: 'moderate' as const, clinical_note: 'Low fat metabolism — bile acid and lipase activity insufficient' }] : []),
      ...(proteinMetLow ? [{ biomarker: 'Protein Metabolism Potential', observed_value: score('protein_metabolism').toFixed(1), reference_range: 'Ideal: >46.2', severity: 'moderate' as const, clinical_note: 'Low protein metabolism — proteolytic enzyme support needed' }] : []),
    ]

    phase3.push({
      product: AIC_PRODUCTS.DIGEST_ALL_CARE,
      product_key: 'DIGEST_ALL_CARE',
      phase: 3,
      priority: 'supportive',
      triggered_by: triggered,
      rationale_prompt: `Patient's gut shows low potential for: ${triggered.map(f => f.biomarker).join(', ')}. Explain in 2 sentences why digestive enzyme supplementation (Digest All Care — protease, amylase, lipase ± ox bile) is introduced in Phase 3 only, after gut lining is healed, to bridge the gap in macronutrient processing while the microbiome continues to rebuild. Note the veg/non-veg variant difference.`,
    })
  }

  // ── WARNINGS ─────────────────────────────────────────────────────────────────

  if (needsDieOff) {
    warnings.push('⚠️ Die-off Warning: Before starting infection control (Week 3), advise die-off remedies: rotate boiled ginger water, fennel seed water, Eno on empty stomach, activated charcoal. If severe flare-up occurs — reduce to half dose for 2–3 days, then resume.')
  }

  if (needsInfectionControl) {
    warnings.push('⚠️ Never run two antimicrobials simultaneously — rotate monthly. Never use the same antimicrobial >1 month continuously.')
  }

  if (leakyGut || gutInflammation) {
    warnings.push('⚠️ Gut lining first: Do NOT start infection control (Gut Cleanse Care etc.) until Phase 1 (Colostrum Gut Revive) has been completed for 2 weeks.')
  }

  const vegPatient = false // TODO: pull from patient conditions when available
  if (!vegPatient) {
    warnings.push('ℹ️ Colostrum Gut Revive contains bovine colostrum. Standard Digest All Care contains Ox Bile. Confirm patient dietary preference and use Veg variants if needed.')
  }

  // ── SCHEDULES ─────────────────────────────────────────────────────────────────

  const hasBothProbiotics = phase2Probiotics.some(r => r.product_key === 'S_BOULARDII_CARE') &&
    phase2Probiotics.some(r => r.product_key === 'OPTIBIOTIC')

  const probioticSchedule = hasBothProbiotics
    ? 'Night 1: S. Boulardii Care (1 cap) → Night 2: Optibiotic (1 cap) → Repeat. Never give same probiotic two nights in a row.'
    : phase2Probiotics.length > 0
      ? `${phase2Probiotics[0]?.product.name ?? 'Probiotic'}: 1 cap nightly`
      : 'No specific alternation needed based on current report findings.'

  const infectionRotation = needsInfectionControl
    ? 'Month 1: Gut Cleanse Care (1 cap after lunch + 1 cap after dinner) | Month 2: Black Cumin Seed Oil (1 cap/day) | Month 3: Oregano Oil (1 cap/day)'
    : hasParasitic
      ? 'Month 1: Lyme Co Care (1–2ml before dinner) | Month 2: Candida Care (1 cap bedtime) | Month 3: Gut Cleanse Care (1 cap after lunch + dinner)'
      : null

  return {
    version: AIC_RULES_VERSION,
    patient_name: String(reportData.patient_name ?? 'Patient'),
    rych_index: rychIndex,
    phase1,
    phase2_infection_control: phase2Infection,
    phase2_probiotics: phase2Probiotics,
    phase2_nutrition: phase2Nutrition,
    phase3,
    clinical_warnings: warnings,
    probiotic_alternation_schedule: probioticSchedule,
    infection_control_rotation: infectionRotation,
    die_off_warning: needsDieOff,
    generated_at: new Date().toISOString(),
  }
}