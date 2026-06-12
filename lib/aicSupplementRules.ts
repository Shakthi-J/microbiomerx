// lib/aicSupplementRules.ts
// AIC Supplement Rules Engine — v2.0.0
//
// ARCHITECTURE:
// - AIC product catalogue lives in Supabase (aic_products table)
// - This file contains ONLY the rules logic (which findings trigger which product_key)
// - Product details (name, dose, timing, ingredients, note) are fetched from Supabase at runtime
// - To add/update a supplement: update Supabase only — no code change needed

export const AIC_RULES_VERSION = 'v2.0.0'

// ─── Types ────────────────────────────────────────────────────────────────────

// Shape of a row from aic_products table in Supabase
export interface AICProduct {
  product_key: string
  name:        string
  subtitle:    string | null
  dose:        string | null
  timing:      string | null
  phase:       1 | 2 | 3
  category:    string
  ingredients: string[] | null
  note:        string | null
  rotation:    { month1: string; month2: string; month3: string } | null
  active:      boolean
}

export interface AICFinding {
  biomarker:          string
  observed_value:     string | number
  reference_range:    string
  severity:           'critical' | 'high' | 'moderate' | 'low'
  clinical_note:      string
}

export interface AICRecommendation {
  product:         AICProduct
  product_key:     string
  phase:           1 | 2 | 3
  priority:        'critical' | 'high' | 'moderate' | 'supportive'
  triggered_by:    AICFinding[]
  rationale_prompt: string
  ai_rationale?:   string
}

export interface AICRulesOutput {
  version:                      string
  patient_name:                 string
  rych_index:                   number
  phase1:                       AICRecommendation[]
  phase2_infection_control:     AICRecommendation[]
  phase2_probiotics:            AICRecommendation[]
  phase2_nutrition:             AICRecommendation[]
  phase3:                       AICRecommendation[]
  clinical_warnings:            string[]
  probiotic_alternation_schedule: string
  infection_control_rotation:   string | null
  die_off_warning:              boolean
  generated_at:                 string
}

// ─── Rules Engine ─────────────────────────────────────────────────────────────
// products: fetched from Supabase aic_products table by the API route
// reportData: the report_data jsonb from the reports table

