/**
 * NexusMD Jan Aushadhi Price Engine
 * Looks up brand → generic → Jan Aushadhi pricing.
 * Jan Aushadhi (Pradhan Mantri Bhartiya Janaushadhi Pariyojana) stores offer
 * generic medicines at 50–90% off brand price.
 */

export interface DrugEntry {
  molecule: string;            // generic molecule name
  brand_examples: string[];    // common brand names (lowercase for matching)
  brand_price_per_unit: number;  // ₹ per tablet/vial
  generic_price_per_unit: number;
  jan_aushadhi_price_per_unit: number;
  unit: string;                // "tablet" | "vial" | "syrup 100ml" etc.
  category: string;
  prescription_required: boolean;
}

// ─── Drug database (60+ molecules across all major Indian clinical categories) ─

export const DRUG_DATABASE: DrugEntry[] = [
  // ── Analgesics / NSAIDs
  { molecule: "paracetamol 500mg", brand_examples: ["crocin", "dolo", "calpol", "paracip", "fepanil"], brand_price_per_unit: 2.5, generic_price_per_unit: 0.8, jan_aushadhi_price_per_unit: 0.5, unit: "tablet", category: "Analgesic", prescription_required: false },
  { molecule: "ibuprofen 400mg", brand_examples: ["brufen", "combiflam", "ibugesic", "nurofen"], brand_price_per_unit: 5.5, generic_price_per_unit: 1.2, jan_aushadhi_price_per_unit: 0.75, unit: "tablet", category: "NSAID", prescription_required: false },
  { molecule: "diclofenac 50mg", brand_examples: ["voveran", "diclomol", "reactin", "reactine"], brand_price_per_unit: 6.0, generic_price_per_unit: 1.5, jan_aushadhi_price_per_unit: 0.90, unit: "tablet", category: "NSAID", prescription_required: true },
  { molecule: "aceclofenac 100mg", brand_examples: ["aceclo", "hifenac", "zerodol"], brand_price_per_unit: 8.5, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.20, unit: "tablet", category: "NSAID", prescription_required: true },
  { molecule: "tramadol 50mg", brand_examples: ["ultracet", "tramazac", "domadol"], brand_price_per_unit: 12.0, generic_price_per_unit: 3.5, jan_aushadhi_price_per_unit: 2.10, unit: "tablet", category: "Opioid Analgesic", prescription_required: true },

  // ── Antibiotics
  { molecule: "amoxicillin 500mg", brand_examples: ["amoxil", "novamox", "wymox", "amoxyclav"], brand_price_per_unit: 14.0, generic_price_per_unit: 3.5, jan_aushadhi_price_per_unit: 2.20, unit: "capsule", category: "Antibiotic - Penicillin", prescription_required: true },
  { molecule: "amoxicillin-clavulanate 625mg", brand_examples: ["augmentin", "clavam", "moxclav", "co-amoxiclav"], brand_price_per_unit: 35.0, generic_price_per_unit: 10.5, jan_aushadhi_price_per_unit: 6.50, unit: "tablet", category: "Antibiotic - Penicillin", prescription_required: true },
  { molecule: "azithromycin 500mg", brand_examples: ["azee", "zithromax", "aziwok", "azicip"], brand_price_per_unit: 28.0, generic_price_per_unit: 7.0, jan_aushadhi_price_per_unit: 4.50, unit: "tablet", category: "Antibiotic - Macrolide", prescription_required: true },
  { molecule: "ciprofloxacin 500mg", brand_examples: ["ciplox", "cipro", "cifran", "quintor"], brand_price_per_unit: 18.0, generic_price_per_unit: 4.0, jan_aushadhi_price_per_unit: 2.50, unit: "tablet", category: "Antibiotic - Fluoroquinolone", prescription_required: true },
  { molecule: "doxycycline 100mg", brand_examples: ["doxt", "doxy1", "biodoxi", "tetradox"], brand_price_per_unit: 12.0, generic_price_per_unit: 2.5, jan_aushadhi_price_per_unit: 1.50, unit: "capsule", category: "Antibiotic - Tetracycline", prescription_required: true },
  { molecule: "metronidazole 400mg", brand_examples: ["flagyl", "metrogyl", "metroneed", "aldezole"], brand_price_per_unit: 4.5, generic_price_per_unit: 1.0, jan_aushadhi_price_per_unit: 0.65, unit: "tablet", category: "Antibiotic - Nitroimidazole", prescription_required: true },
  { molecule: "cefixime 200mg", brand_examples: ["taxim-o", "cefix", "zifi", "cefspan"], brand_price_per_unit: 32.0, generic_price_per_unit: 9.0, jan_aushadhi_price_per_unit: 5.50, unit: "tablet", category: "Antibiotic - Cephalosporin", prescription_required: true },
  { molecule: "ceftriaxone 1g", brand_examples: ["monocef", "acef", "rocephin", "cefocef"], brand_price_per_unit: 120.0, generic_price_per_unit: 35.0, jan_aushadhi_price_per_unit: 22.0, unit: "vial", category: "Antibiotic - Cephalosporin", prescription_required: true },
  { molecule: "cotrimoxazole 960mg", brand_examples: ["bactrim", "septran", "cotrim", "kotrim"], brand_price_per_unit: 6.0, generic_price_per_unit: 1.5, jan_aushadhi_price_per_unit: 0.90, unit: "tablet", category: "Antibiotic - Sulfonamide", prescription_required: true },

  // ── Antihypertensives
  { molecule: "amlodipine 5mg", brand_examples: ["amlovas", "norvasc", "stamlo", "amlokind"], brand_price_per_unit: 8.0, generic_price_per_unit: 1.5, jan_aushadhi_price_per_unit: 0.95, unit: "tablet", category: "CCB - Antihypertensive", prescription_required: true },
  { molecule: "telmisartan 40mg", brand_examples: ["telma", "telsartan", "telmikind", "telmace"], brand_price_per_unit: 12.0, generic_price_per_unit: 3.0, jan_aushadhi_price_per_unit: 1.85, unit: "tablet", category: "ARB - Antihypertensive", prescription_required: true },
  { molecule: "enalapril 5mg", brand_examples: ["envas", "vasotec", "enam"], brand_price_per_unit: 6.5, generic_price_per_unit: 1.5, jan_aushadhi_price_per_unit: 0.90, unit: "tablet", category: "ACEi - Antihypertensive", prescription_required: true },
  { molecule: "ramipril 5mg", brand_examples: ["cardace", "ramistar", "altace", "hopace"], brand_price_per_unit: 10.0, generic_price_per_unit: 2.5, jan_aushadhi_price_per_unit: 1.55, unit: "tablet", category: "ACEi - Antihypertensive", prescription_required: true },
  { molecule: "metoprolol 50mg", brand_examples: ["met xl", "metolar", "lopressor", "betaloc"], brand_price_per_unit: 9.0, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.25, unit: "tablet", category: "Beta-Blocker", prescription_required: true },
  { molecule: "furosemide 40mg", brand_examples: ["lasix", "furosemid", "frumil"], brand_price_per_unit: 3.5, generic_price_per_unit: 0.8, jan_aushadhi_price_per_unit: 0.50, unit: "tablet", category: "Loop Diuretic", prescription_required: true },
  { molecule: "hydrochlorothiazide 25mg", brand_examples: ["aquazide", "esidrex", "hydrazide"], brand_price_per_unit: 3.0, generic_price_per_unit: 0.7, jan_aushadhi_price_per_unit: 0.45, unit: "tablet", category: "Thiazide Diuretic", prescription_required: true },
  { molecule: "spironolactone 25mg", brand_examples: ["aldactone", "lasilactone", "spiractin"], brand_price_per_unit: 8.5, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.25, unit: "tablet", category: "Potassium-Sparing Diuretic", prescription_required: true },

  // ── Antidiabetics
  { molecule: "metformin 500mg", brand_examples: ["glycomet", "glucophage", "obimet", "formet"], brand_price_per_unit: 5.0, generic_price_per_unit: 1.0, jan_aushadhi_price_per_unit: 0.65, unit: "tablet", category: "Biguanide - Antidiabetic", prescription_required: true },
  { molecule: "metformin 1000mg", brand_examples: ["glycomet gp", "glucomet", "glucophage xr"], brand_price_per_unit: 8.0, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.25, unit: "tablet", category: "Biguanide - Antidiabetic", prescription_required: true },
  { molecule: "glibenclamide 5mg", brand_examples: ["daonil", "glinil", "euglucon", "glynase"], brand_price_per_unit: 4.0, generic_price_per_unit: 0.8, jan_aushadhi_price_per_unit: 0.50, unit: "tablet", category: "Sulphonylurea - Antidiabetic", prescription_required: true },
  { molecule: "glimepiride 2mg", brand_examples: ["amaryl", "glimer", "glimy", "zoryl"], brand_price_per_unit: 7.5, generic_price_per_unit: 1.8, jan_aushadhi_price_per_unit: 1.10, unit: "tablet", category: "Sulphonylurea - Antidiabetic", prescription_required: true },
  { molecule: "voglibose 0.3mg", brand_examples: ["volix", "vobose", "vogesic"], brand_price_per_unit: 9.5, generic_price_per_unit: 2.5, jan_aushadhi_price_per_unit: 1.60, unit: "tablet", category: "Alpha-Glucosidase Inhibitor", prescription_required: true },
  { molecule: "sitagliptin 100mg", brand_examples: ["januvia", "sitaglip", "istamet", "sitaday"], brand_price_per_unit: 52.0, generic_price_per_unit: 15.0, jan_aushadhi_price_per_unit: 9.50, unit: "tablet", category: "DPP-4 Inhibitor - Antidiabetic", prescription_required: true },
  { molecule: "human insulin 100IU/mL", brand_examples: ["huminsulin", "actrapid", "wosulin", "insugen"], brand_price_per_unit: 180.0, generic_price_per_unit: 85.0, jan_aushadhi_price_per_unit: 55.0, unit: "vial", category: "Insulin", prescription_required: true },

  // ── Cardiac / Lipid-lowering
  { molecule: "atorvastatin 10mg", brand_examples: ["lipitor", "atorva", "storvas", "lipvas"], brand_price_per_unit: 10.0, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.30, unit: "tablet", category: "Statin", prescription_required: true },
  { molecule: "atorvastatin 40mg", brand_examples: ["atorva 40", "storvas 40", "lipitor 40"], brand_price_per_unit: 18.0, generic_price_per_unit: 4.5, jan_aushadhi_price_per_unit: 2.80, unit: "tablet", category: "Statin", prescription_required: true },
  { molecule: "rosuvastatin 10mg", brand_examples: ["rozavel", "crestor", "rosuvas", "rosave"], brand_price_per_unit: 14.0, generic_price_per_unit: 3.5, jan_aushadhi_price_per_unit: 2.20, unit: "tablet", category: "Statin", prescription_required: true },
  { molecule: "aspirin 75mg", brand_examples: ["ecosprin", "disprin", "ascard", "angisprin"], brand_price_per_unit: 1.5, generic_price_per_unit: 0.4, jan_aushadhi_price_per_unit: 0.25, unit: "tablet", category: "Antiplatelet", prescription_required: false },
  { molecule: "clopidogrel 75mg", brand_examples: ["plavix", "clopilet", "clopivas", "deplatt"], brand_price_per_unit: 22.0, generic_price_per_unit: 5.5, jan_aushadhi_price_per_unit: 3.50, unit: "tablet", category: "Antiplatelet", prescription_required: true },
  { molecule: "digoxin 0.25mg", brand_examples: ["digoxin pfizer", "lanoxin", "digocid"], brand_price_per_unit: 3.5, generic_price_per_unit: 1.0, jan_aushadhi_price_per_unit: 0.65, unit: "tablet", category: "Cardiac Glycoside", prescription_required: true },
  { molecule: "warfarin 5mg", brand_examples: ["warf", "coumadin", "cofarin", "war 5"], brand_price_per_unit: 8.0, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.30, unit: "tablet", category: "Anticoagulant", prescription_required: true },
  { molecule: "isosorbide mononitrate 20mg", brand_examples: ["ismo", "monotrate", "imdur", "isordil"], brand_price_per_unit: 7.5, generic_price_per_unit: 1.8, jan_aushadhi_price_per_unit: 1.10, unit: "tablet", category: "Nitrate", prescription_required: true },

  // ── GI
  { molecule: "omeprazole 20mg", brand_examples: ["omez", "prilosec", "ocid", "omesec"], brand_price_per_unit: 5.5, generic_price_per_unit: 1.2, jan_aushadhi_price_per_unit: 0.75, unit: "capsule", category: "PPI", prescription_required: false },
  { molecule: "pantoprazole 40mg", brand_examples: ["pan 40", "pantocid", "pantodac", "somac"], brand_price_per_unit: 9.0, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.25, unit: "tablet", category: "PPI", prescription_required: false },
  { molecule: "domperidone 10mg", brand_examples: ["domstal", "vomistop", "motilium", "nausea dom"], brand_price_per_unit: 3.5, generic_price_per_unit: 0.8, jan_aushadhi_price_per_unit: 0.50, unit: "tablet", category: "Prokinetic / Antiemetic", prescription_required: false },
  { molecule: "ondansetron 4mg", brand_examples: ["emeset", "zofran", "ondanova", "vomikind"], brand_price_per_unit: 12.0, generic_price_per_unit: 3.0, jan_aushadhi_price_per_unit: 1.85, unit: "tablet", category: "5HT3 Antagonist - Antiemetic", prescription_required: true },
  { molecule: "loperamide 2mg", brand_examples: ["imodium", "eldoper", "lopamide"], brand_price_per_unit: 4.5, generic_price_per_unit: 1.0, jan_aushadhi_price_per_unit: 0.65, unit: "tablet", category: "Antidiarrheal", prescription_required: false },
  { molecule: "ORS sachet", brand_examples: ["electral", "pedialyte", "ors electral"], brand_price_per_unit: 15.0, generic_price_per_unit: 5.0, jan_aushadhi_price_per_unit: 3.0, unit: "sachet", category: "Rehydration", prescription_required: false },

  // ── Respiratory
  { molecule: "salbutamol 100mcg inhaler", brand_examples: ["asthalin", "ventolin", "salbetol", "salbudil"], brand_price_per_unit: 85.0, generic_price_per_unit: 42.0, jan_aushadhi_price_per_unit: 25.0, unit: "inhaler", category: "SABA - Bronchodilator", prescription_required: true },
  { molecule: "budesonide 200mcg inhaler", brand_examples: ["budecort", "pulmicort", "budamate"], brand_price_per_unit: 185.0, generic_price_per_unit: 85.0, jan_aushadhi_price_per_unit: 52.0, unit: "inhaler", category: "ICS - Corticosteroid", prescription_required: true },
  { molecule: "montelukast 10mg", brand_examples: ["montair", "singulair", "montek", "romilast"], brand_price_per_unit: 15.0, generic_price_per_unit: 4.0, jan_aushadhi_price_per_unit: 2.50, unit: "tablet", category: "Leukotriene Antagonist", prescription_required: true },
  { molecule: "cetirizine 10mg", brand_examples: ["zyrtec", "cetrizine", "alerid", "okacet"], brand_price_per_unit: 4.0, generic_price_per_unit: 0.9, jan_aushadhi_price_per_unit: 0.55, unit: "tablet", category: "Antihistamine", prescription_required: false },
  { molecule: "levocetrizine 5mg", brand_examples: ["xyzal", "levocet", "vozet", "starez"], brand_price_per_unit: 7.0, generic_price_per_unit: 1.5, jan_aushadhi_price_per_unit: 0.95, unit: "tablet", category: "Antihistamine", prescription_required: false },

  // ── Psychiatry / Neurology
  { molecule: "sertraline 50mg", brand_examples: ["zoloft", "serta", "serenata", "serotax"], brand_price_per_unit: 18.0, generic_price_per_unit: 4.5, jan_aushadhi_price_per_unit: 2.80, unit: "tablet", category: "SSRI - Antidepressant", prescription_required: true },
  { molecule: "fluoxetine 20mg", brand_examples: ["prodep", "prozac", "fludac", "depsonil"], brand_price_per_unit: 10.0, generic_price_per_unit: 2.5, jan_aushadhi_price_per_unit: 1.55, unit: "capsule", category: "SSRI - Antidepressant", prescription_required: true },
  { molecule: "escitalopram 10mg", brand_examples: ["escitalo", "stalopam", "cipralex", "nexito"], brand_price_per_unit: 12.0, generic_price_per_unit: 3.0, jan_aushadhi_price_per_unit: 1.85, unit: "tablet", category: "SSRI - Antidepressant", prescription_required: true },
  { molecule: "alprazolam 0.25mg", brand_examples: ["alprax", "xanax", "restyl", "alzolam"], brand_price_per_unit: 5.5, generic_price_per_unit: 1.2, jan_aushadhi_price_per_unit: 0.75, unit: "tablet", category: "Benzodiazepine", prescription_required: true },
  { molecule: "gabapentin 300mg", brand_examples: ["neurontin", "gabapin", "gabantin"], brand_price_per_unit: 15.0, generic_price_per_unit: 4.0, jan_aushadhi_price_per_unit: 2.50, unit: "capsule", category: "Anticonvulsant / Neuropathic pain", prescription_required: true },
  { molecule: "levetiracetam 500mg", brand_examples: ["keppra", "levera", "levetra", "torvate"], brand_price_per_unit: 35.0, generic_price_per_unit: 9.0, jan_aushadhi_price_per_unit: 5.50, unit: "tablet", category: "Anticonvulsant", prescription_required: true },

  // ── Endocrine / Osteoporosis
  { molecule: "levothyroxine 50mcg", brand_examples: ["thyronorm", "eltroxin", "lethyrox"], brand_price_per_unit: 3.5, generic_price_per_unit: 0.8, jan_aushadhi_price_per_unit: 0.50, unit: "tablet", category: "Thyroid Hormone", prescription_required: true },
  { molecule: "calcium carbonate 500mg + vit D3", brand_examples: ["shelcal", "cal-cvit", "calcitas"], brand_price_per_unit: 8.0, generic_price_per_unit: 2.0, jan_aushadhi_price_per_unit: 1.25, unit: "tablet", category: "Calcium Supplement", prescription_required: false },
  { molecule: "prednisolone 5mg", brand_examples: ["wysolone", "omnacortil", "predone"], brand_price_per_unit: 3.5, generic_price_per_unit: 0.8, jan_aushadhi_price_per_unit: 0.50, unit: "tablet", category: "Corticosteroid", prescription_required: true },

  // ── Anti-infectives (India-specific)
  { molecule: "artesunate + lumefantrine", brand_examples: ["coartem", "riamet", "lumartem"], brand_price_per_unit: 85.0, generic_price_per_unit: 30.0, jan_aushadhi_price_per_unit: 18.0, unit: "tablet", category: "Antimalarial", prescription_required: true },
  { molecule: "chloroquine 250mg", brand_examples: ["lariago", "malarex", "resochin"], brand_price_per_unit: 4.5, generic_price_per_unit: 1.2, jan_aushadhi_price_per_unit: 0.75, unit: "tablet", category: "Antimalarial", prescription_required: true },
  { molecule: "doxycycline 100mg (dengue)", brand_examples: ["doxy 1", "biodoxi", "doxt sl"], brand_price_per_unit: 12.0, generic_price_per_unit: 2.5, jan_aushadhi_price_per_unit: 1.50, unit: "capsule", category: "Antibiotic / Rickettsial", prescription_required: true },
  { molecule: "ivermectin 12mg", brand_examples: ["ivomec", "ivecop", "iverda"], brand_price_per_unit: 25.0, generic_price_per_unit: 8.0, jan_aushadhi_price_per_unit: 5.0, unit: "tablet", category: "Antiparasitic", prescription_required: true },

  // ── Vitamins / Supplements
  { molecule: "vitamin B12 1000mcg", brand_examples: ["neurobion", "mecobal", "methylcobal"], brand_price_per_unit: 18.0, generic_price_per_unit: 5.0, jan_aushadhi_price_per_unit: 3.0, unit: "tablet", category: "Vitamin B12", prescription_required: false },
  { molecule: "folic acid 5mg", brand_examples: ["folvite", "folate 5", "folsafe"], brand_price_per_unit: 2.5, generic_price_per_unit: 0.5, jan_aushadhi_price_per_unit: 0.30, unit: "tablet", category: "Vitamin (Haematinic)", prescription_required: false },
  { molecule: "ferrous sulphate 200mg", brand_examples: ["autrin", "fersolate", "fefol"], brand_price_per_unit: 2.0, generic_price_per_unit: 0.4, jan_aushadhi_price_per_unit: 0.25, unit: "tablet", category: "Iron Supplement", prescription_required: false },
];

