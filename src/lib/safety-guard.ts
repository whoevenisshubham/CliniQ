/**
 * NexusMD Safety Guard
 * Checks prescribed medications against patient allergies and known drug interactions.
 * Hardcoded interaction/allergy data — covers most common Indian clinical scenarios.
 */

import type { SafetyAlert, AlertSeverity } from "./types";

// ─── Drug interaction table ───────────────────────────────────────────────────

interface Interaction {
  drug_a: string;
  drug_b: string;
  severity: AlertSeverity;
  title: string;
  mechanism: string;
  alternatives?: string[];
}

const DRUG_INTERACTIONS: Interaction[] = [
  // ── Anticoagulants
  { drug_a: "warfarin", drug_b: "aspirin", severity: "critical", title: "Warfarin + Aspirin — Major Bleed Risk", mechanism: "Additive antiplatelet effect; increases GI and intracranial bleed risk significantly.", alternatives: ["Paracetamol for analgesia"] },
  { drug_a: "warfarin", drug_b: "ibuprofen", severity: "critical", title: "Warfarin + Ibuprofen — Bleeding", mechanism: "NSAIDs inhibit platelet aggregation and displace warfarin from protein binding.", alternatives: ["Paracetamol"] },
  { drug_a: "warfarin", drug_b: "diclofenac", severity: "high", title: "Warfarin + Diclofenac — Elevated INR", mechanism: "Diclofenac inhibits CYP2C9, reducing warfarin metabolism, raising INR.", alternatives: ["Paracetamol", "Physiotherapy"] },
  { drug_a: "warfarin", drug_b: "ciprofloxacin", severity: "high", title: "Warfarin + Ciprofloxacin — INR Increase", mechanism: "Quinolones inhibit CYP1A2; monitor INR closely or choose alternative antibiotic." },
  // ── Serotonin syndrome
  { drug_a: "sertraline", drug_b: "tramadol", severity: "critical", title: "SSRI + Tramadol — Serotonin Syndrome", mechanism: "Both increase serotonin; risk of hyperthermia, seizures, and death.", alternatives: ["Paracetamol", "non-opioid analgesia"] },
  { drug_a: "fluoxetine", drug_b: "tramadol", severity: "critical", title: "SSRI + Tramadol — Serotonin Syndrome", mechanism: "Fluoxetine's long half-life makes interaction particularly dangerous.", alternatives: ["Paracetamol"] },
  { drug_a: "escitalopram", drug_b: "tramadol", severity: "critical", title: "SSRI + Tramadol — Serotonin Syndrome", mechanism: "Avoid combination; risk of serotonin syndrome." },
  // ── QT prolongation
  { drug_a: "azithromycin", drug_b: "chloroquine", severity: "critical", title: "Azithromycin + Chloroquine — QT Prolongation", mechanism: "Additive QTc prolongation; risk of torsades de pointes.", alternatives: ["Doxycycline for atypicals", "Artemether-lumefantrine"] },
  { drug_a: "metronidazole", drug_b: "alcohol", severity: "high", title: "Metronidazole + Alcohol — Disulfiram Reaction", mechanism: "Inhibits acetaldehyde dehydrogenase; causes flushing, vomiting, tachycardia." },
  // ── Metformin
  { drug_a: "metformin", drug_b: "iv_contrast", severity: "critical", title: "Metformin + IV Contrast — Lactic Acidosis", mechanism: "Contrast-induced nephropathy reduces metformin clearance; risk of fatal lactic acidosis.", alternatives: ["Hold metformin 48h before/after contrast"] },
  // ── ACE inhibitors + potassium
  { drug_a: "enalapril", drug_b: "spironolactone", severity: "high", title: "ACEi + Spironolactone — Hyperkalaemia", mechanism: "Both raise serum potassium; risk of fatal arrhythmia, monitor K+ weekly.", alternatives: ["Furosemide if diuresis needed"] },
  { drug_a: "ramipril", drug_b: "spironolactone", severity: "high", title: "ACEi + Spironolactone — Hyperkalaemia", mechanism: "Dual blockade of RAAS increases hyperkalaemia risk substantially." },
  // ── Statins
  { drug_a: "atorvastatin", drug_b: "clarithromycin", severity: "high", title: "Statin + Clarithromycin — Myopathy Risk", mechanism: "Clarithromycin inhibits CYP3A4, increasing statin plasma levels → rhabdomyolysis.", alternatives: ["Azithromycin (safer alternative)", "Reduce statin dose temporarily"] },
  { drug_a: "simvastatin", drug_b: "amlodipine", severity: "medium", title: "Simvastatin + Amlodipine — Myopathy", mechanism: "Amlodipine inhibits CYP3A4; simvastatin dose must not exceed 20 mg/day.", alternatives: ["Switch to rosuvastatin (renal excretion)"] },
  // ── Diabetes
  { drug_a: "glibenclamide", drug_b: "ciprofloxacin", severity: "high", title: "Sulphonylurea + Ciprofloxacin — Hypoglycaemia", mechanism: "Fluoroquinolones potentiate insulin release; risk of severe hypoglycaemia.", alternatives: ["Amoxicillin-clavulanate if appropriate"] },
];

// ─── Allergy → contraindicated drug mapping ───────────────────────────────────

interface AllergyRule {
  allergy: string;         // patient allergy keyword
  contraindicated: string[]; // drug name keywords to flag
  severity: AlertSeverity;
  mechanism: string;
  alternatives?: string[];
}

