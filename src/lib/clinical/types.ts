// Adapted from sujitjaju1/mediflow 45fbfb853338d5236f2c34eb83e771ac4e9307ca
// src/lib/emr/; Sujit Jaju and contributors. See docs/core-pipeline-reuse.md.


export type Confidence = "high" | "medium" | "low";

export type EMRVitals = {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  weight?: number | null;
  height?: number | null;
};

export type EMRMedication = {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  route?: string | null;
  instructions?: string | null;
  /** Indication / billing ICD-10 mapped from local DB search */
  icd10_code?: string | null;
  icd10_description?: string | null;
  confidence?: Confidence;
};

export type EMRDiagnosisIcd = {
  diagnosis: string;
  icd10_code?: string | null;
  icd10_description?: string | null;
  confidence?: Confidence;
};

export type EMRSnapshot = {
  vitals?: EMRVitals;
  chief_complaint?: string | null;
  symptoms?: string[];
  diagnosis_text?: string[];
  diagnosis_icd?: EMRDiagnosisIcd[];
  medications?: EMRMedication[];
  lab_tests_ordered?: string[];
  clinical_summary?: string | null;
  patient_summary?: string | null;
  needs_confirmation?: string[];
};

