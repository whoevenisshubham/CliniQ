"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  HeartPulse, Pill, Stethoscope, FlaskConical, Brain,
  FileText, Save, Send, Loader2, Info, MapPin, X, Mic, ShieldCheck, Sparkles, Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LiveTranscriptPanel } from "./LiveTranscriptPanel";
import { SafetyAlertModal } from "./SafetyAlertModal";
import { DrugCostPanel } from "./DrugCostPanel";
// SafetyAlertModal removed — sidebar alerts are sufficient
import { LiveBillingPanel } from "./LiveBillingPanel";
import { AuditTrailPanel } from "./AuditTrailPanel";
import { ConsentRecorder } from "./ConsentRecorder";
import { PatientSummaryPanel } from "./PatientSummaryPanel";
import { RuralModeIndicator } from "@/components/shared/RuralModeIndicator";
import { useMedicalScribe } from "@/hooks/useMedicalScribe";
import { useConsultationStore } from "@/store/consultationStore";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { buildAuditEntry, buildConsultationSummaryPayload, GENESIS_HASH } from "@/lib/audit-chain";
import { cn } from "@/lib/utils";
import { generateMedicalReport } from "@/lib/report-generator";
import type { SafetyAlert, Differential } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationStr(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Gap Toast Stack ──────────────────────────────────────────────────────────

interface GapToast {
  id: string;
  message: string;
}

function GapToastStack({
  toasts,
  onDismiss,
}: {
  toasts: GapToast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 max-w-xs pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-amber-500/30 shadow-lg pointer-events-auto"
          >
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Epi Season Badge ─────────────────────────────────────────────────────────

function EpiSeasonBadge({
  season,
  location,
  alertNote,
}: {
  season: string;
  location: string;
  alertNote: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const seasonColors: Record<string, string> = {
    monsoon: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    post_monsoon: "bg-cyan-500/15 border-cyan-500/30 text-cyan-300",
    winter: "bg-indigo-500/15 border-indigo-500/30 text-indigo-300",
    summer: "bg-orange-500/15 border-orange-500/30 text-orange-300",
    pre_monsoon: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
  };

  const colorClass = seasonColors[season] ?? "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground-muted)]";

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-colors",
          colorClass
        )}
      >
        <MapPin className="w-3 h-3 shrink-0" />
        <span className="capitalize">{location}</span>
        <span className="opacity-60">·</span>
        <span className="capitalize">{season.replace("_", "-")}</span>
      </button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 top-full mt-2 w-72 p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] shadow-xl z-50"
          >
            <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1">
              Epidemiological Context
            </p>
            <p className="text-xs text-[var(--foreground)] leading-relaxed">{alertNote}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EMR Live Panel ───────────────────────────────────────────────────────────

function EMRLivePanel() {
  const { emr_entry, is_extracting, updateEMR } = useConsultationStore();
  const [expanded, setExpanded] = useState({
    vitals: true, symptoms: true, diagnosis: true, medications: true, labs: false,
  });

  // Inline editing state
  const [editingVital, setEditingVital] = useState<string | null>(null);
  const [editingSymptom, setEditingSymptom] = useState<number | null>(null);
  const [editingDiagnosis, setEditingDiagnosis] = useState<number | null>(null);
  const [editingMed, setEditingMed] = useState<number | null>(null);
  const [editingLab, setEditingLab] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addingTo, setAddingTo] = useState<"symptoms" | "diagnosis" | "medications" | "labs" | null>(null);
  const [addValue, setAddValue] = useState("");
  const [addMedFields, setAddMedFields] = useState({ name: "", dosage: "", frequency: "", duration: "" });
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { editRef.current?.focus(); }, [editingVital, editingSymptom, editingDiagnosis, editingMed, editingLab, addingTo]);

  const toggle = (key: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ─── Vitals edit helpers ────────────────────────────────────────
  const vitalKeyMap: Record<string, string> = { "BP": "bp", "HR": "heart_rate", "SpO₂": "spo2", "Temp": "temperature", "Weight": "weight", "Height": "height" };

  const handleVitalSave = (label: string, val: string) => {
    const v = { ...(emr_entry.vitals ?? {}) };
    if (label === "BP") {
      const parts = val.split("/");
      (v as Record<string, unknown>).bp_systolic = parseInt(parts[0]) || undefined;
      (v as Record<string, unknown>).bp_diastolic = parseInt(parts[1]) || undefined;
    } else {
      const key = vitalKeyMap[label];
      if (key) (v as Record<string, unknown>)[key] = parseFloat(val) || undefined;
    }
    updateEMR({ vitals: v as typeof emr_entry.vitals });
    setEditingVital(null);
  };

  // ─── Symptoms helpers ──────────────────────────────────────────
  const handleSymptomEdit = (idx: number, val: string) => {
    const syms = [...(emr_entry.symptoms ?? [])];
    syms[idx] = val;
    updateEMR({ symptoms: syms });
    setEditingSymptom(null);
  };
  const handleSymptomDelete = (idx: number) => {
    const syms = [...(emr_entry.symptoms ?? [])];
    syms.splice(idx, 1);
    updateEMR({ symptoms: syms });
  };
  const handleSymptomAdd = () => {
    if (!addValue.trim()) return;
    updateEMR({ symptoms: [...(emr_entry.symptoms ?? []), addValue.trim()] });
    setAddValue(""); setAddingTo(null);
  };

  // ─── Diagnosis helpers ─────────────────────────────────────────
  const handleDiagnosisEdit = (idx: number, val: string) => {
    const codes = [...(emr_entry.icd_codes ?? [])];
    codes[idx] = { ...codes[idx], description: val };
    updateEMR({ icd_codes: codes });
    setEditingDiagnosis(null);
  };
  const handleDiagnosisDelete = (idx: number) => {
    const codes = [...(emr_entry.icd_codes ?? [])];
    codes.splice(idx, 1);
    updateEMR({ icd_codes: codes });
  };
  const handleDiagnosisAdd = () => {
    if (!addValue.trim()) return;
    updateEMR({ icd_codes: [...(emr_entry.icd_codes ?? []), { code: "—", description: addValue.trim(), confidence: 1.0 }] });
    setAddValue(""); setAddingTo(null);
  };

  // ─── Medication helpers ────────────────────────────────────────
  const handleMedEdit = (idx: number, val: string) => {
    const meds = [...(emr_entry.medications ?? [])];
    meds[idx] = { ...meds[idx], name: val };
    updateEMR({ medications: meds });
    setEditingMed(null);
  };
  const handleMedDelete = (idx: number) => {
    const meds = [...(emr_entry.medications ?? [])];
    meds.splice(idx, 1);
    updateEMR({ medications: meds });
  };
  const handleMedAdd = () => {
    if (!addMedFields.name.trim()) return;
    updateEMR({
      medications: [...(emr_entry.medications ?? []), {
        name: addMedFields.name.trim(),
        dosage: addMedFields.dosage || "As prescribed",
        frequency: addMedFields.frequency || "OD",
        duration: addMedFields.duration || "5 days",
        route: "Oral",
      }],
    });
    setAddMedFields({ name: "", dosage: "", frequency: "", duration: "" }); setAddingTo(null);
  };

  // ─── Lab test helpers ──────────────────────────────────────────
  const handleLabEdit = (idx: number, val: string) => {
    const labs = [...(emr_entry.lab_tests_ordered ?? [])];
    labs[idx] = val;
    updateEMR({ lab_tests_ordered: labs });
    setEditingLab(null);
  };
  const handleLabDelete = (idx: number) => {
    const labs = [...(emr_entry.lab_tests_ordered ?? [])];
    labs.splice(idx, 1);
    updateEMR({ lab_tests_ordered: labs });
  };
  const handleLabAdd = () => {
    if (!addValue.trim()) return;
    updateEMR({ lab_tests_ordered: [...(emr_entry.lab_tests_ordered ?? []), addValue.trim()] });
    setAddValue(""); setAddingTo(null);
  };

  return (
    <div className="space-y-2">
      {/* Extraction indicator */}
      {is_extracting && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <span className="text-xs text-blue-400">Extracting clinical data...</span>
        </div>
      )}

      {/* Vitals */}
      <EMRSection
        title="Vitals"
        icon={<HeartPulse className="w-3.5 h-3.5 text-red-400" />}
        expanded={expanded.vitals}
        onToggle={() => toggle("vitals")}
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "BP", value: emr_entry.vitals?.bp_systolic ? `${emr_entry.vitals.bp_systolic}/${emr_entry.vitals.bp_diastolic}` : "—", unit: "mmHg" },
            { label: "HR", value: emr_entry.vitals?.heart_rate?.toString() ?? "—", unit: "bpm" },
            { label: "SpO₂", value: emr_entry.vitals?.spo2?.toString() ?? "—", unit: "%" },
            { label: "Temp", value: emr_entry.vitals?.temperature?.toString() ?? "—", unit: "°F" },
            { label: "Weight", value: emr_entry.vitals?.weight?.toString() ?? "—", unit: "kg" },
            { label: "Height", value: emr_entry.vitals?.height?.toString() ?? "—", unit: "cm" },
          ].map((vital) => (
            <div
              key={vital.label}
              className="text-center p-2 rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] cursor-pointer hover:border-blue-500/40 transition-colors group"
              onClick={() => { if (editingVital !== vital.label) { setEditingVital(vital.label); setEditValue(vital.value === "—" ? "" : vital.value); } }}
            >
              <p className="text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider">{vital.label}</p>
              {editingVital === vital.label ? (
                <input
                  ref={editRef}
                  className="w-full text-sm font-bold text-center bg-transparent border-b border-blue-500 outline-none text-[var(--foreground)] mt-0.5"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleVitalSave(vital.label, editValue); if (e.key === "Escape") setEditingVital(null); }}
                  onBlur={() => handleVitalSave(vital.label, editValue)}
                  placeholder={vital.label === "BP" ? "120/80" : "0"}
                />
              ) : (
                <p className={cn("text-sm font-bold mt-0.5", vital.value !== "—" ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]")}>
                  {vital.value}
                </p>
              )}
              <p className="text-[9px] text-[var(--foreground-subtle)]">{vital.unit}</p>
            </div>
          ))}
        </div>
      </EMRSection>

      {/* Symptoms */}
      <EMRSection
        title={`Symptoms ${emr_entry.symptoms?.length ? `(${emr_entry.symptoms.length})` : ""}`}
        icon={<Stethoscope className="w-3.5 h-3.5 text-blue-400" />}
        expanded={expanded.symptoms}
        onToggle={() => toggle("symptoms")}
        onAdd={() => { setAddingTo("symptoms"); setAddValue(""); }}
      >
        <div className="flex flex-wrap gap-1.5 min-h-8">
          {emr_entry.symptoms && emr_entry.symptoms.length > 0 ? (
            emr_entry.symptoms.map((s, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative group"
              >
                {editingSymptom === i ? (
                  <input
                    ref={editRef}
                    className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface)] border border-blue-500 outline-none text-[var(--foreground)] w-32"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSymptomEdit(i, editValue); if (e.key === "Escape") setEditingSymptom(null); }}
                    onBlur={() => handleSymptomEdit(i, editValue)}
                  />
                ) : (
                  <>
                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-blue-500/20 transition-colors pr-5" onClick={() => { setEditingSymptom(i); setEditValue(s); }}>
                      {s}
                    </Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSymptomDelete(i); }}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </>
                )}
              </motion.span>
            ))
          ) : (
            <p className="text-xs text-[var(--foreground-subtle)] italic">Listening for symptoms...</p>
          )}
          {addingTo === "symptoms" && (
            <input
              ref={editRef}
              className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface)] border border-green-500 outline-none text-[var(--foreground)] w-36"
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSymptomAdd(); if (e.key === "Escape") setAddingTo(null); }}
              onBlur={() => { if (addValue.trim()) handleSymptomAdd(); else setAddingTo(null); }}
              placeholder="Add symptom..."
            />
          )}
        </div>
      </EMRSection>

      {/* Diagnosis & ICD codes */}
      <EMRSection
        title={`Diagnosis ${emr_entry.icd_codes?.length ? `(${emr_entry.icd_codes.length} ICD codes)` : ""}`}
        icon={<Brain className="w-3.5 h-3.5 text-purple-400" />}
        expanded={expanded.diagnosis}
        onToggle={() => toggle("diagnosis")}
        onAdd={() => { setAddingTo("diagnosis"); setAddValue(""); }}
      >
        <div className="space-y-1.5 min-h-6">
          {emr_entry.icd_codes && emr_entry.icd_codes.length > 0 ? (
            emr_entry.icd_codes.map((code, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 group"
              >
                <Badge variant="default" className="font-mono text-[10px] shrink-0">{code.code}</Badge>
                {editingDiagnosis === i ? (
                  <input
                    ref={editRef}
                    className="flex-1 text-xs bg-transparent border-b border-blue-500 outline-none text-[var(--foreground)]"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleDiagnosisEdit(i, editValue); if (e.key === "Escape") setEditingDiagnosis(null); }}
                    onBlur={() => handleDiagnosisEdit(i, editValue)}
                  />
                ) : (
                  <span className="text-xs text-[var(--foreground-muted)] truncate cursor-pointer hover:text-[var(--foreground)] transition-colors" onClick={() => { setEditingDiagnosis(i); setEditValue(code.description); }}>
                    {code.description}
                  </span>
                )}
                <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0">
                  {Math.round(code.confidence * 100)}%
                </span>
                <button
                  onClick={() => handleDiagnosisDelete(i)}
                  className="w-3.5 h-3.5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <X className="w-2 h-2" />
                </button>
              </motion.div>
            ))
          ) : (
            <p className="text-xs text-[var(--foreground-subtle)] italic">Awaiting diagnosis extraction...</p>
          )}
          {addingTo === "diagnosis" && (
            <div className="flex items-center gap-2">
              <Badge variant="default" className="font-mono text-[10px] shrink-0">—</Badge>
              <input
                ref={editRef}
                className="flex-1 text-xs bg-transparent border-b border-green-500 outline-none text-[var(--foreground)]"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleDiagnosisAdd(); if (e.key === "Escape") setAddingTo(null); }}
                onBlur={() => { if (addValue.trim()) handleDiagnosisAdd(); else setAddingTo(null); }}
                placeholder="Add diagnosis..."
              />
            </div>
          )}
        </div>
      </EMRSection>

      {/* Medications */}
      <EMRSection
        title={`Medications ${emr_entry.medications?.length ? `(${emr_entry.medications.length})` : ""}`}
        icon={<Pill className="w-3.5 h-3.5 text-green-400" />}
        expanded={expanded.medications}
        onToggle={() => toggle("medications")}
        onAdd={() => { setAddingTo("medications"); setAddMedFields({ name: "", dosage: "", frequency: "", duration: "" }); }}
      >
        <div className="space-y-2 min-h-6">
          {emr_entry.medications && emr_entry.medications.length > 0 ? (
            emr_entry.medications.map((med, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 p-2 rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] group relative"
              >
                <div className="w-6 h-6 flex items-center justify-center rounded-md bg-green-500/10 shrink-0">
                  <Pill className="w-3 h-3 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingMed === i ? (
                    <input
                      ref={editRef}
                      className="w-full text-xs font-medium bg-transparent border-b border-blue-500 outline-none text-[var(--foreground)]"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleMedEdit(i, editValue); if (e.key === "Escape") setEditingMed(null); }}
                      onBlur={() => handleMedEdit(i, editValue)}
                    />
                  ) : (
                    <p className="text-xs font-medium text-[var(--foreground)] cursor-pointer hover:text-blue-400 transition-colors" onClick={() => { setEditingMed(i); setEditValue(med.name); }}>{med.name}</p>
                  )}
                  <p className="text-[10px] text-[var(--foreground-muted)]">
                    {med.dosage} · {med.frequency} · {med.duration}
                  </p>
                </div>
                <button
                  onClick={() => handleMedDelete(i)}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.div>
            ))
          ) : (
            <p className="text-xs text-[var(--foreground-subtle)] italic">Listening for medications...</p>
          )}
          {addingTo === "medications" && (
            <div className="p-2 rounded-lg bg-[var(--background)] border border-green-500/40 space-y-1.5">
              <input className="w-full text-xs bg-transparent border-b border-green-500/50 outline-none text-[var(--foreground)] pb-1" value={addMedFields.name} onChange={(e) => setAddMedFields(p => ({ ...p, name: e.target.value }))} placeholder="Medication name..." autoFocus />
              <div className="grid grid-cols-3 gap-1.5">
                <input className="text-[10px] bg-transparent border-b border-[var(--border)] outline-none text-[var(--foreground-muted)] pb-0.5" value={addMedFields.dosage} onChange={(e) => setAddMedFields(p => ({ ...p, dosage: e.target.value }))} placeholder="Dose" />
                <input className="text-[10px] bg-transparent border-b border-[var(--border)] outline-none text-[var(--foreground-muted)] pb-0.5" value={addMedFields.frequency} onChange={(e) => setAddMedFields(p => ({ ...p, frequency: e.target.value }))} placeholder="Frequency" />
                <input className="text-[10px] bg-transparent border-b border-[var(--border)] outline-none text-[var(--foreground-muted)] pb-0.5" value={addMedFields.duration} onChange={(e) => setAddMedFields(p => ({ ...p, duration: e.target.value }))} placeholder="Duration" />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <button onClick={() => setAddingTo(null)} className="text-[10px] px-2 py-0.5 text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">Cancel</button>
                <button onClick={handleMedAdd} className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30">Add</button>
              </div>
            </div>
          )}
        </div>
      </EMRSection>

      {/* Lab tests */}
      <EMRSection
        title={`Lab Tests ${emr_entry.lab_tests_ordered?.length ? `(${emr_entry.lab_tests_ordered.length})` : ""}`}
        icon={<FlaskConical className="w-3.5 h-3.5 text-cyan-400" />}
        expanded={expanded.labs}
        onToggle={() => toggle("labs")}
        onAdd={() => { setAddingTo("labs"); setAddValue(""); }}
      >
        <div className="flex flex-wrap gap-1.5">
          {emr_entry.lab_tests_ordered && emr_entry.lab_tests_ordered.length > 0 ? (
            emr_entry.lab_tests_ordered.map((test, i) => (
              <span key={i} className="relative group">
                {editingLab === i ? (
                  <input
                    ref={editRef}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface)] border border-blue-500 outline-none text-[var(--foreground)] w-28"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleLabEdit(i, editValue); if (e.key === "Escape") setEditingLab(null); }}
                    onBlur={() => handleLabEdit(i, editValue)}
                  />
                ) : (
                  <>
                    <Badge variant="outline" className="text-[10px] cursor-pointer hover:border-blue-500/50 transition-colors pr-5" onClick={() => { setEditingLab(i); setEditValue(test); }}>{test}</Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLabDelete(i); }}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </>
                )}
              </span>
            ))
          ) : (
            <p className="text-xs text-[var(--foreground-subtle)] italic">No tests ordered yet</p>
          )}
          {addingTo === "labs" && (
            <input
              ref={editRef}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface)] border border-green-500 outline-none text-[var(--foreground)] w-28"
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLabAdd(); if (e.key === "Escape") setAddingTo(null); }}
              onBlur={() => { if (addValue.trim()) handleLabAdd(); else setAddingTo(null); }}
              placeholder="Add test..."
            />
          )}
        </div>
      </EMRSection>
    </div>
  );
}

