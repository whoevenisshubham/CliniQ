/**
 * NexusMD Adaptive Epidemiology Module
 * Injects real-time location + seasonal disease context into the LLM prompt,
 * boosting region-specific conditions (e.g., Dengue in Pune Monsoon) in differentials.
 */

// ─── Indian seasons by month ──────────────────────────────────────────────────

export type IndianSeason = "winter" | "summer" | "pre_monsoon" | "monsoon" | "post_monsoon";

export function getCurrentIndianSeason(month?: number): IndianSeason {
  const m = month ?? new Date().getMonth() + 1; // 1-12
  if (m === 12 || m <= 2)   return "winter";
  if (m >= 3  && m <= 5)    return "summer";
  if (m === 6)              return "pre_monsoon";
  if (m >= 7  && m <= 9)    return "monsoon";
  return "post_monsoon"; // Oct-Nov
}

const SEASON_LABELS: Record<IndianSeason, string> = {
  winter:       "Winter (Dec–Feb)",
  summer:       "Summer (Mar–May)",
  pre_monsoon:  "Pre-Monsoon (Jun)",
  monsoon:      "Monsoon (Jul–Sep)",
  post_monsoon: "Post-Monsoon (Oct–Nov)",
};

// ─── Regional disease burden (India) ─────────────────────────────────────────

interface SeasonalDiseaseProfile {
  high_prevalence: string[];     // strongly boost these in differentials
  moderate_prevalence: string[]; // slightly boost
  alert_note: string;            // shown to doctor
}

const SEASONAL_PROFILES: Record<IndianSeason, SeasonalDiseaseProfile> = {
  monsoon: {
    high_prevalence: [
      "Dengue fever (DENV1-4)",
      "Plasmodium vivax malaria",
      "Plasmodium falciparum malaria",
      "Leptospirosis",
      "Enteric fever (Typhoid / Paratyphoid)",
      "Hepatitis A & E (water-borne)",
      "Acute gastroenteritis",
      "Cholera",
    ],
    moderate_prevalence: [
      "Viral conjunctivitis",
      "Fungal skin infections",
      "Scrub typhus",
      "Japanese encephalitis (rural)",
    ],
    alert_note: "⚠ Monsoon season — high vector-borne disease burden. Prioritise Dengue NS1/IgM and thick blood smear for febrile patients.",
  },
  post_monsoon: {
    high_prevalence: [
      "Dengue fever (peak seroprevalence post-monsoon)",
      "Chikungunya",
      "Leptospirosis (soil exposure)",
      "Enteric fever",
    ],
    moderate_prevalence: [
      "Acute respiratory infections",
      "Influenza (early wave)",
      "Scrub typhus (October peak)",
    ],
    alert_note: "Post-monsoon Dengue surge — residual vector breeding. Check platelet count in all febrile patients.",
  },
  winter: {
    high_prevalence: [
      "Influenza A & B",
      "COVID-19 / SARS-CoV-2",
      "Community-acquired pneumonia (CAP)",
      "Acute exacerbation of COPD / Asthma",
      "Bronchiolitis (RSV in children)",
    ],
    moderate_prevalence: [
      "Viral gastroenteritis (norovirus)",
      "Urinary tract infections",
      "Meningococcal disease (rare)",
    ],
    alert_note: "Winter respiratory season — consider rapid influenza test and COVID-19 screening for ILI.",
  },
  summer: {
    high_prevalence: [
      "Heat exhaustion / Heat stroke",
      "Dehydration (volume depletion)",
      "Acute gastroenteritis (food-borne)",
      "Chickenpox (Varicella)",
      "Measles / Mumps",
      "Meningitis (bacterial, young adults)",
    ],
    moderate_prevalence: [
      "Urticaria / heat rash",
      "Renal calculi (dehydration-related)",
      "Sunstroke",
    ],
    alert_note: "Summer peak — screen for dehydration and heat-related illness; food safety advisory active.",
  },
  pre_monsoon: {
    high_prevalence: [
      "Chickenpox (late wave)",
      "Acute gastroenteritis",
      "Heat-related illness",
      "Early Dengue (pre-vector surge)",
    ],
    moderate_prevalence: [
      "Allergic rhinitis (pollen)",
      "Asthma exacerbation",
    ],
    alert_note: "Pre-monsoon transition — pollen allergies and heat illness prominent.",
  },
};

// ─── City / state profile ─────────────────────────────────────────────────────

interface CityProfile {
  state: string;
  zone: "urban" | "semi_urban" | "rural";
  malaria_endemic: boolean;
  dengue_endemic: boolean;
  altitude_m: number;
  extra_context?: string;
}

const CITY_PROFILES: Record<string, CityProfile> = {
  pune:       { state: "Maharashtra", zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 560  },
  mumbai:     { state: "Maharashtra", zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 14   },
  delhi:      { state: "Delhi",       zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 216  },
  bangalore:  { state: "Karnataka",   zone: "urban",      malaria_endemic: false, dengue_endemic: true,  altitude_m: 920  },
  chennai:    { state: "Tamil Nadu",  zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 6    },
  hyderabad:  { state: "Telangana",   zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 542  },
  kolkata:    { state: "West Bengal", zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 9    },
  ahmedabad:  { state: "Gujarat",     zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 52   },
  jaipur:     { state: "Rajasthan",   zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 431  },
  lucknow:    { state: "UP",          zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 123  },
  nagpur:     { state: "Maharashtra", zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 310  },
  default:    { state: "India",       zone: "urban",      malaria_endemic: true,  dengue_endemic: true,  altitude_m: 200  },
};

// ─── Build context string for LLM ─────────────────────────────────────────────

export interface EpidemologyContext {
  location: string;
  season: IndianSeason;
  seasonLabel: string;
  city: CityProfile;
  profile: SeasonalDiseaseProfile;
  alertNote: string;
  llmContextBlock: string; // inject this directly into Groq prompt
}

export function buildEpidemiologyContext(city = "pune"): EpidemologyContext {
  const season = getCurrentIndianSeason();
  const cityKey = city.toLowerCase().replace(/\s/g, "");
  const cityProfile = CITY_PROFILES[cityKey] ?? CITY_PROFILES["default"];
  const profile = SEASONAL_PROFILES[season];

  const llmContextBlock = `
=== EPIDEMIOLOGICAL CONTEXT (inject into differential weighting) ===
Location     : ${city.charAt(0).toUpperCase() + city.slice(1)}, ${cityProfile.state}, India
Season       : ${SEASON_LABELS[season]}
Zone         : ${cityProfile.zone} | Altitude: ${cityProfile.altitude_m}m
Malaria risk : ${cityProfile.malaria_endemic ? "ENDEMIC" : "low"}
Dengue risk  : ${cityProfile.dengue_endemic ? "ENDEMIC" : "low"}

HIGH-PREVALENCE conditions THIS season (weight these HIGHER in differentials):
${profile.high_prevalence.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}

MODERATE-PREVALENCE conditions:
${profile.moderate_prevalence.map((d) => `  - ${d}`).join("\n")}

CLINICAL ALERT: ${profile.alert_note}

INSTRUCTION: When generating differentials, assign 15–30 percentage points HIGHER probability
to high-prevalence seasonal conditions (if clinically consistent with presented symptoms).
Always justify seasonal weighting in the "reasoning" field.
=== END EPIDEMIOLOGICAL CONTEXT ===
`.trim();

  return {
    location: city,
    season,
    seasonLabel: SEASON_LABELS[season],
    city: cityProfile,
    profile,
    alertNote: profile.alert_note,
    llmContextBlock,
  };
}