// ─── Nearest Jan Aushadhi stores (mock geolocation) ───────────────────────────

const JAN_AUSHADHI_STORES = [
  { name: "PM Janaushadhi Kendra - Shivajinagar", distance: "0.8 km", timing: "8 AM – 9 PM", phone: "020-25678901" },
  { name: "PM Janaushadhi Kendra - Kothrud", distance: "1.4 km", timing: "9 AM – 8 PM", phone: "020-25234567" },
  { name: "PM Janaushadhi Kendra - Deccan", distance: "2.1 km", timing: "8 AM – 10 PM", phone: "020-25678432" },
  { name: "PM Janaushadhi Kendra - Sadashiv Peth", distance: "2.8 km", timing: "9 AM – 7 PM", phone: "020-24473829" },
];

// ─── Lookup function ──────────────────────────────────────────────────────────

export interface DrugLookupResult {
  found: boolean;
  entry?: DrugEntry;
  brand_matched?: string;
  nearest_store?: typeof JAN_AUSHADHI_STORES[0];
  monthly_savings_14day?: number;  // 14-day course savings (brand vs JA)
  savings_pct?: number;
}

export function lookupDrug(nameInput: string): DrugLookupResult {
  const q = nameInput.toLowerCase().trim();

  // Try molecule name match
  let entry = DRUG_DATABASE.find((d) =>
    d.molecule.toLowerCase().includes(q) || q.includes(d.molecule.toLowerCase().split(" ")[0])
  );

  let brand_matched: string | undefined;

  // Try brand name match
  if (!entry) {
    for (const d of DRUG_DATABASE) {
      const match = d.brand_examples.find((b) => b.includes(q) || q.includes(b));
      if (match) {
        entry = d;
        brand_matched = match;
        break;
      }
    }
  }

  if (!entry) return { found: false };

  const nearest_store = JAN_AUSHADHI_STORES[0];
  const monthly_savings_14day = Math.round(
    (entry.brand_price_per_unit - entry.jan_aushadhi_price_per_unit) * 14
  );
  const savings_pct = Math.round(
    ((entry.brand_price_per_unit - entry.jan_aushadhi_price_per_unit) / entry.brand_price_per_unit) * 100
  );

  return { found: true, entry, brand_matched, nearest_store, monthly_savings_14day, savings_pct };
}

export function lookupMedications(meds: Array<{ name: string }>): DrugLookupResult[] {
  return meds.map((m) => lookupDrug(m.name)).filter((r) => r.found);
}