const ALLERGY_RULES: AllergyRule[] = [
  {
    allergy: "penicillin",
    contraindicated: ["amoxicillin", "ampicillin", "cloxacillin", "flucloxacillin", "piperacillin", "co-amoxiclav", "augmentin"],
    severity: "critical",
    mechanism: "Cross-reactive IgE-mediated Type I hypersensitivity (~10% cross-reactivity with cephalosporins).",
    alternatives: ["Azithromycin", "Doxycycline", "Co-trimoxazole (if not sulfa-allergic)"],
  },
  {
    allergy: "penicillin",
    contraindicated: ["cephalexin", "cefixime", "cefuroxime", "ceftriaxone", "cefpodoxime"],
    severity: "high",
    mechanism: "Possible cross-reactivity with cephalosporins (~2%); use with caution.",
    alternatives: ["Azithromycin", "Doxycycline"],
  },
  {
    allergy: "sulfa",
    contraindicated: ["co-trimoxazole", "trimethoprim", "sulfamethoxazole", "dapsone", "furosemide", "hydrochlorothiazide"],
    severity: "high",
    mechanism: "Sulfonamide hypersensitivity; risk of Stevens-Johnson Syndrome.",
    alternatives: ["Nitrofurantoin (for UTI)", "Clindamycin"],
  },
  {
    allergy: "aspirin",
    contraindicated: ["aspirin", "ibuprofen", "naproxen", "diclofenac", "nimesulide", "mefenamic acid", "ketorolac", "piroxicam"],
    severity: "critical",
    mechanism: "Aspirin-exacerbated respiratory disease (AERD); risk of bronchospasm, angioedema, urticaria.",
    alternatives: ["Paracetamol (safe in aspirin allergy)"],
  },
  {
    allergy: "nsaid",
    contraindicated: ["ibuprofen", "naproxen", "diclofenac", "nimesulide", "mefenamic acid", "ketorolac"],
    severity: "high",
    mechanism: "Cross-reactivity among NSAIDs via COX-1 inhibition pathway.",
    alternatives: ["Paracetamol for pain/fever"],
  },
  {
    allergy: "codeine",
    contraindicated: ["codeine", "tramadol", "pethidine"],
    severity: "high",
    mechanism: "Opioid hypersensitivity; risk of anaphylaxis.",
    alternatives: ["Paracetamol", "NSAIDs if tolerated"],
  },
  {
    allergy: "metronidazole",
    contraindicated: ["metronidazole", "tinidazole", "ornidazole", "secnidazole"],
    severity: "high",
    mechanism: "Nitroimidazole class hypersensitivity.",
    alternatives: ["Clindamycin", "Vancomycin (for C. diff)"],
  },
];

// ─── Core safety check function ───────────────────────────────────────────────

export interface SafetyCheckInput {
  prescribedMeds: string[];   // medication names from EMR extraction
  patientAllergies: string[]; // from patient profile
  consultationId: string;
}

export function checkSafetyConsistencies(input: SafetyCheckInput): SafetyAlert[] {
  const { prescribedMeds, patientAllergies, consultationId } = input;
  const alerts: SafetyAlert[] = [];
  const now = new Date().toISOString();

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normMeds = prescribedMeds.map(normalize);

  // 1. Check allergy contraindications
  for (const rule of ALLERGY_RULES) {
    const hasAllergy = patientAllergies.some((a) =>
      normalize(a).includes(normalize(rule.allergy)) ||
      normalize(rule.allergy).includes(normalize(a))
    );
    if (!hasAllergy) continue;

    for (const contraindicated of rule.contraindicated) {
      const matchedMed = prescribedMeds.find((med) =>
        normalize(med).includes(normalize(contraindicated)) ||
        normalize(contraindicated).includes(normalize(med))
      );
      if (!matchedMed) continue;

      alerts.push({
        id: `allergy-${rule.allergy}-${contraindicated}-${Date.now()}`,
        consultation_id: consultationId,
        alert_type: "allergy",
        severity: rule.severity,
        title: `⚠ Allergy Alert: ${matchedMed} contraindicated`,
        description: `Patient is allergic to ${rule.allergy}. ${rule.mechanism}`,
        drug_a: matchedMed,
        drug_b: `${rule.allergy} (ALLERGY)`,
        mechanism: rule.mechanism,
        alternatives: rule.alternatives,
        acknowledged: false,
        created_at: now,
      });
    }
  }

  // 2. Check drug-drug interactions
  for (const interaction of DRUG_INTERACTIONS) {
    const hasA = normMeds.some(
      (m) => m.includes(normalize(interaction.drug_a)) || normalize(interaction.drug_a).includes(m)
    );
    const hasB = normMeds.some(
      (m) => m.includes(normalize(interaction.drug_b)) || normalize(interaction.drug_b).includes(m)
    );
    if (!hasA || !hasB) continue;

    alerts.push({
      id: `ddi-${interaction.drug_a}-${interaction.drug_b}-${Date.now()}`,
      consultation_id: consultationId,
      alert_type: "drug_interaction",
      severity: interaction.severity,
      title: interaction.title,
      description: interaction.mechanism,
      drug_a: interaction.drug_a,
      drug_b: interaction.drug_b,
      mechanism: interaction.mechanism,
      alternatives: interaction.alternatives,
      acknowledged: false,
      created_at: now,
    });
  }

  // Deduplicate (same drug pair)
  const seen = new Set<string>();
  return alerts.filter((a) => {
    const key = `${a.drug_a}-${a.drug_b}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Demo patient allergy profile (used when no real patient data)
export const DEMO_PATIENT_ALLERGIES = ["penicillin", "aspirin"];
