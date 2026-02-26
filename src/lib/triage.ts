/**
 * NexusMD Ambulance Triage Module
 * Simulates EMT radio patch data that pre-fills the doctor's consultation form.
 */

import type { Vitals } from "./types";

export interface TriagePatch {
  id: string;
  scenario: string;
  emt_unit: string;
  eta_minutes: number;
  patient: {
    name: string;
    age: number;
    gender: "M" | "F";
    blood_group?: string;
    known_conditions?: string[];
  };
  vitals: Vitals;
  chief_complaint: string;
  mechanism_of_injury?: string;
  treatments_given: string[];
  priority: "P1" | "P2" | "P3"; // P1 = immediate, P2 = urgent, P3 = delayed
  severity_score: number; // 0-100
  triage_category: "red" | "orange" | "yellow";
  er_prep_notes: string;
}

export const TRIAGE_PATCHES: TriagePatch[] = [
  {
    id: "triage-001",
    scenario: "STEMI — Acute MI",
    emt_unit: "Ambulance Unit A-7 (City EMS)",
    eta_minutes: 6,
    patient: {
      name: "Unknown Male ~60",
      age: 60,
      gender: "M",
      known_conditions: ["Hypertension", "Diabetes"],
    },
    vitals: {
      bp_systolic: 88,
      bp_diastolic: 58,
      heart_rate: 112,
      temperature: 36.8,
      spo2: 94,
      weight: 72,
    },
    chief_complaint: "Central crushing chest pain radiating to left arm, onset 40 minutes ago. Diaphoresis present.",
    treatments_given: [
      "O₂ @ 4L/min via nasal prongs",
      "Aspirin 325mg PO (chewable) given",
      "12-lead ECG — ST elevation V1-V4",
      "IV access established; NS bolus 200mL",
    ],
    priority: "P1",
    severity_score: 92,
    triage_category: "red",
    er_prep_notes: "STEMI protocol. Activate cath lab. Cardiology on call NOW. Prepare heparin, thrombolytics if PCI unavailable.",
  },
  {
    id: "triage-002",
    scenario: "Polytrauma — RTA",
    emt_unit: "Ambulance Unit B-3 (CATS)",
    eta_minutes: 11,
    patient: {
      name: "Unknown Female ~25-30",
      age: 27,
      gender: "F",
    },
    vitals: {
      bp_systolic: 94,
      bp_diastolic: 62,
      heart_rate: 128,
      temperature: 36.2,
      spo2: 91,
      weight: 55,
    },
    chief_complaint: "High-speed RTA (motorcycle vs truck). GCS 10/15. Suspected closed head injury, pelvic fracture.",
    mechanism_of_injury: "High-velocity motorcycle collision at ~80 km/h. Helmet worn but cracked.",
    treatments_given: [
      "C-spine immobilisation (rigid collar)",
      "O₂ via non-rebreather mask 15L/min",
      "Two large-bore IVs inserted — 500mL NS",
      "Tourniquet applied right lower leg (active bleed)",
    ],
    priority: "P1",
    severity_score: 88,
    triage_category: "red",
    er_prep_notes: "Major trauma activation. Neurosurgery + Orthopaedics standby. FAST scan on arrival. Cross-match 4 units pRBCs.",
  },
  {
    id: "triage-003",
    scenario: "Dengue Shock Syndrome",
    emt_unit: "Ambulance Unit C-12 (District EMS)",
    eta_minutes: 18,
    patient: {
      name: "Aryan Mehta",
      age: 17,
      gender: "M",
      known_conditions: [],
    },
    vitals: {
      bp_systolic: 80,
      bp_diastolic: 50,
      heart_rate: 138,
      temperature: 38.9,
      spo2: 97,
      weight: 58,
    },
    chief_complaint: "Day 5 dengue fever. Sudden deterioration — cold extremities, abdominal pain, restlessness. NS1 positive 3 days ago.",
    treatments_given: [
      "IV access 18G — isotonic crystalloid 250mL bolus",
      "Paracetamol 12mg/kg IV (avoid NSAIDs)",
      "ICT dengue — NS1 positive (day 3)",
    ],
    priority: "P1",
    severity_score: 85,
    triage_category: "red",
    er_prep_notes: "Dengue Shock Syndrome likely. Immediate FBC + haematocrit. Avoid NSAIDs. Aggressive fluid resuscitation. ICU bed needed.",
  },
  {
    id: "triage-004",
    scenario: "Acute CVA — Ischaemic Stroke",
    emt_unit: "Ambulance Unit A-2 (City EMS)",
    eta_minutes: 14,
    patient: {
      name: "Ramabai Kulkarni",
      age: 68,
      gender: "F",
      blood_group: "B+",
      known_conditions: ["Atrial Fibrillation", "Hypertension"],
    },
    vitals: {
      bp_systolic: 182,
      bp_diastolic: 106,
      heart_rate: 88,
      temperature: 37.1,
      spo2: 96,
      weight: 64,
    },
    chief_complaint: "Sudden onset right-sided facial droop, right arm weakness, slurred speech. Onset ~45 minutes ago. Last seen normal 1 hour back.",
    treatments_given: [
      "Cincinnati Stroke Scale: Face + Arm + Speech all positive",
      "O₂ maintained (SpO₂ 96%)",
      "IV access — no fluids (no hypotension)",
      "Blood glucose 118 mg/dL",
    ],
    priority: "P1",
    severity_score: 80,
    triage_category: "orange",
    er_prep_notes: "STROKE CODE activated. CT plain head on arrival. 4.5hr tPA window — onset 45min. Neurology on call. Avoid aggressive BP lowering if tPA candidate.",
  },
  {
    id: "triage-005",
    scenario: "Severe Asthma Exacerbation",
    emt_unit: "Ambulance Unit D-5 (City EMS)",
    eta_minutes: 9,
    patient: {
      name: "Priya Navale",
      age: 34,
      gender: "F",
      known_conditions: ["Bronchial Asthma since childhood"],
    },
    vitals: {
      bp_systolic: 140,
      bp_diastolic: 88,
      heart_rate: 115,
      temperature: 37.2,
      spo2: 88,
      weight: 52,
    },
    chief_complaint: "Severe acute wheeze and breathlessness. Unable to speak in full sentences. No response to own salbutamol inhaler × 3 puffs.",
    treatments_given: [
      "Nebulised salbutamol 5mg × 2 doses (en route)",
      "Ipratropium nebulisation 0.5mg added",
      "O₂ titrated to keep SpO₂ ≥94%",
      "IV access established",
    ],
    priority: "P2",
    severity_score: 70,
    triage_category: "orange",
    er_prep_notes: "Status asthmaticus risk. Prepare IV methylprednisolone 125mg. ABG on arrival. Anaesthesia standby for intubation if no response.",
  },
];

export function getRandomPatch(): TriagePatch {
  return TRIAGE_PATCHES[Math.floor(Math.random() * TRIAGE_PATCHES.length)];
}

export function getPatchById(id: string): TriagePatch | undefined {
  return TRIAGE_PATCHES.find((p) => p.id === id);
}
