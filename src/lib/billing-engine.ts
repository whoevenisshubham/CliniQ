/**
 * NexusMD Live Billing Engine
 * Parses consultation transcript in real-time to add billing line items.
 * Covers: time-based fees, procedures detected in transcript,
 * investigations mentioned, and equipment used.
 */

import type { BillingItem } from "./types";

// ─── Base fees ────────────────────────────────────────────────────────────────

export const CONSULTATION_BASE_FEE = 300;  // ₹ flat charge
export const TIME_RATE_PER_MIN = 12;        // ₹ per minute of consultation

// ─── Procedure keyword → billing ─────────────────────────────────────────────

interface ProcedureRule {
  keywords: string[];      // keywords to detect in transcript (lowercase)
  description: string;
  price: number;
  category: BillingItem["category"];
}

const PROCEDURE_RULES: ProcedureRule[] = [
  // Physical examination procedures
  { keywords: ["auscultation", "auscultated", "breath sounds", "heart sounds"], description: "Clinical Auscultation", price: 150, category: "procedure" },
  { keywords: ["palpation", "palpated", "abdomen soft", "guarding", "rigidity"], description: "Abdominal Palpation", price: 100, category: "procedure" },
  { keywords: ["percussion", "percussed"], description: "Chest Percussion", price: 100, category: "procedure" },
  { keywords: ["fundoscopy", "fundal examination"], description: "Fundoscopy", price: 250, category: "procedure" },
  { keywords: ["per rectal", "pr examination", "digital rectal"], description: "PR Examination", price: 200, category: "procedure" },
  { keywords: ["pelvic examination", "per vaginum", "p/v examination"], description: "Pelvic Examination", price: 300, category: "procedure" },
  { keywords: ["wound dressing", "dressing done"], description: "Wound Dressing", price: 200, category: "procedure" },
  { keywords: ["sutures", "suturing", "wound suture"], description: "Wound Suturing", price: 500, category: "procedure" },
  { keywords: ["injection given", "im injection", "iv injection", "iv push"], description: "Injection Administration", price: 100, category: "procedure" },
  { keywords: ["iv cannula", "iv access", "iv drip"], description: "IV Access + Fluid", price: 250, category: "procedure" },
  { keywords: ["nebulisation", "nebulizer", "nebulized"], description: "Nebulisation (SABA/SAMA)", price: 350, category: "procedure" },
  { keywords: ["urinary catheter", "foley catheter", "catheterisation"], description: "Urinary Catheterisation", price: 400, category: "procedure" },
  { keywords: ["nasogastric", "ng tube", "ryle tube"], description: "NG Tube Insertion", price: 400, category: "procedure" },

  // Investigations
  { keywords: ["ecg", "electrocardiogram", "12-lead"], description: "12-Lead ECG", price: 250, category: "investigation" },
  { keywords: ["x-ray", "chest x-ray", "xray", "radiograph"], description: "Chest X-Ray", price: 500, category: "investigation" },
  { keywords: ["ultrasound", "usg", "sonography", "fast scan"], description: "USG / Sonography", price: 800, category: "investigation" },
  { keywords: ["ct scan", "computed tomography", "ctscan"], description: "CT Scan (reported)", price: 3500, category: "investigation" },
  { keywords: ["mri", "magnetic resonance"], description: "MRI (reported)", price: 6500, category: "investigation" },
  { keywords: ["blood sugar", "fbs", "rbs", "hba1c", "fasting glucose"], description: "Blood Glucose / HbA1c", price: 150, category: "investigation" },
  { keywords: ["complete blood count", "cbc", "full blood count", "haemogram"], description: "Complete Blood Count", price: 250, category: "investigation" },
  { keywords: ["liver function", "lft", "sgot", "sgpt"], description: "Liver Function Test", price: 400, category: "investigation" },
  { keywords: ["renal function", "rft", "creatinine", "urea", "bun"], description: "Renal Function Test", price: 350, category: "investigation" },
  { keywords: ["thyroid function", "tft", "tsh", "t3", "t4"], description: "Thyroid Function Test", price: 450, category: "investigation" },
  { keywords: ["urine routine", "urine analysis", "urinalysis"], description: "Urine Routine + Microscopy", price: 150, category: "investigation" },
  { keywords: ["dengue ns1", "dengue igm", "dengue test"], description: "Dengue Serology (NS1/IgM)", price: 600, category: "investigation" },
  { keywords: ["malaria smear", "malaria test", "peripheral smear"], description: "Malaria Thick Smear / ICT", price: 300, category: "investigation" },
  { keywords: ["culture sensitivity", "c/s", "blood culture"], description: "Culture & Sensitivity", price: 800, category: "investigation" },
  { keywords: ["covid test", "rapid antigen", "rt-pcr"], description: "COVID-19 Testing", price: 500, category: "investigation" },
  { keywords: ["d-dimer", "inr", "pt", "aptt", "coagulation"], description: "Coagulation Profile", price: 600, category: "investigation" },
  { keywords: ["troponin", "ck-mb", "cardiac enzymes"], description: "Cardiac Enzymes", price: 900, category: "investigation" },
  { keywords: ["arterial blood gas", "abg"], description: "Arterial Blood Gas", price: 700, category: "investigation" },

  // Equipment
  { keywords: ["oxygen", "o2", "oxygen therapy", "nasal prongs", "face mask"], description: "Oxygen Therapy", price: 200, category: "equipment" },
  { keywords: ["pulse oximeter", "spo2 monitoring"], description: "Pulse Oximetry Monitoring", price: 100, category: "equipment" },
  { keywords: ["cardiac monitor", "ecg monitoring", "holter"], description: "Cardiac Monitoring", price: 500, category: "equipment" },
  { keywords: ["defibrillation", "defibrillator", "shock given"], description: "Defibrillation", price: 1500, category: "equipment" },
  { keywords: ["glucometer", "glucose check", "cbg"], description: "Glucometry", price: 80, category: "equipment" },
  { keywords: ["spirometry"], description: "Spirometry", price: 400, category: "equipment" },
];

