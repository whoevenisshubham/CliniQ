"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Consultation,
  Patient,
  EMREntry,
  SafetyAlert,
  Differential,
  DrugCost,
  BillingDraft,
  AuditEntry,
  TranscriptSegment,
  ScribeState,
} from "@/lib/types";

interface ConsultationActions {
  // Consultation lifecycle
  setActiveConsultation: (consultation: Consultation | null) => void;
  setPatient: (patient: Patient | null) => void;
  endConsultation: () => void;

  // Scribe / transcript
  setRecording: (recording: boolean) => void;
  addSegment: (segment: TranscriptSegment) => void;
  setInterimText: (text: string) => void;
  setDetectedLanguage: (lang: string) => void;
  setScribeError: (error: string | null) => void;
  incrementDuration: (ms: number) => void;
  resetScribe: () => void;

  // EMR
  updateEMR: (partial: Partial<EMREntry>) => void;
  setIsExtracting: (v: boolean) => void;
  setLastExtractionAt: (ts: number) => void;

  // Safety
  addSafetyAlert: (alert: SafetyAlert) => void;
  acknowledgeAlert: (id: string, reason?: string) => void;
  clearAlerts: () => void;

  // Differentials
  setDifferentials: (diffs: Differential[]) => void;

  // Drug costs
  setDrugCosts: (costs: DrugCost[]) => void;

  // Billing
  updateBillingDraft: (partial: Partial<BillingDraft>) => void;

  // Audit
  addAuditEntry: (entry: AuditEntry) => void;

  // Reset all
  resetAll: () => void;
}

const initialScribe: ScribeState = {
  segments: [],
  interim_text: "",
  full_transcript: "",
  is_recording: false,
  duration_ms: 0,
  word_count: 0,
  detected_language: "en",
  error: null,
};

interface StoreState {
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

const initialState: StoreState = {
  active_consultation: null,
  patient: null,
  scribe: initialScribe,
  emr_entry: {
    symptoms: [],
    diagnosis: [],
    icd_codes: [],
    medications: [],
    lab_tests_ordered: [],
    missing_fields: [],
    gap_prompts: [],
    vitals: {},
    chief_complaint: "",
    physical_examination: "",
  },
  safety_alerts: [],
  differentials: [],
  drug_costs: [],
  billing_draft: { line_items: [], subtotal: 0, tax: 0, total: 0 },
  audit_entries: [],
  is_extracting: false,
  last_extraction_at: null,
};

export const useConsultationStore = create<StoreState & ConsultationActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ─── Consultation ─────────────────────────────────────────────────
      setActiveConsultation: (consultation) =>
        set({ active_consultation: consultation }, false, "setActiveConsultation"),

      setPatient: (patient) =>
        set({ patient }, false, "setPatient"),

      endConsultation: () =>
        set(
          (s) => ({
            active_consultation: s.active_consultation
              ? { ...s.active_consultation, status: "completed", ended_at: new Date().toISOString() }
              : null,
          }),
          false,
          "endConsultation"
        ),

      // ─── Scribe ───────────────────────────────────────────────────────
      setRecording: (is_recording) =>
        set((s) => ({ scribe: { ...s.scribe, is_recording } }), false, "setRecording"),

      addSegment: (segment) =>
        set((s) => {
          const segments = [...s.scribe.segments, segment];
          const finalText = segments
            .filter((seg) => seg.is_final)
            .map((seg) => seg.text)
            .join(" ");
          const wordCount = finalText.split(/\s+/).filter(Boolean).length;
          return {
            scribe: {
              ...s.scribe,
              segments,
              full_transcript: finalText,
              word_count: wordCount,
              interim_text: segment.is_final ? "" : segment.text,
            },
          };
        }, false, "addSegment"),

      setInterimText: (interim_text) =>
        set((s) => ({ scribe: { ...s.scribe, interim_text } }), false, "setInterimText"),

      setDetectedLanguage: (detected_language) =>
        set((s) => ({ scribe: { ...s.scribe, detected_language } }), false, "setDetectedLanguage"),

      setScribeError: (error) =>
        set((s) => ({ scribe: { ...s.scribe, error } }), false, "setScribeError"),

      incrementDuration: (ms) =>
        set((s) => ({ scribe: { ...s.scribe, duration_ms: s.scribe.duration_ms + ms } }), false, "incrementDuration"),

      resetScribe: () =>
        set({ scribe: initialScribe }, false, "resetScribe"),

      // ─── EMR ──────────────────────────────────────────────────────────
      updateEMR: (partial) =>
        set((s) => ({ emr_entry: { ...s.emr_entry, ...partial } }), false, "updateEMR"),

      setIsExtracting: (is_extracting) =>
        set({ is_extracting }, false, "setIsExtracting"),

      setLastExtractionAt: (last_extraction_at) =>
        set({ last_extraction_at }, false, "setLastExtractionAt"),

      // ─── Safety ───────────────────────────────────────────────────────
      addSafetyAlert: (alert) =>
        set((s) => ({ safety_alerts: [...s.safety_alerts, alert] }), false, "addSafetyAlert"),

      acknowledgeAlert: (id, reason) =>
        set(
          (s) => ({
            safety_alerts: s.safety_alerts.map((a) =>
              a.id === id
                ? { ...a, acknowledged: true, override_reason: reason }
                : a
            ),
          }),
          false,
          "acknowledgeAlert"
        ),

      clearAlerts: () =>
        set({ safety_alerts: [] }, false, "clearAlerts"),

      // ─── Differentials ────────────────────────────────────────────────
      setDifferentials: (differentials) =>
        set({ differentials }, false, "setDifferentials"),

      // ─── Drug costs ───────────────────────────────────────────────────
      setDrugCosts: (drug_costs) =>
        set({ drug_costs }, false, "setDrugCosts"),

      // ─── Billing ──────────────────────────────────────────────────────
      updateBillingDraft: (partial) =>
        set(
          (s) => ({ billing_draft: { ...s.billing_draft, ...partial } }),
          false,
          "updateBillingDraft"
        ),

      // ─── Audit ────────────────────────────────────────────────────────
      addAuditEntry: (entry) =>
        set((s) => ({ audit_entries: [...s.audit_entries, entry] }), false, "addAuditEntry"),

      // ─── Reset ────────────────────────────────────────────────────────
      resetAll: () => set(initialState, false, "resetAll"),
    }),
    { name: "NexusMD-ConsultationStore" }
  )
);