// ─── EMR Section wrapper ──────────────────────────────────────────────────────

function EMRSection({
  title, icon, expanded, onToggle, onAdd, children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[var(--border)] overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--surface-elevated)] transition-colors"
        >
          {icon}
          <span className="text-xs font-semibold text-[var(--foreground)] flex-1 text-left">{title}</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
          )}
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-2.5 py-2.5 hover:bg-green-500/10 transition-colors border-l border-[var(--border)]"
            title="Add new item"
          >
            <Plus className="w-3.5 h-3.5 text-green-400" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="px-4 pb-3 pt-0">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Safety Alert sidebar ─────────────────────────────────────────────────────

function SafetyAlertSidebar({
  alerts,
  onAcknowledge,
}: {
  alerts: SafetyAlert[];
  onAcknowledge: (id: string, reason?: string) => void;
}) {
  const criticalAlerts = alerts.filter((a) => !a.acknowledged && (a.severity === "critical" || a.severity === "high"));
  const otherAlerts = alerts.filter((a) => !a.acknowledged && a.severity !== "critical" && a.severity !== "high");
  const acknowledged = alerts.filter((a) => a.acknowledged);

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <CheckCircle2 className="w-8 h-8 text-green-500/40" />
        <p className="text-xs text-[var(--foreground-subtle)]">No active safety alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {criticalAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            className={cn(
              "p-3 rounded-lg border",
              alert.severity === "critical"
                ? "bg-red-500/10 border-red-500/30"
                : "bg-orange-500/10 border-orange-500/30",
              // newly detected "live" alerts flash slightly longer
              alert.id.startsWith("live-alert") && "animate-pulse border-red-500 ring-1 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            )}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className={cn(
                "w-4 h-4 shrink-0 mt-0.5",
                alert.severity === "critical" ? "text-red-400 animate-pulse" : "text-orange-400"
              )} />
              <div className="flex-1">
                <p className={cn("text-xs font-semibold", alert.severity === "critical" ? "text-red-300" : "text-orange-300")}>
                  {alert.title}
                </p>
                <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">{alert.description}</p>
                {alert.drug_a && alert.drug_b && (
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="destructive" className="text-[9px]">{alert.drug_a}</Badge>
                    <span className="text-[9px] text-[var(--foreground-subtle)]">+</span>
                    <Badge variant="destructive" className="text-[9px]">{alert.drug_b}</Badge>
                  </div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAcknowledge(alert.id)}
              className="w-full mt-2 text-[10px] h-6 border-[var(--border)]"
            >
              Acknowledge
            </Button>
          </motion.div>
        ))}

        {otherAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <p className="text-xs text-[var(--foreground-muted)] flex-1 truncate">{alert.title}</p>
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="text-[9px] text-amber-400 hover:text-amber-300 shrink-0"
              >
                OK
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {acknowledged.length > 0 && (
        <p className="text-[10px] text-[var(--foreground-subtle)] text-center pt-1">
          {acknowledged.length} alert(s) acknowledged
        </p>
      )}
    </div>
  );
}

