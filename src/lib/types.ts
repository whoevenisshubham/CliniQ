// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = "doctor" | "patient" | "nurse" | "admin" | "research" | "receptionist";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  language_pref: "en" | "hi" | "hinglish";
  avatar_url?: string;
  created_at: string;
}

// ─── Patient ────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  user_id: string;
  name: string;
  dob: string;
  gender: "M" | "F" | "Other";
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  abha_id?: string; // Ayushman Bharat Health Account ID
  phone: string;
  address?: string;
  emergency_contact?: string;
  family_id?: string; // for Family Health Graph
  created_at: string;
}

// ─── Consultation ────────────────────────────────────────────────────────────

export type ConsultationStatus = "active" | "completed" | "draft" | "cancelled";

export interface Consultation {
  id: string;
  doctor_id: string;
  patient_id: string;
  started_at: string;
  ended_at?: string;
  status: ConsultationStatus;
  consultation_type: "general" | "followup" | "emergency" | "triage" | "teleconsult";
  chief_complaint?: string;
  consent_recorded: boolean;
  consent_timestamp?: string;
  fhir_bundle?: FHIRBundle; // FHIR-lite structure
}

// ─── FHIR-lite ───────────────────────────────────────────────────────────────

export interface FHIRBundle {
  resourceType: "Bundle";
  id: string;
  timestamp: string;
  entry: FHIREntry[];
}

export interface FHIREntry {
  resource: FHIRCondition | FHIRObservation | FHIRMedicationRequest;
}

export interface FHIRCondition {
  resourceType: "Condition";
  code: { coding: { system: string; code: string; display: string }[] };
  subject: { reference: string };
  onsetDateTime?: string;
}

export interface FHIRObservation {
  resourceType: "Observation";
  code: { text: string };
  valueQuantity?: { value: number; unit: string };
  valueString?: string;
  status: "final" | "preliminary";
}

export interface FHIRMedicationRequest {
  resourceType: "MedicationRequest";
  medicationCodeableConcept: { text: string };
  dosageInstruction: { text: string }[];
  status: "active" | "completed";
}

// ─── EMR Entry ───────────────────────────────────────────────────────────────

export interface Vitals {
  bp_systolic?: number;
  bp_diastolic?: number;
  heart_rate?: number;
  temperature?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  respiratory_rate?: number;
}

export interface IcdCode {
  code: string;
  description: string;
  confidence: number;
  category?: string;
  snomed_ct?: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  brand_name?: string;
  generic_name?: string;
  instructions?: string;
}

export interface EMREntry {
  id: string;
  consultation_id: string;
  vitals: Vitals;
  chief_complaint: string;
  symptoms: string[];
  diagnosis: string[];
  icd_codes: IcdCode[];
  medications: Medication[];
  lab_tests_ordered: string[];
  physical_examination: string;
  missing_fields: string[];
  gap_prompts: string[]; // passive prompts for doctor
  clinical_summary?: string;
  patient_summary?: string;
  created_at: string;
  updated_at: string;
}

// ─── Safety Alerts ───────────────────────────────────────────────────────────

export type AlertType = "drug_interaction" | "allergy" | "contraindication" | "dosage";
export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface SafetyAlert {
  id: string;
  consultation_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  drug_a?: string;
  drug_b?: string;
  mechanism?: string;
  alternatives?: string[];
  acknowledged: boolean;
  acknowledged_by?: string;
  override_reason?: string;
  created_at: string;
}

// ─── Differential Diagnosis ──────────────────────────────────────────────────

export interface Differential {
  condition: string;
  probability: number; // 0-100
  reasoning: string;
  suggested_tests: string[];
  icd_code?: string;
}

// ─── Drug Cost ───────────────────────────────────────────────────────────────

export interface DrugCost {
  medication_name: string;
  brand_name: string;
  brand_price: number;
  generic_name: string;
  generic_price: number;
  jan_aushadhi_available: boolean;
  jan_aushadhi_price?: number;
  jan_aushadhi_store?: string;
  jan_aushadhi_distance?: string;
  monthly_savings: number;
  savings_percentage: number;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface BillingItem {
  description: string;
  category: "consultation" | "procedure" | "investigation" | "medication" | "equipment";
  quantity: number;
  unit_price: number;
  total: number;
}

export interface BillingDraft {
  id: string;
  consultation_id: string;
  line_items: BillingItem[];
  subtotal: number;
  tax: number;
  total: number;
  insurance_eligible: boolean;
  status: "draft" | "finalized" | "submitted";
  created_at: string;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export type AuditEventType =
  | "CONSULTATION_STARTED"
  | "CONSULTATION_ENDED"
  | "EMR_FIELD_UPDATED"
  | "SAFETY_ALERT_TRIGGERED"
  | "SAFETY_ALERT_ACKNOWLEDGED"
  | "PRESCRIPTION_ADDED"
  | "SUMMARY_SENT_TO_PATIENT"
  | "DOCUMENT_ACCESSED"
  | "CONSENT_RECORDED"
  | "ICD_CODE_MAPPED"
  | "ALERT_OVERRIDDEN";

export interface AuditEntry {
  id: string;
  consultation_id: string;
  event_type: AuditEventType;
  actor_id: string;
  actor_role: UserRole;
  payload: Record<string, unknown>;
  timestamp: string;
  hash: string; // SHA chain
  previous_hash: string;
}

// ─── Transcript ──────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  id: string;
  text: string;
  is_final: boolean;
  timestamp: number; // ms from start
  language?: string;
  speaker?: "doctor" | "patient" | "unknown";
}

// ─── Scribe State (for hook) ─────────────────────────────────────────────────

export interface ScribeState {
  segments: TranscriptSegment[];
  interim_text: string;
  full_transcript: string;
  is_recording: boolean;
  duration_ms: number;
  word_count: number;
  detected_language: string;
  error: string | null;
}

// ─── Consultation Store State ─────────────────────────────────────────────────

export interface ConsultationStoreState {
  active_consultation: Consultation | null;
  patient: Patient | null;
  scribe: ScribeState;
  emr_entry: Partial<EMREntry>;
  safety_alerts: SafetyAlert[];
  differentials: Differential[];
  drug_costs: DrugCost[];
  billing_draft: Partial<BillingDraft>;
  audit_entries: AuditEntry[];
  is_extracting: boolean;
  last_extraction_at: number | null;
}