export function runAICSupplementRules(
  reportData: Record<string, unknown>,
  products:   AICProduct[]
): AICRulesOutput {

  // Build a lookup map from product_key -> product row
  const productMap = new Map<string, AICProduct>(
    products.map(p => [p.product_key, p])
  )

  // Helper: get a product or skip if not in DB / inactive
  const getProduct = (key: string): AICProduct | null =>
    productMap.get(key) ?? null

  const phase1:       AICRecommendation[] = []
  const phase2Infect: AICRecommendation[] = []
  const phase2Probio: AICRecommendation[] = []
  const phase2Nutrit: AICRecommendation[] = []
  const phase3:       AICRecommendation[] = []
  const warnings:     string[]            = []

  let needsInfectionControl = false
  let hasParasitic          = false
  let needsDieOff           = false

  // ── Score helpers ──────────────────────────────────────────────────────────

  const score = (key: string): number => {
    const val = reportData[key]
    return typeof val === 'number' ? val : parseFloat(String(val ?? '0')) || 0
  }

  const probiotics     = (reportData.probiotics as Record<string, string>) ?? {}
  const isAbsent       = (sp: string) => probiotics[sp] === 'absent'

  const pathogenMap    = (reportData.pathogens as Record<string, number>) ?? {}
  const pathogenElev   = (sp: string, threshold = 0.02) =>
    (pathogenMap[sp] ?? 0) >= threshold

  const healthRisk     = (reportData.health_indicators as Record<string, string>) ?? {}
  const isModHigh      = (ind: string) =>
    ['moderate', 'high'].includes((healthRisk[ind] ?? '').toLowerCase())

  const diseaseRisk    = (reportData.disease_risk as Record<string, number>) ?? {}
  const diseaseOver    = (cond: string, pct = 15) =>
    (diseaseRisk[cond] ?? 0) >= pct

  // Helper to push a recommendation — skips if product not in DB
  const push = (
    bucket: AICRecommendation[],
    key: string,
    priority: AICRecommendation['priority'],
    triggered_by: AICFinding[],
    rationale_prompt: string
  ) => {
    const product = getProduct(key)
    if (!product || !product.active) return
    bucket.push({
      product,
      product_key: key,
      phase:       product.phase as 1 | 2 | 3,
      priority,
      triggered_by,
      rationale_prompt,
    })
  }

  // ── Rych Index ─────────────────────────────────────────────────────────────

  const rychIndex = score('rych_index')

  // ── PHASE 1: Gut Lining ────────────────────────────────────────────────────

  const leakyGut      = isModHigh('leaky_gut')
  const gutInflam     = isModHigh('gut_inflammation')
  const constipRisk   = diseaseRisk['constipation'] ?? 0
  const motilityLow   = score('intestinal_motility') < 60
  const bacillusAbsent = [
    'bacillus_clausii','bacillus_coagulans','bacillus_subtilis','bacillus_indicus'
  ].some(s => isAbsent(s))
  const sBoulAbsent   = isAbsent('saccharomyces_boulardii')
  const tmao          = isModHigh('tmao_production')

  if (leakyGut || gutInflam) {
    const tf: AICFinding[] = []
    if (leakyGut)  tf.push({ biomarker: 'Leaky Gut Potential',        observed_value: healthRisk['leaky_gut'] ?? 'Moderate',    reference_range: 'Target: Low Risk', severity: 'high',     clinical_note: 'Compromised gut barrier — seal before starting infection control' })
    if (gutInflam) tf.push({ biomarker: 'Potential Gut Inflammation',  observed_value: healthRisk['gut_inflammation'] ?? 'Moderate', reference_range: 'Target: Low Risk', severity: 'high', clinical_note: 'Active gut inflammation — gut lining repair is priority' })
    push(phase1, 'COLOSTRUM_GUT_REVIVE', 'critical', tf,
      `Patient has ${tf.map(f => f.biomarker).join(' and ')}. Explain why Colostrum Gut Revive (IgG immunoglobulins, L-Glutamine, Zinc Carnosine, Slippery Elm) is the first-line intervention to repair the gut lining before infection control. 2-3 clinical sentences.`)
  }

  if (bacillusAbsent || sBoulAbsent || constipRisk > 20 || motilityLow) {
    const tf: AICFinding[] = []
    if (bacillusAbsent) tf.push({ biomarker: 'Bacillus Species (Multiple)', observed_value: 'ABSENT (0.000)', reference_range: 'Should be present', severity: 'high', clinical_note: 'One or more Bacillus strains absent' })
    if (sBoulAbsent)    tf.push({ biomarker: 'Saccharomyces boulardii',     observed_value: 'ABSENT (0.000)', reference_range: 'Should be present', severity: 'high', clinical_note: 'S. boulardii absent — critical for inflammation and neurotransmitter support' })
    if (constipRisk > 20) tf.push({ biomarker: 'Constipation Risk', observed_value: `${constipRisk.toFixed(1)}%`, reference_range: 'Target: <15%', severity: constipRisk > 35 ? 'high' : 'moderate', clinical_note: `${constipRisk.toFixed(1)}% constipation predisposition` })
    if (motilityLow)    tf.push({ biomarker: 'Intestinal Motility Potential', observed_value: score('intestinal_motility').toFixed(1), reference_range: 'Ideal: >62', severity: 'moderate', clinical_note: 'Low intestinal motility' })
    push(phase1, 'IBS_CARE', bacillusAbsent || sBoulAbsent ? 'critical' : 'high', tf,
      `Patient shows: ${tf.map(f => `${f.biomarker} (${f.observed_value})`).join(', ')}. Explain why IBS Care (Bacillus strains + S. boulardii 10B CFU) addresses gut dysbiosis, restores motility, and reduces inflammation. 2-3 clinical sentences.`)
  }

  if (tmao) {
    push(phase1, 'TOXIN_CLEANSE', 'moderate',
      [{ biomarker: 'TMAO Production Potential', observed_value: healthRisk['tmao_production'] ?? 'Moderate', reference_range: 'Target: Low Risk', severity: 'moderate', clinical_note: 'Elevated TMAO indicates toxic metabolite burden' }],
      `Patient has ${healthRisk['tmao_production']} TMAO production risk. Explain in 2 sentences why a binder (activated charcoal + diatomaceous earth) is used to capture toxic metabolites. Note it must be taken 2+ hours away from all other supplements.`)
    needsDieOff = true
  }

  // ── PHASE 2: Infection Control ─────────────────────────────────────────────

  const bacterialPaths = ['helicobacter_pylori','klebsiella_pneumoniae','shigella_dysenteriae','fusobacterium_nucleatum','clostridioides_difficile']
  const hasBacterial   = bacterialPaths.some(p => pathogenElev(p))
  const prevDominant   = (pathogenMap['prevotella_copri'] ?? 0) >= 0.25
  const blasto         = pathogenElev('blastocystis_hominis', 0.01)

  if (hasBacterial || prevDominant || blasto) {
    needsInfectionControl = true
    needsDieOff           = true
    const tf: AICFinding[] = []
    bacterialPaths.forEach(p => {
      if (pathogenElev(p)) tf.push({ biomarker: p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), observed_value: `${((pathogenMap[p]??0)*100).toFixed(3)}%`, reference_range: 'Should be in Safe Zone', severity: 'high', clinical_note: 'Pathogen in Warning/Danger Zone' })
    })
    if (prevDominant) tf.push({ biomarker: 'Prevotella copri', observed_value: `${((pathogenMap['prevotella_copri']??0)*100).toFixed(1)}% dominance`, reference_range: 'Healthy: <25%', severity: 'high', clinical_note: 'Prevotella overgrowth linked to gut inflammation and autoimmune risk' })
    push(phase2Infect, 'GUT_CLEANSE_CARE', 'high', tf,
      `Patient has elevated pathogens: ${tf.map(f=>f.biomarker).join(', ')}. Explain how berberine (Gut Cleanse Care) works as a broad-spectrum antimicrobial, and why it should be rotated monthly (Month 2: Black Cumin Seed Oil, Month 3: Oregano Oil) to prevent resistance. 2-3 sentences.`)
  }

  const antibioticRecovLow = score('antibiotic_recovery') < 60
  const hasResistance      = Array.isArray(reportData.antibiotic_resistance) &&
    (reportData.antibiotic_resistance as string[]).some(r => r.toLowerCase().includes('resistant'))

  if (antibioticRecovLow || hasResistance) {
    push(phase2Infect, 'BIOFILM_CARE', hasResistance ? 'critical' : 'high',
      [{ biomarker: hasResistance ? 'Antibiotic Resistance' : 'Antibiotic Recovery Potential', observed_value: hasResistance ? 'Resistant genes detected' : score('antibiotic_recovery').toFixed(1), reference_range: 'Target: >65', severity: hasResistance ? 'critical' : 'high', clinical_note: hasResistance ? 'Resistance genes detected — biofilm-sheltered pathogens likely' : 'Low antibiotic recovery — pathogen biofilm protection likely' }],
      `Patient has ${hasResistance ? 'antibiotic resistance genes' : `low antibiotic recovery (${score('antibiotic_recovery').toFixed(1)})`}. Explain why Biofilm Care (Bacillus + protease/lipase/bromelain) breaks down the polysaccharide biofilm matrix protecting pathogens from antimicrobials. 2 sentences.`)
  }

  const parasiticPaths = ['cryptosporidium','giardia_intestinalis','entamoeba_histolytica']
  hasParasitic         = parasiticPaths.some(p => pathogenElev(p, 0.005))
  const candidas       = ['candida_albicans','candida_tropicalis','candida_glabrata','candida_krusei']
  const hasFungal      = candidas.some(p => pathogenElev(p, 0.01))

  if (hasParasitic) {
    needsDieOff = true
    needsInfectionControl = true
    const tf = parasiticPaths.filter(p => pathogenElev(p,0.005)).map(p => ({
      biomarker: p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
      observed_value: `${((pathogenMap[p]??0)*100).toFixed(3)}%`,
      reference_range: 'Should be absent or in Safe Zone',
      severity: 'high' as const,
      clinical_note: 'Parasitic pathogen detected',
    }))
    push(phase2Infect, 'LYME_CO_CARE', 'high', tf,
      `Patient has parasitic pathogens: ${tf.map(f=>f.biomarker).join(', ')}. Explain why Lyme Co Care (multi-herb parasitic formula) should be used Month 1, followed by Candida Care (Month 2) and Gut Cleanse Care (Month 3) in the infection control rotation. 2-3 sentences.`)
  }

  // ── PHASE 2: Probiotics ────────────────────────────────────────────────────

  if (sBoulAbsent) {
    push(phase2Probio, 'S_BOULARDII_CARE', 'high',
      [{ biomarker: 'Saccharomyces boulardii', observed_value: 'ABSENT (0.000)', reference_range: 'Should be present', severity: 'high', clinical_note: 'S. boulardii absent — critical for inflammation, neurotransmitters, IBS management' }],
      `Saccharomyces boulardii is completely absent in this patient. Explain its clinical importance for gut inflammation reduction, neurotransmitter support (serotonin/GABA), and digestive symptom management. Mention alternation nightly with Optibiotic. 2 sentences.`)
  }

  const butyrLow   = score('butyrate')    < 55
  const propLow    = score('propionate')  < 45
  const acetLow    = score('acetate')     < 65
  const lactoAbsent = ['lactobacillus_acidophilus','lactobacillus_plantarum','lactobacillus_rhamnosus','lactobacillus_bulgaricus'].some(s => isAbsent(s))
  const bifidoAbsent = isAbsent('bifidobacterium_animalis') || isAbsent('bifidobacterium_lactis')

  if (butyrLow || propLow || acetLow || lactoAbsent || bifidoAbsent) {
    const tf: AICFinding[] = []
    if (butyrLow)    tf.push({ biomarker: 'Butyrate Production Potential',   observed_value: score('butyrate').toFixed(1),   reference_range: 'Ideal: >59.9', severity: 'high',     clinical_note: 'Low butyrate — primary fuel for colonocytes' })
    if (propLow)     tf.push({ biomarker: 'Propionate Production Potential', observed_value: score('propionate').toFixed(1), reference_range: 'Ideal: >53.9', severity: 'moderate', clinical_note: 'Low propionate — hepatic glucose metabolism' })
    if (acetLow)     tf.push({ biomarker: 'Acetate Production Potential',    observed_value: score('acetate').toFixed(1),    reference_range: 'Ideal: >71.7', severity: 'moderate', clinical_note: 'Low acetate — peripheral glucose metabolism' })
    if (lactoAbsent) tf.push({ biomarker: 'Lactobacillus Species (Multiple)',observed_value: 'ABSENT (0.000)', reference_range: 'Should be present', severity: 'high', clinical_note: 'Multiple Lactobacillus strains absent' })
    if (bifidoAbsent)tf.push({ biomarker: 'Bifidobacterium animalis / B. lactis', observed_value: 'ABSENT (0.000)', reference_range: 'Should be present', severity: 'high', clinical_note: 'Key Bifidobacterium strains absent' })
    push(phase2Probio, 'OPTIBIOTIC', butyrLow && score('butyrate') < 45 ? 'critical' : 'high', tf,
      `Patient shows: ${tf.map(f=>`${f.biomarker} (${f.observed_value})`).join(', ')}. Explain why Optibiotic (spore-based with tributyrin) is the primary SCFA intervention — how tributyrin feeds butyrate-producing bacteria, why spore format is necessary for stomach acid survival, and alternation nightly with S. Boulardii Care. 2-3 sentences.`)
  }

  const widespreadLacto = ['lactobacillus_acidophilus','lactobacillus_plantarum','lactobacillus_gasseri','lactobacillus_reuteri','lactobacillus_helveticus'].filter(s => isAbsent(s)).length >= 3

  if (hasFungal || widespreadLacto) {
    const tf: AICFinding[] = []
    if (hasFungal)       tf.push({ biomarker: 'Candida Species', observed_value: 'Elevated (Warning/Danger Zone)', reference_range: 'Should be in Safe Zone', severity: 'high', clinical_note: 'Candida overgrowth detected' })
    if (widespreadLacto) tf.push({ biomarker: 'Multiple Lactobacillus Strains', observed_value: '3+ strains ABSENT', reference_range: 'All should be present', severity: 'high', clinical_note: 'Widespread Lactobacillus depletion' })
    push(phase2Probio, 'CANDIDA_CARE', hasFungal ? 'critical' : 'high', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(' and ')}. Explain why Candida Care (3-strain broad-spectrum probiotic) addresses both Candida overgrowth and widespread probiotic deficiency simultaneously, and that it should alternate nightly with Optibiotic. 2 sentences.`)
  }

  // ── PHASE 2: Nutrition ─────────────────────────────────────────────────────

  const bVits = [
    { key: 'vitamin_b1', label: 'B1', ideal: 42 },
    { key: 'vitamin_b2', label: 'B2', ideal: 40 },
    { key: 'vitamin_b3', label: 'B3', ideal: 43 },
    { key: 'vitamin_b5', label: 'B5', ideal: 47 },
    { key: 'vitamin_b6', label: 'B6', ideal: 43 },
    { key: 'vitamin_b7', label: 'B7', ideal: 47 },
    { key: 'vitamin_b12',label: 'B12',ideal: 47 },
    { key: 'vitamin_c',  label: 'C',  ideal: 28 },
  ].filter(v => score(v.key) < v.ideal)

  if (bVits.length >= 3) {
    push(phase2Nutrit, 'TOTAL_ACTIVE_B', bVits.length >= 5 ? 'high' : 'moderate',
      bVits.map(v => ({ biomarker: `Vitamin ${v.label} Production Potential`, observed_value: score(v.key).toFixed(1), reference_range: `Ideal: >${v.ideal}`, severity: 'moderate' as const, clinical_note: `Gut microbiome not producing adequate Vitamin ${v.label}` })),
      `Patient's gut shows low production for: ${bVits.map(v=>`Vitamin ${v.label}`).join(', ')}. Explain why exogenous B vitamin supplementation is needed while the microbiome rebuilds, and how the amino acid blend supports neurotransmitter precursor availability. 2 sentences.`)
  }

  const gabaLow = score('gaba') < 50
  const trpLow  = score('tryptophan') < 38
  const achLow  = score('acetylcholine') < 25
  const trpamineLow = score('tryptamine') < 18

  if (gabaLow || trpLow || achLow) {
    const tf: AICFinding[] = []
    if (gabaLow)     tf.push({ biomarker: 'GABA Production Potential',         observed_value: score('gaba').toFixed(1),         reference_range: 'Ideal: >52.7', severity: 'high',     clinical_note: 'Low GABA — anxiety, poor sleep' })
    if (trpLow)      tf.push({ biomarker: 'Tryptophan Production Potential',    observed_value: score('tryptophan').toFixed(1),    reference_range: 'Ideal: >40.7', severity: 'high',     clinical_note: 'Low Tryptophan — serotonin precursor deficiency' })
    if (achLow)      tf.push({ biomarker: 'Acetylcholine Production Potential', observed_value: score('acetylcholine').toFixed(1), reference_range: 'Ideal: >26.2', severity: 'moderate', clinical_note: 'Low Acetylcholine — cognition affected' })
    if (trpamineLow) tf.push({ biomarker: 'Tryptamine Production Potential',    observed_value: score('tryptamine').toFixed(1),    reference_range: 'Ideal: >20.1', severity: 'moderate', clinical_note: 'Low Tryptamine — gut-brain signalling disrupted' })
    push(phase2Nutrit, 'BRAIN_HEART_CARE', gabaLow && trpLow ? 'high' : 'moderate', tf,
      `Patient shows low: ${tf.map(f=>f.biomarker).join(', ')}. Explain how Omega-3 (Brain + Heart Care) supports the gut-brain axis, reduces neuroinflammation, and aids GABA/serotonin pathway neurotransmitter synthesis. 2-3 sentences.`)
  }

  const mineralLow   = score('mineral_bioavailability') < 35
  const enduranceLow = score('physical_endurance') < 40 || score('aerobic_endurance') < 50

  if (mineralLow || enduranceLow) {
    push(phase2Nutrit, 'ZMAG', mineralLow ? 'high' : 'moderate',
      [
        ...(mineralLow   ? [{ biomarker: 'Mineral Bioavailability Potential',    observed_value: score('mineral_bioavailability').toFixed(1),                                  reference_range: 'Ideal: >35.9', severity: 'high' as const,     clinical_note: 'Gut cannot absorb minerals properly' }] : []),
        ...(enduranceLow ? [{ biomarker: 'Physical / Aerobic Endurance Potential', observed_value: `${score('physical_endurance').toFixed(1)} / ${score('aerobic_endurance').toFixed(1)}`, reference_range: 'Physical >46, Aerobic >59', severity: 'moderate' as const, clinical_note: 'Low endurance correlates with zinc-magnesium depletion' }] : []),
      ],
      `Patient has ${[mineralLow ? `low Mineral Bioavailability (${score('mineral_bioavailability').toFixed(1)})` : '', enduranceLow ? 'low endurance potential' : ''].filter(Boolean).join(' and ')}. Explain why ZMAG (zinc-magnesium capsules) is needed and how compromised gut lining causes mineral malabsorption regardless of diet. 2 sentences.`)
  }

  if (constipRisk > 15 || motilityLow || gabaLow || trpLow) {
    push(phase2Nutrit, 'OPTIMAL_MAGNESIUM', constipRisk > 35 ? 'high' : 'moderate',
      [
        ...(constipRisk > 15 ? [{ biomarker: 'Constipation Risk',           observed_value: `${constipRisk.toFixed(1)}%`,             reference_range: 'Target: <15%', severity: (constipRisk>35?'high':'moderate') as 'high'|'moderate', clinical_note: 'Constipation predisposition — magnesium supports bowel regularity' }] : []),
        ...(motilityLow      ? [{ biomarker: 'Intestinal Motility Potential',observed_value: score('intestinal_motility').toFixed(1),  reference_range: 'Ideal: >62',   severity: 'moderate' as const, clinical_note: 'Low motility — magnesium relaxes intestinal smooth muscle' }] : []),
        ...((gabaLow||trpLow)? [{ biomarker: 'GABA / Tryptophan (Sleep)',   observed_value: 'LOW',                                    reference_range: 'Both should be ideal', severity: 'moderate' as const, clinical_note: 'Magnesium glycinate supports sleep via GABA receptor activation' }] : []),
      ],
      `Patient has ${[constipRisk>15?`constipation risk (${constipRisk.toFixed(1)}%)`:'', motilityLow?'low motility':'', (gabaLow||trpLow)?'low GABA/Tryptophan':''].filter(Boolean).join(', ')}. Explain why Optimal Magnesium Care (magnesium citrate/potassium blend, bedtime powder) addresses bowel regularity through smooth muscle relaxation and sleep quality through GABA receptor activation. 2 sentences.`)
  }

  const histSensLow = score('histamine_sensitivity') < 55
  const histHigh    = (reportData.neurotransmitters as Record<string,string>)?.histamine === 'atypical_high'

  if (histSensLow || histHigh) {
    push(phase2Nutrit, 'OPT_HISTAMINE', 'moderate',
      [{ biomarker: histHigh ? 'Histamine Production (Atypically High)' : 'Histamine Sensitivity Management', observed_value: histHigh ? 'Atypical High' : score('histamine_sensitivity').toFixed(1), reference_range: histHigh ? 'Should be Optimal' : 'Ideal: >45.6', severity: 'moderate', clinical_note: histHigh ? 'Gut overproducing histamine' : 'Low histamine sensitivity — dietary reactions likely' }],
      `Patient has ${histHigh?'atypically high histamine production':'low histamine sensitivity management'}. Explain how Opt Histamine (quercetin, NAC, stinging nettle, milk thistle) reduces histamine burden and supports DAO enzyme activity for dietary histamine breakdown. 2 sentences.`)
  }

  // ── PHASE 3: Enzymes ───────────────────────────────────────────────────────

  const carbLow   = score('carbohydrate_metabolism') < 28
  const fatLow    = score('fat_metabolism')           < 39
  const protLow   = score('protein_metabolism')       < 45

  if (carbLow || fatLow || protLow) {
    const tf: AICFinding[] = [
      ...(carbLow ? [{ biomarker: 'Carbohydrate Metabolism Potential', observed_value: score('carbohydrate_metabolism').toFixed(1), reference_range: 'Ideal: >29.7', severity: 'moderate' as const, clinical_note: 'Low carbohydrate metabolic capacity' }] : []),
      ...(fatLow  ? [{ biomarker: 'Fat Metabolism Potential',          observed_value: score('fat_metabolism').toFixed(1),          reference_range: 'Ideal: >40.9', severity: 'moderate' as const, clinical_note: 'Low fat metabolism — bile acid and lipase activity insufficient' }] : []),
      ...(protLow ? [{ biomarker: 'Protein Metabolism Potential',      observed_value: score('protein_metabolism').toFixed(1),      reference_range: 'Ideal: >46.2', severity: 'moderate' as const, clinical_note: 'Low protein metabolism — proteolytic enzyme support needed' }] : []),
    ]
    push(phase3, 'DIGEST_ALL_CARE', 'supportive', tf,
      `Patient's gut shows low potential for: ${tf.map(f=>f.biomarker).join(', ')}. Explain why Digest All Care (protease, amylase, lipase + ox bile/betaine HCl) is introduced in Phase 3 only, after gut lining is healed, to bridge macronutrient processing while the microbiome rebuilds. Note the veg/non-veg variant. 2 sentences.`)
  }

  // ── Warnings ───────────────────────────────────────────────────────────────

  if (needsDieOff)           warnings.push('⚠️ Die-off Warning: Before starting infection control (Week 3), advise die-off remedies — rotate: boiled ginger water, fennel seed water, Eno on empty stomach, activated charcoal. If severe flare-up: reduce to half dose for 2–3 days then resume.')
  if (needsInfectionControl) warnings.push('⚠️ Never run two antimicrobials simultaneously. Each antimicrobial = 1 month only, then rotate. Never use same antimicrobial >1 month continuously.')
  if (leakyGut || gutInflam) warnings.push('⚠️ Gut lining first: Do NOT start infection control until Phase 1 (Colostrum Gut Revive) has been completed for at least 2 weeks.')
  warnings.push('ℹ️ Colostrum Gut Revive contains bovine colostrum. Standard Digest All Care contains Ox Bile. Always confirm patient dietary preference and use veg variants if needed.')

  // ── Schedules ──────────────────────────────────────────────────────────────

  const hasBoth = phase2Probio.some(r=>r.product_key==='S_BOULARDII_CARE') &&
                  phase2Probio.some(r=>r.product_key==='OPTIBIOTIC')

  const probioticSchedule = hasBoth
    ? 'Night 1: S. Boulardii Care (1 cap) → Night 2: Optibiotic (1 cap) → Repeat alternating. Never give same probiotic two nights in a row.'
    : phase2Probio.length > 0
    ? `${phase2Probio[0]?.product.name ?? 'Probiotic'}: 1 cap nightly`
    : 'No alternation needed based on current findings.'

  const infectionRotation = needsInfectionControl
    ? 'Month 1: Gut Cleanse Care (1 cap after lunch + dinner) | Month 2: Black Cumin Seed Oil (1 cap/day) | Month 3: Oregano Oil (1 cap/day)'
    : hasParasitic
    ? 'Month 1: Lyme Co Care (1–2ml before dinner) | Month 2: Candida Care (1 cap bedtime) | Month 3: Gut Cleanse Care (1 cap after lunch + dinner)'
    : null

  return {
    version:                      AIC_RULES_VERSION,
    patient_name:                 String(reportData.patient_name ?? 'Patient'),
    rych_index:                   rychIndex,
    phase1,
    phase2_infection_control:     phase2Infect,
    phase2_probiotics:            phase2Probio,
    phase2_nutrition:             phase2Nutrit,
    phase3,
    clinical_warnings:            warnings,
    probiotic_alternation_schedule: probioticSchedule,
    infection_control_rotation:   infectionRotation,
    die_off_warning:              needsDieOff,
    generated_at:                 new Date().toISOString(),
  }
}