// ─── Differential diagnosis panel ────────────────────────────────────────────

function DifferentialPanel({
  differentials,
  epiInfo,
}: {
  differentials: Differential[];
  epiInfo: { season: string; location: string; alert_note: string } | null;
}) {
  if (!differentials || differentials.length === 0) {
    return (
      <div className="flex items-center justify-center h-20">
        <p className="text-xs text-[var(--foreground-subtle)] italic">
          Differentials will appear after extraction
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {epiInfo && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/8 border border-blue-500/15 mb-3">
          <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
          <p className="text-[10px] text-blue-300">
            <span className="font-semibold capitalize">{epiInfo.season.replace("_", "-")}</span>
            {" "}weighted · {epiInfo.location}
          </p>
        </div>
      )}
      {differentials.map((d: Differential, i: number) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--foreground)] truncate">{d.condition}</span>
            <span className={cn("text-xs font-bold",
              d.probability >= 70 ? "text-green-400" :
                d.probability >= 40 ? "text-yellow-400" : "text-[var(--foreground-subtle)]"
            )}>
              {d.probability}%
            </span>
          </div>
          <Progress
            value={d.probability}
            className="h-1.5"
            indicatorClassName={
              d.probability >= 70 ? "bg-green-500" :
                d.probability >= 40 ? "bg-yellow-500" : "bg-slate-500"
            }
          />
          <p className="text-[10px] text-[var(--foreground-subtle)]">{d.reasoning}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface ActiveConsultationClientProps {
  consultationId?: string;
  patientName?: string;
}

export function ActiveConsultationClient({
  consultationId = "new",
  patientName = "Priya Sharma",
}: ActiveConsultationClientProps) {
  const {
    isRecording, isConnecting, transcript, interimText,
    detectedLanguage, wordCount, durationMs, segments, error,
    startRecording, stopRecording, resetTranscript,
  } = useMedicalScribe(consultationId);

  const { safety_alerts, differentials, emr_entry, audit_entries, acknowledgeAlert, setIsExtracting, addAuditEntry } = useConsultationStore();
  const extractionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSafetyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSafetyLengthRef = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [isFinalized, setIsFinalized] = useState(false);

  // Module 5: Offline / Rural mode sync
  const { isOnline, isSyncing, stats: offlineStats, syncNow, lastSyncAt } = useOfflineSync({
    consultationId,
    patientName,
    transcript,
    durationMs,
    autoSave: true,
    autoSync: true,
  });



  // Module 2: Gap analysis toasts
  const [gapToasts, setGapToasts] = useState<Array<{ id: string; message: string }>>([]);

  // Module 2: Epidemiology info
  const [epiInfo, setEpiInfo] = useState<{ season: string; location: string; alert_note: string } | null>(null);

  // Deduplication refs — prevent re-showing already-presented toasts/alerts
  const shownGapIds = useRef<Set<string>>(new Set());
  const shownAlertIds = useRef<Set<string>>(new Set());

  // Auto-dismiss gap toasts after 8s
  useEffect(() => {
    if (gapToasts.length === 0) return;
    const timers = gapToasts.map((t) =>
      setTimeout(() => {
        setGapToasts((prev) => prev.filter((g) => g.id !== t.id));
      }, 8000)
    );
    return () => timers.forEach(clearTimeout);
  }, [gapToasts]);

  // Run safety check after extraction
  const runSafetyCheck = useCallback(async (medications: Array<{ name: string }>) => {
    if (!medications || medications.length === 0) return;
    try {
      const res = await fetch("/api/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medications, consultationId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const newAlerts: SafetyAlert[] = (data.alerts ?? []).filter(
        (a: SafetyAlert) => !shownAlertIds.current.has(a.id)
      );
      if (newAlerts.length === 0) return;

      newAlerts.forEach((a) => shownAlertIds.current.add(a.id));

      // Add to store (sidebar will display them)
      newAlerts.forEach((a) => useConsultationStore.getState().addSafetyAlert(a));
    } catch {
      // Safety check failure is non-blocking
    }
  }, [consultationId]);

  // Use a ref for transcript so we don't constantly reset the setInterval in useEffect
  const transcriptRef = useRef(transcript);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Phase 6 Live Safety Guard: Stream transcript chunks to LLM
  const runLiveSafetyCheck = useCallback(async () => {
    const currentTranscript = transcriptRef.current;
    if (!currentTranscript) return;

    // Safety check acts on the delta to avoid re-evaluating the whole transcript
    const currentLength = currentTranscript.length;
    if (currentLength - lastSafetyLengthRef.current < 20) return; // not enough new talk

    const chunk = currentTranscript.slice(lastSafetyLengthRef.current);
    lastSafetyLengthRef.current = currentLength;

    try {
      const res = await fetch("/api/safety/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptChunk: chunk,
          // In a real app, this comes from the patient's record
          patientAllergies: ["Penicillin", "ACE Inhibitors", "Peanuts", "Aspirin"],
          chronicConditions: ["Asthma", "Hypertension"]
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newAlerts: SafetyAlert[] = (data.alerts ?? []).map((a: { drug: string; reason: string; severity: string }) => ({
          id: `live-alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          consultation_id: consultationId,
          alert_type: "contraindication",
          severity: a.severity as "critical" | "high" | "medium" | "low",
          title: `Potential Conflict: ${a.drug}`,
          description: a.reason,
          drug_a: a.drug,
          acknowledged: false,
          created_at: new Date().toISOString(),
        })).filter((a: SafetyAlert) => !shownAlertIds.current.has(a.id));

        if (newAlerts.length > 0) {
          newAlerts.forEach((a) => shownAlertIds.current.add(a.id));
          newAlerts.forEach((a) => useConsultationStore.getState().addSafetyAlert(a));
        }
      }
    } catch {
      // Non-blocking
    }
  }, [patientName, consultationId]);

  // Auto-extract every 15s when recording
  const runExtraction = useCallback(async () => {
    const currentTranscript = transcriptRef.current;
    if (!currentTranscript || currentTranscript.length < 50) return;

    setIsExtracting(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: currentTranscript, consultationId }),
      });
      if (res.ok) {
        const data = await res.json();
        useConsultationStore.getState().updateEMR(data.emr);
        useConsultationStore.getState().setDifferentials(data.differentials ?? []);

        // Store epidemiology info for display
        if (data.epidemiology) {
          setEpiInfo(data.epidemiology);
        }

        // Fire gap toasts for new prompts
        const gapPrompts: string[] = data.emr?.gap_prompts ?? [];
        const newGaps = gapPrompts.filter((msg) => {
          const key = msg.slice(0, 60);
          if (shownGapIds.current.has(key)) return false;
          shownGapIds.current.add(key);
          return true;
        });
        if (newGaps.length > 0) {
          setGapToasts((prev) => [
            ...prev,
            ...newGaps.map((msg, i) => ({
              id: `gap-${Date.now()}-${i}`,
              message: msg,
            })),
          ]);
        }

        // Run safety check against newly extracted medications
        if (data.emr?.medications?.length > 0) {
          await runSafetyCheck(data.emr.medications);
        }
      }
    } catch {
      // Extraction failed silently — will retry next interval
    } finally {
      setIsExtracting(false);
    }
  }, [consultationId, setIsExtracting, runSafetyCheck]);

  // We only run this effect when isRecording changes!
  useEffect(() => {
    if (isRecording) {
      extractionTimerRef.current = setInterval(runExtraction, 20000);
      liveSafetyTimerRef.current = setInterval(runLiveSafetyCheck, 8000); // Check for drug conflicts every 8s
    } else {
      if (extractionTimerRef.current) clearInterval(extractionTimerRef.current);
      if (liveSafetyTimerRef.current) clearInterval(liveSafetyTimerRef.current);

      // Trigger one final extraction when recording is stopped (if there's a transcript)
      if (transcriptRef.current && transcriptRef.current.length > 50) {
        runExtraction();
      }
    }
    return () => {
      if (extractionTimerRef.current) clearInterval(extractionTimerRef.current);
      if (liveSafetyTimerRef.current) clearInterval(liveSafetyTimerRef.current);
    };
  }, [isRecording, runExtraction, runLiveSafetyCheck]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/consultations/${consultationId}/emr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chief_complaint: emr_entry.chief_complaint ?? "",
          symptoms: emr_entry.symptoms ?? [],
          diagnosis: emr_entry.diagnosis ?? [],
          icd_codes: emr_entry.icd_codes ?? [],
          medications: emr_entry.medications ?? [],
          lab_tests_ordered: emr_entry.lab_tests_ordered ?? [],
          physical_examination: emr_entry.physical_examination ?? "",
          vitals: emr_entry.vitals ?? {},
          clinical_summary: emr_entry.clinical_summary ?? "",
          patient_summary: emr_entry.patient_summary ?? "",
          missing_fields: emr_entry.missing_fields ?? [],
          gap_prompts: emr_entry.gap_prompts ?? [],
        }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch { /* graceful degradation */ }
    setIsSaving(false);
  };

  const handleFinalize = async () => {
    // 1. Save EMR data
    try {
      await fetch(`/api/consultations/${consultationId}/emr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chief_complaint: emr_entry.chief_complaint ?? "",
          symptoms: emr_entry.symptoms ?? [],
          diagnosis: emr_entry.diagnosis ?? [],
          icd_codes: emr_entry.icd_codes ?? [],
          medications: emr_entry.medications ?? [],
          lab_tests_ordered: emr_entry.lab_tests_ordered ?? [],
          physical_examination: emr_entry.physical_examination ?? "",
          vitals: emr_entry.vitals ?? {},
          clinical_summary: emr_entry.clinical_summary ?? "",
          patient_summary: emr_entry.patient_summary ?? "",
          missing_fields: emr_entry.missing_fields ?? [],
          gap_prompts: emr_entry.gap_prompts ?? [],
        }),
      });
    } catch { /* non-blocking */ }

    // 2. Save prescriptions
    if (emr_entry.medications && emr_entry.medications.length > 0) {
      try {
        await fetch(`/api/consultations/${consultationId}/prescriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prescriptions: emr_entry.medications,
            doctor_id: "doctor-demo",
          }),
        });
      } catch { /* non-blocking */ }
    }

    // 3. Save billing draft
    const { billing_draft } = useConsultationStore.getState();
    if (billing_draft && (billing_draft.total ?? 0) > 0) {
      try {
        await fetch(`/api/consultations/${consultationId}/billing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(billing_draft),
        });
      } catch { /* non-blocking */ }
    }

    // 4. Update consultation status to completed
    try {
      await fetch("/api/consultations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: consultationId,
          status: "completed",
          ended_at: new Date().toISOString(),
          chief_complaint: emr_entry.chief_complaint ?? "",
        }),
      });
    } catch { /* non-blocking */ }

    // 5. Build audit chain entry for consultation end
    const prevHash = audit_entries.length > 0
      ? audit_entries[audit_entries.length - 1].hash
      : GENESIS_HASH;

    const payload = buildConsultationSummaryPayload({
      consultationId,
      patientName,
      diagnosis: emr_entry.icd_codes?.map((c) => c.description) ?? [],
      medications: emr_entry.medications ?? [],
      icdCodes: emr_entry.icd_codes ?? [],
      durationMs,
    });

    try {
      const entry = await buildAuditEntry({
        consultationId,
        eventType: "CONSULTATION_ENDED",
        actorId: "doctor-demo",
        actorRole: "doctor",
        payload,
        previousHash: prevHash,
      });

      addAuditEntry(entry);

      fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch(() => {/* graceful degradation */ });
    } catch {/* audit failure is non-blocking */ }

    // 6. Update queue status
    fetch("/api/queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultation_id: consultationId, status: "completed" }),
    }).catch(() => { });

    stopRecording();
    setIsFinalized(true);
  };



  const unacknowledgedCritical = safety_alerts.filter(
    (a) => !a.acknowledged && (a.severity === "critical" || a.severity === "high")
  ).length;

  return (
    <div className="flex flex-col h-full">


      {/* Gap Analysis Toast Stack */}
      <GapToastStack
        toasts={gapToasts}
        onDismiss={(id) => setGapToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* ─── Top bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--background-secondary)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
            <Stethoscope className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--foreground)]">{patientName}</h1>
            <p className="text-[10px] text-[var(--foreground-subtle)]">
              Active Consultation · {isRecording ? "Recording" : "Paused"}
              {isRecording && (
                <span className="ml-1.5 text-red-400 font-mono">{formatDurationStr(durationMs)}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Epidemiology badge */}
          {epiInfo && (
            <EpiSeasonBadge
              season={epiInfo.season}
              location={epiInfo.location}
              alertNote={epiInfo.alert_note}
            />
          )}

          {/* Rural Mode / Online indicator */}
          <RuralModeIndicator
            isOnline={isOnline}
            isSyncing={isSyncing}
            pendingCount={offlineStats.pending}
            lastSyncAt={lastSyncAt}
            onSyncNow={syncNow}
            variant="pill"
          />

          {unacknowledgedCritical > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="text-xs text-red-400 font-medium">{unacknowledgedCritical} Critical Alert{unacknowledgedCritical > 1 ? "s" : ""}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveStatus === "saved" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveStatus === "saved" ? "Saved!" : "Save Draft"}
          </Button>

          {!isFinalized ? (
            <Button size="sm" variant="success" className="gap-1.5" onClick={handleFinalize}>
              <Send className="w-3.5 h-3.5" />
              End & Finalize
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-[10px] py-1 px-2.5">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Finalized
              </Badge>
              <Button
                size="sm"
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  const { billing_draft, safety_alerts: alerts } = useConsultationStore.getState();
                  generateMedicalReport({
                    patientName,
                    consultationId,
                    doctorName: "Dr. Arjun Sharma",
                    durationMs,
                    chiefComplaint: emr_entry.chief_complaint,
                    symptoms: emr_entry.symptoms,
                    vitals: emr_entry.vitals as Record<string, string | number> | undefined,
                    physicalExamination: emr_entry.physical_examination,
                    diagnosis: emr_entry.diagnosis,
                    icdCodes: emr_entry.icd_codes,
                    medications: emr_entry.medications,
                    labTestsOrdered: emr_entry.lab_tests_ordered,
                    clinicalSummary: emr_entry.clinical_summary,
                    patientSummary: emr_entry.patient_summary,
                    safetyAlerts: alerts.map(a => ({ title: a.title, severity: a.severity, acknowledged: a.acknowledged })),
                    billing: billing_draft as { items: { description: string; fee: number }[]; subtotal: number; gst: number; total: number } | undefined,
                  });
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Report
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Rural Mode Banner (offline / pending sync) ──────── */}
      <RuralModeIndicator
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={offlineStats.pending}
        lastSyncAt={lastSyncAt}
        onSyncNow={syncNow}
        variant="banner"
      />

      {/* ─── Main 3-column layout ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Live Transcript */}
        <div className="w-[30%] border-r border-[var(--border)] p-4 overflow-hidden flex flex-col">
          <LiveTranscriptPanel
            isRecording={isRecording}
            isConnecting={isConnecting}
            segments={segments}
            interimText={interimText}
            detectedLanguage={detectedLanguage}
            wordCount={wordCount}
            durationMs={durationMs}
            error={error}
            onStart={startRecording}
            onStop={stopRecording}
            onReset={resetTranscript}
            className="flex-1"
          />
        </div>

        {/* Center: EMR Live Panel */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[var(--foreground-subtle)]" />
              <h2 className="text-xs font-semibold text-[var(--foreground)]">Live EMR Extraction</h2>
              <Badge variant="default" className="text-[9px] ml-auto">ABDM Compliant</Badge>
            </div>
            <EMRLivePanel />
          </div>

          {/* Patient Voice Consent */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Mic className="w-3.5 h-3.5 text-blue-400" />
                Patient Voice Consent
                <Badge className="ml-auto text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/25">
                  DISHA Compliant
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConsentRecorder consultationId={consultationId} />
            </CardContent>
          </Card>

          {/* Post-Visit XAI Patient Summary */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Patient-Friendly Summary
                <Badge className="ml-auto text-[9px] bg-violet-500/15 text-violet-400 border-violet-500/25">
                  XAI
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PatientSummaryPanel
                emr={emr_entry}
                patientName={patientName}
                consultationId={consultationId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Safety + Differentials */}
        <div className="w-[28%] border-l border-[var(--border)] p-4 overflow-y-auto space-y-4">
          {/* Safety alerts */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                Safety Guard
                {safety_alerts.filter(a => !a.acknowledged).length > 0 && (
                  <Badge variant="destructive" className="ml-auto text-[9px]">
                    {safety_alerts.filter(a => !a.acknowledged).length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SafetyAlertSidebar
                alerts={safety_alerts}
                onAcknowledge={acknowledgeAlert}
              />
            </CardContent>
          </Card>

          {/* Differential diagnosis */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                Differentials
                <Badge variant="secondary" className="ml-auto text-[9px]">
                  {epiInfo ? `${epiInfo.season.replace("_", "-")} AI` : "AI"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DifferentialPanel differentials={differentials} epiInfo={epiInfo} />
            </CardContent>
          </Card>

          {/* Live Billing */}
          <LiveBillingPanel durationMs={durationMs} transcript={transcript} />

          {/* Jan Aushadhi drug cost comparison */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Pill className="w-3.5 h-3.5 text-green-400" />
                Jan Aushadhi Pricing
                <Badge className="ml-auto text-[9px] bg-green-500/15 text-green-400 border-green-500/25">
                  Save ₹
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DrugCostPanel medications={emr_entry.medications ?? []} />
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Audit Trail
                {audit_entries.length > 0 && (
                  <Badge className="ml-auto text-[9px] bg-indigo-500/15 text-indigo-400 border-indigo-500/25">
                    {audit_entries.length} events
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTrailPanel entries={audit_entries} consultationId={consultationId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