// ─── Billing engine ───────────────────────────────────────────────────────────

export interface BillingEngineInput {
  durationMs: number;
  transcript: string;
  existingItems: BillingItem[];
}

export interface BillingEngineResult {
  line_items: BillingItem[];
  subtotal: number;
  tax: number;            // 5% GST on medical services (simplified)
  total: number;
}

export function computeBilling(input: BillingEngineInput): BillingEngineResult {
  const { durationMs, transcript, existingItems } = input;
  const lower = transcript.toLowerCase();

  const items: BillingItem[] = [
    // 1. Base consultation
    {
      description: "Consultation Fee (Base)",
      category: "consultation",
      quantity: 1,
      unit_price: CONSULTATION_BASE_FEE,
      total: CONSULTATION_BASE_FEE,
    },
  ];

  // 2. Time-based charge
  const minutes = Math.max(1, Math.floor(durationMs / 60000));
  if (minutes > 0) {
    items.push({
      description: `Consultation Time (${minutes} min)`,
      category: "consultation",
      quantity: minutes,
      unit_price: TIME_RATE_PER_MIN,
      total: minutes * TIME_RATE_PER_MIN,
    });
  }

  // 3. Procedure/investigation/equipment detection from transcript
  const alreadyAdded = new Set(existingItems.map((i) => i.description));

  for (const rule of PROCEDURE_RULES) {
    if (alreadyAdded.has(rule.description)) continue;
    const matched = rule.keywords.some((kw) => lower.includes(kw));
    if (matched) {
      items.push({
        description: rule.description,
        category: rule.category,
        quantity: 1,
        unit_price: rule.price,
        total: rule.price,
      });
      alreadyAdded.add(rule.description);
    }
  }

  const subtotal = items.reduce((acc, i) => acc + i.total, 0);
  const tax = Math.round(subtotal * 0.05); // 5% GST
  const total = subtotal + tax;

  return { line_items: items, subtotal, tax, total };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export const CATEGORY_COLORS: Record<BillingItem["category"], string> = {
  consultation: "text-blue-400",
  procedure: "text-purple-400",
  investigation: "text-cyan-400",
  medication: "text-green-400",
  equipment: "text-amber-400",
};
