"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Search, Filter, FileText, Calendar, Clock,
  User, Stethoscope, Pill, FlaskConical, Activity, ChevronRight,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Download,
  Printer, Eye, X, Heart, Thermometer, Droplets, Wind
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, getInitials } from "@/lib/utils";

// ─── Comprehensive EMR Mock Data ─────────────────────────────────────────────

const MOCK_EMR_RECORDS = [
  {
    id: "emr-001",
    consultation_id: "c-001",
    patient_name: "Priya Sharma",
    patient_age: 45,
    patient_gender: "F",
    patient_id: "p-001",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-24",
    consultation_type: "followup" as const,
    status: "completed" as const,
    chief_complaint: "Uncontrolled blood sugar levels, fatigue, increased thirst",
    vitals: {
      bp_systolic: 148, bp_diastolic: 92,
      heart_rate: 88, temperature: 98.4,
      spo2: 97, weight: 72, height: 162,
      respiratory_rate: 18,
    },
    symptoms: ["Polyuria", "Polydipsia", "Fatigue", "Blurred vision", "Tingling in feet"],
    diagnosis: ["Uncontrolled Type 2 Diabetes Mellitus", "Essential Hypertension - Stage 2"],
    icd_codes: [
      { code: "E11.65", description: "Type 2 DM with hyperglycemia", confidence: 95 },
      { code: "I10", description: "Essential hypertension", confidence: 92 },
      { code: "E11.40", description: "Type 2 DM with diabetic neuropathy", confidence: 78 },
    ],
    medications: [
      { name: "Metformin", dosage: "1000mg", frequency: "Twice daily", duration: "Ongoing", route: "Oral" },
      { name: "Glimepiride", dosage: "2mg", frequency: "Once daily (morning)", duration: "Ongoing", route: "Oral" },
      { name: "Telmisartan", dosage: "40mg", frequency: "Once daily", duration: "Ongoing", route: "Oral" },
      { name: "Atorvastatin", dosage: "10mg", frequency: "Once daily (night)", duration: "3 months", route: "Oral" },
    ],
    lab_tests_ordered: ["HbA1c", "Fasting lipid profile", "Serum creatinine", "Urine microalbumin", "Fundoscopy"],
    physical_examination: "General: Conscious, oriented. Obese (BMI 27.4). Skin: Acanthosis nigricans on neck. CVS: S1S2 normal, no murmur. RS: Bilateral clear. Abdomen: Soft, non-tender. CNS: Decreased sensation in bilateral feet (monofilament test). Pedal pulses: Present bilaterally.",
    clinical_summary: "45F with uncontrolled T2DM (last HbA1c 9.2%) and Stage 2 HTN. Started on dual OHA + statin. Suspected early diabetic peripheral neuropathy — monofilament test abnormal. Advised strict diet, exercise, and foot care. Review in 4 weeks with labs.",
    gap_prompts: [],
    missing_fields: [],
  },
  {
    id: "emr-002",
    consultation_id: "c-002",
    patient_name: "Ramesh Patel",
    patient_age: 62,
    patient_gender: "M",
    patient_id: "p-002",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-24",
    consultation_type: "general" as const,
    status: "completed" as const,
    chief_complaint: "Chest pain on exertion, breathlessness on climbing stairs",
    vitals: {
      bp_systolic: 138, bp_diastolic: 88,
      heart_rate: 96, temperature: 98.2,
      spo2: 94, weight: 78, height: 170,
      respiratory_rate: 22,
    },
    symptoms: ["Exertional chest pain", "Dyspnea on exertion", "Orthopnea", "Ankle swelling (bilateral)"],
    diagnosis: ["Acute exacerbation of chronic stable angina", "Bilateral pedal edema — R/O decompensated CHF"],
    icd_codes: [
      { code: "I20.9", description: "Angina pectoris, unspecified", confidence: 88 },
      { code: "I50.9", description: "Heart failure, unspecified", confidence: 72 },
      { code: "E78.5", description: "Hyperlipidemia, unspecified", confidence: 85 },
    ],
    medications: [
      { name: "Isosorbide Mononitrate", dosage: "20mg", frequency: "Twice daily", duration: "Ongoing", route: "Oral" },
      { name: "Aspirin", dosage: "75mg", frequency: "Once daily", duration: "Ongoing", route: "Oral" },
      { name: "Atorvastatin", dosage: "40mg", frequency: "Once daily (night)", duration: "Ongoing", route: "Oral" },
      { name: "Furosemide", dosage: "40mg", frequency: "Once daily (morning)", duration: "2 weeks", route: "Oral" },
      { name: "Metoprolol", dosage: "25mg", frequency: "Twice daily", duration: "Ongoing", route: "Oral" },
    ],
    lab_tests_ordered: ["2D Echo", "Troponin I", "BNP", "ECG", "Lipid profile", "Renal function test"],
    physical_examination: "General: Anxious, mild respiratory distress at rest. CVS: S1S2 present, S3 gallop heard, no murmur. JVP raised (6cm). RS: Bilateral basal crepitations. Abdomen: Soft, tender hepatomegaly (2cm BCM). Extremities: Bilateral pitting pedal edema (grade 2).",
    clinical_summary: "62M known case of CAD presenting with worsening angina and features suggestive of early CHF. S3 gallop + raised JVP + basal crepitations. Started diuretic. 2D Echo and cardiac enzymes ordered urgently. If troponin positive, cardiology referral for catheterization.",
    gap_prompts: ["Consider NT-proBNP for heart failure staging"],
    missing_fields: [],
  },
  {
    id: "emr-003",
    consultation_id: "c-003",
    patient_name: "Anita Verma",
    patient_age: 34,
    patient_gender: "F",
    patient_id: "p-003",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-18",
    consultation_type: "general" as const,
    status: "completed" as const,
    chief_complaint: "Fever, body ache, and headache for 3 days",
    vitals: {
      bp_systolic: 118, bp_diastolic: 76,
      heart_rate: 102, temperature: 101.8,
      spo2: 98, weight: 58, height: 158,
      respiratory_rate: 20,
    },
    symptoms: ["High-grade fever with chills", "Myalgia", "Frontal headache", "Nausea", "Loss of appetite"],
    diagnosis: ["Acute febrile illness — likely viral", "R/O Dengue fever"],
    icd_codes: [
      { code: "R50.9", description: "Fever, unspecified", confidence: 96 },
      { code: "A90", description: "Dengue fever (classical dengue)", confidence: 65 },
      { code: "M79.10", description: "Myalgia, unspecified", confidence: 82 },
    ],
    medications: [
      { name: "Paracetamol", dosage: "650mg", frequency: "Three times daily (SOS)", duration: "5 days", route: "Oral" },
      { name: "Ondansetron", dosage: "4mg", frequency: "Twice daily", duration: "3 days", route: "Oral" },
      { name: "ORS", dosage: "1 packet", frequency: "Three times daily", duration: "5 days", route: "Oral" },
    ],
    lab_tests_ordered: ["CBC", "Dengue NS1 + IgM", "Peripheral smear for malaria", "Urine routine"],
    physical_examination: "General: Febrile (101.8°F), flushed. No rash. No hemorrhagic manifestations. HEENT: Pharynx mildly congested. CVS: Tachycardia, no murmur. RS: Clear. Abdomen: Soft, no hepatosplenomegaly. No lymphadenopathy.",
    clinical_summary: "34F with acute febrile illness Day 3. Clinically appears viral — differentials include dengue, chikungunya. No warning signs currently. CBC and dengue serology sent. Advised adequate hydration, monitoring for red flags. Review with reports in 48 hrs.",
    gap_prompts: [],
    missing_fields: [],
  },
  {
    id: "emr-004",
    consultation_id: "c-004",
    patient_name: "Suresh Kumar",
    patient_age: 55,
    patient_gender: "M",
    patient_id: "p-004",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-22",
    consultation_type: "followup" as const,
    status: "completed" as const,
    chief_complaint: "BP review, medication adjustment needed",
    vitals: {
      bp_systolic: 156, bp_diastolic: 98,
      heart_rate: 76, temperature: 98.6,
      spo2: 96, weight: 85, height: 175,
      respiratory_rate: 16,
    },
    symptoms: ["Occasional headache", "Morning dizziness", "Fatigue"],
    diagnosis: ["Resistant hypertension", "Chronic Kidney Disease Stage 3a"],
    icd_codes: [
      { code: "I10", description: "Essential hypertension", confidence: 98 },
      { code: "N18.31", description: "CKD Stage 3a", confidence: 90 },
    ],
    medications: [
      { name: "Amlodipine", dosage: "10mg", frequency: "Once daily", duration: "Ongoing", route: "Oral" },
      { name: "Losartan", dosage: "50mg", frequency: "Twice daily", duration: "Ongoing", route: "Oral" },
      { name: "Chlorthalidone", dosage: "12.5mg", frequency: "Once daily (morning)", duration: "Ongoing", route: "Oral" },
    ],
    lab_tests_ordered: ["Serum creatinine", "Electrolytes", "24hr urine protein", "Renal Doppler USG"],
    physical_examination: "General: Well-built, obese (BMI 27.8). CVS: S1S2 normal, no murmur. Loud A2. RS: Clear. Abdomen: Soft, no organomegaly. Fundoscopy: Grade 2 hypertensive retinopathy.",
    clinical_summary: "55M with resistant HTN (BP 156/98 on triple therapy) and CKD3a (last eGFR 48). Added chlorthalidone. Renal Doppler ordered to R/O renal artery stenosis. 24hr urine protein to assess proteinuria. Review in 2 weeks with labs. Salt restriction reinforced.",
    gap_prompts: ["Consider spironolactone if BP not controlled on 3 drugs"],
    missing_fields: [],
  },
  {
    id: "emr-005",
    consultation_id: "c-005",
    patient_name: "Meera Singh",
    patient_age: 28,
    patient_gender: "F",
    patient_id: "p-005",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-15",
    consultation_type: "general" as const,
    status: "completed" as const,
    chief_complaint: "Rash on arms and neck with itching for 1 week",
    vitals: {
      bp_systolic: 110, bp_diastolic: 70,
      heart_rate: 74, temperature: 98.4,
      spo2: 99, weight: 54, height: 160,
      respiratory_rate: 16,
    },
    symptoms: ["Erythematous papular rash", "Pruritus", "Worse after sun exposure", "No systemic symptoms"],
    diagnosis: ["Allergic contact dermatitis", "Photosensitive dermatitis"],
    icd_codes: [
      { code: "L23.9", description: "Allergic contact dermatitis, unspecified", confidence: 82 },
      { code: "L56.0", description: "Drug phototoxic response", confidence: 45 },
    ],
    medications: [
      { name: "Cetirizine", dosage: "10mg", frequency: "Once daily (night)", duration: "10 days", route: "Oral" },
      { name: "Mometasone cream", dosage: "0.1%", frequency: "Twice daily", duration: "7 days", route: "Topical" },
      { name: "Calamine lotion", dosage: "As needed", frequency: "Three times daily", duration: "7 days", route: "Topical" },
    ],
    lab_tests_ordered: ["IgE levels", "Allergy panel (if not improving)"],
    physical_examination: "Skin: Erythematous, papular rash over bilateral forearms, dorsum of hands, and V of neck. Sparing of covered areas. No vesicles. No Nikolsky sign. No oral lesions. Distribution suggests photosensitive pattern.",
    clinical_summary: "28F with photodistributed dermatitis. Likely contact/photosensitive dermatitis. No drug history to suggest drug phototoxicity. Topical steroids + antihistamine started. Advised sun protection. If not responding in 1 week, dermatology referral for patch testing.",
    gap_prompts: [],
    missing_fields: [],
  },
  {
    id: "emr-006",
    consultation_id: "c-006",
    patient_name: "Vikram Malhotra",
    patient_age: 71,
    patient_gender: "M",
    patient_id: "p-006",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-25",
    consultation_type: "followup" as const,
    status: "in-review" as const,
    chief_complaint: "Increased breathlessness and productive cough for 5 days",
    vitals: {
      bp_systolic: 142, bp_diastolic: 86,
      heart_rate: 108, temperature: 100.2,
      spo2: 89, weight: 68, height: 168,
      respiratory_rate: 28,
    },
    symptoms: ["Worsening dyspnea", "Productive cough (yellowish sputum)", "Wheezing", "Difficulty sleeping flat", "Irregular heartbeat awareness"],
    diagnosis: ["Acute exacerbation of COPD (AECOPD)", "Atrial fibrillation with rapid ventricular rate", "Poorly controlled T2DM"],
    icd_codes: [
      { code: "J44.1", description: "COPD with acute exacerbation", confidence: 94 },
      { code: "I48.91", description: "Unspecified atrial fibrillation", confidence: 88 },
      { code: "E11.65", description: "Type 2 DM with hyperglycemia", confidence: 85 },
    ],
    medications: [
      { name: "Salbutamol nebulization", dosage: "5mg", frequency: "Every 4 hours", duration: "3 days", route: "Nebulization" },
      { name: "Ipratropium nebulization", dosage: "500mcg", frequency: "Every 6 hours", duration: "3 days", route: "Nebulization" },
      { name: "Prednisolone", dosage: "40mg", frequency: "Once daily", duration: "5 days", route: "Oral" },
      { name: "Azithromycin", dosage: "500mg", frequency: "Once daily", duration: "5 days", route: "Oral" },
      { name: "Digoxin", dosage: "0.25mg", frequency: "Once daily", duration: "Ongoing", route: "Oral" },
      { name: "Insulin Glargine", dosage: "18 units", frequency: "Once daily (bedtime)", duration: "Ongoing", route: "Subcutaneous" },
    ],
    lab_tests_ordered: ["ABG", "CBC", "Sputum culture", "CRP", "ECG", "Chest X-ray", "HbA1c", "Digoxin level"],
    physical_examination: "General: Distressed, using accessory muscles. Cyanosis of lips. CVS: Irregularly irregular rhythm, rate 108/min. RS: Bilateral diffuse rhonchi + scattered crepitations. Air entry reduced bilaterally. Abdomen: No ascites, no hepatomegaly. Extremities: No edema.",
    clinical_summary: "71M with COPD + AF + T2DM presenting with AECOPD (Anthonisen Type 1 — increased dyspnea + sputum purulence + sputum volume). SpO2 89% on room air. Started nebulization + systemic steroids + antibiotic. AF with RVR — digoxin added. Sugar uncontrolled on OHA — switched to basal insulin. Consider ICU if no improvement in 6 hrs.",
    gap_prompts: ["ABG result needed for severity assessment", "Assess need for NIV", "Digoxin level at 48h"],
    missing_fields: ["ABG results pending"],
  },
];

type EMRRecord = typeof MOCK_EMR_RECORDS[0];

// ─── Status & consultation type config ────────────────────────────────────────

const STATUS_CONFIG = {
  completed: { label: "Completed", variant: "success" as const, icon: CheckCircle2 },
  "in-review": { label: "In Review", variant: "warning" as const, icon: Clock },
  draft: { label: "Draft", variant: "secondary" as const, icon: FileText },
};

const TYPE_CONFIG = {
  general: { label: "General", color: "text-blue-400 bg-blue-500/10" },
  followup: { label: "Follow-up", color: "text-purple-400 bg-purple-500/10" },
  emergency: { label: "Emergency", color: "text-red-400 bg-red-500/10" },
};

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { label: "Total Records", value: MOCK_EMR_RECORDS.length.toString(), icon: ClipboardList, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "This Week", value: MOCK_EMR_RECORDS.filter(r => new Date(r.date) > new Date("2026-02-19")).length.toString(), icon: Calendar, color: "text-green-400", bg: "bg-green-500/10" },
  { label: "Pending Review", value: MOCK_EMR_RECORDS.filter(r => r.status === "in-review").length.toString(), icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
  { label: "ICD Codes Mapped", value: MOCK_EMR_RECORDS.reduce((sum, r) => sum + r.icd_codes.length, 0).toString(), icon: Activity, color: "text-purple-400", bg: "bg-purple-500/10" },
];

// ─── EMR Detail View ──────────────────────────────────────────────────────────

function EMRDetail({ record, onClose }: { record: EMRRecord; onClose: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["vitals", "diagnosis", "medications", "summary"]));

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const statusCfg = STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.completed;
  const typeCfg = TYPE_CONFIG[record.consultation_type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.general;
  const StatusIcon = statusCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ x: 600 }}
        animate={{ x: 0 }}
        exit={{ x: 600 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-2xl bg-[var(--background)] border-l border-[var(--border)] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--border)] px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={statusCfg.variant} className="gap-1">
                  <StatusIcon className="w-3 h-3" />
                  {statusCfg.label}
                </Badge>
                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium", typeCfg.color)}>{typeCfg.label}</span>
                <span className="text-[10px] text-[var(--foreground-subtle)] font-mono">{record.id.toUpperCase()}</span>
              </div>
              <h2 className="text-base font-bold text-[var(--foreground)]">{record.patient_name}</h2>
              <p className="text-xs text-[var(--foreground-muted)]">
                {record.patient_age}{record.patient_gender} · {formatDate(record.date)} · {record.doctor_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Printer className="w-3 h-3" /> Print
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Download className="w-3 h-3" /> PDF
              </Button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--foreground-subtle)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Chief Complaint */}
          <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
            <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold mb-1">Chief Complaint</p>
            <p className="text-sm text-[var(--foreground)]">{record.chief_complaint}</p>
          </div>

          {/* Vitals */}
          <CollapsibleSection
            title="Vitals"
            icon={<Heart className="w-3.5 h-3.5 text-red-400" />}
            isOpen={expandedSections.has("vitals")}
            onToggle={() => toggleSection("vitals")}
          >
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "BP", value: `${record.vitals.bp_systolic}/${record.vitals.bp_diastolic}`, unit: "mmHg", icon: Activity, alert: record.vitals.bp_systolic > 140 },
                { label: "Heart Rate", value: record.vitals.heart_rate.toString(), unit: "bpm", icon: Heart, alert: record.vitals.heart_rate > 100 },
                { label: "Temp", value: record.vitals.temperature.toString(), unit: "°F", icon: Thermometer, alert: record.vitals.temperature > 100 },
                { label: "SpO₂", value: record.vitals.spo2.toString(), unit: "%", icon: Droplets, alert: record.vitals.spo2 < 94 },
                { label: "Weight", value: record.vitals.weight.toString(), unit: "kg", icon: User, alert: false },
                { label: "Height", value: record.vitals.height.toString(), unit: "cm", icon: User, alert: false },
                { label: "RR", value: record.vitals.respiratory_rate.toString(), unit: "/min", icon: Wind, alert: record.vitals.respiratory_rate > 24 },
                { label: "BMI", value: (record.vitals.weight / ((record.vitals.height / 100) ** 2)).toFixed(1), unit: "kg/m²", icon: Activity, alert: false },
              ].map((v) => {
                const Icon = v.icon;
                return (
                  <div key={v.label} className={cn(
                    "p-2 rounded-lg border text-center",
                    v.alert ? "border-red-500/30 bg-red-500/5" : "border-[var(--border)] bg-[var(--surface)]"
                  )}>
                    <p className="text-[9px] text-[var(--foreground-subtle)] flex items-center justify-center gap-1">
                      <Icon className="w-2.5 h-2.5" /> {v.label}
                    </p>
                    <p className={cn("text-sm font-bold mt-0.5", v.alert ? "text-red-400" : "text-[var(--foreground)]")}>{v.value}</p>
                    <p className="text-[9px] text-[var(--foreground-subtle)]">{v.unit}</p>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Symptoms */}
          <CollapsibleSection
            title={`Symptoms (${record.symptoms.length})`}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
            isOpen={expandedSections.has("symptoms")}
            onToggle={() => toggleSection("symptoms")}
          >
            <div className="flex flex-wrap gap-1.5">
              {record.symptoms.map((s) => (
                <Badge key={s} variant="warning" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </CollapsibleSection>

          {/* Diagnosis + ICD Codes */}
          <CollapsibleSection
            title="Diagnosis & ICD Codes"
            icon={<Stethoscope className="w-3.5 h-3.5 text-blue-400" />}
            isOpen={expandedSections.has("diagnosis")}
            onToggle={() => toggleSection("diagnosis")}
          >
            <div className="space-y-2">
              {record.diagnosis.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-blue-400">{i + 1}</span>
                  </div>
                  <p className="text-sm text-[var(--foreground)]">{d}</p>
                </div>
              ))}
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold">ICD-10 Codes</p>
                {record.icd_codes.map((code) => (
                  <div key={code.code} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{code.code}</Badge>
                      <span className="text-xs text-[var(--foreground-muted)]">{code.description}</span>
                    </div>
                    <Badge variant={code.confidence >= 90 ? "success" : code.confidence >= 70 ? "warning" : "secondary"} className="text-[9px]">
                      {code.confidence}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* Medications */}
          <CollapsibleSection
            title={`Medications (${record.medications.length})`}
            icon={<Pill className="w-3.5 h-3.5 text-green-400" />}
            isOpen={expandedSections.has("medications")}
            onToggle={() => toggleSection("medications")}
          >
            <div className="space-y-2">
              {record.medications.map((med, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <Pill className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">{med.name} <span className="text-[var(--foreground-muted)]">— {med.dosage}</span></p>
                    <p className="text-xs text-[var(--foreground-muted)]">{med.frequency} · {med.duration} · {med.route}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Lab Tests */}
          <CollapsibleSection
            title={`Lab Tests Ordered (${record.lab_tests_ordered.length})`}
            icon={<FlaskConical className="w-3.5 h-3.5 text-purple-400" />}
            isOpen={expandedSections.has("labs")}
            onToggle={() => toggleSection("labs")}
          >
            <div className="flex flex-wrap gap-1.5">
              {record.lab_tests_ordered.map((t) => (
                <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          </CollapsibleSection>

          {/* Physical Examination */}
          <CollapsibleSection
            title="Physical Examination"
            icon={<Stethoscope className="w-3.5 h-3.5 text-teal-400" />}
            isOpen={expandedSections.has("pe")}
            onToggle={() => toggleSection("pe")}
          >
            <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{record.physical_examination}</p>
          </CollapsibleSection>

          {/* Clinical Summary */}
          <CollapsibleSection
            title="Clinical Summary"
            icon={<FileText className="w-3.5 h-3.5 text-cyan-400" />}
            isOpen={expandedSections.has("summary")}
            onToggle={() => toggleSection("summary")}
          >
            <div className="p-3 rounded-xl bg-cyan-500/8 border border-cyan-500/20">
              <p className="text-sm text-[var(--foreground)] leading-relaxed">{record.clinical_summary}</p>
            </div>
          </CollapsibleSection>

          {/* Gap Prompts / Missing Fields */}
          {(record.gap_prompts.length > 0 || record.missing_fields.length > 0) && (
            <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> AI Suggestions
              </p>
              <ul className="space-y-1">
                {[...record.gap_prompts, ...record.missing_fields].map((g, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-amber-300">
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, isOpen, onToggle, children }: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--surface-elevated)] transition-colors"
      >
        {icon}
        <span className="text-xs font-semibold text-[var(--foreground)] flex-1 text-left">{title}</span>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EMR Row ──────────────────────────────────────────────────────────────────

function EMRRow({ record, index, onClick }: { record: EMRRecord; index: number; onClick: () => void }) {
  const statusCfg = STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.completed;
  const typeCfg = TYPE_CONFIG[record.consultation_type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.general;
  const StatusIcon = statusCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="flex items-center gap-4 p-3.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-all cursor-pointer group"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
        {getInitials(record.patient_name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">{record.patient_name}</p>
          <span className="text-[10px] text-[var(--foreground-subtle)]">{record.patient_age}{record.patient_gender}</span>
          <Badge variant={statusCfg.variant} className="text-[9px] py-0 px-1.5 h-3.5 gap-0.5">
            <StatusIcon className="w-2.5 h-2.5" /> {statusCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-[var(--foreground-muted)] truncate mt-0.5">{record.chief_complaint}</p>
      </div>

      {/* Type */}
      <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0", typeCfg.color)}>
        {typeCfg.label}
      </span>

      {/* Dx count */}
      <div className="text-center shrink-0">
        <p className="text-[10px] text-[var(--foreground-subtle)]">Diagnoses</p>
        <p className="text-xs font-bold text-[var(--foreground)]">{record.diagnosis.length}</p>
      </div>

      {/* Meds count */}
      <div className="text-center shrink-0">
        <p className="text-[10px] text-[var(--foreground-subtle)]">Meds</p>
        <p className="text-xs font-bold text-[var(--foreground)]">{record.medications.length}</p>
      </div>

      {/* Date */}
      <div className="text-right shrink-0">
        <p className="text-xs font-medium text-[var(--foreground-muted)]">{formatDate(record.date)}</p>
        <p className="text-[10px] text-[var(--foreground-subtle)]">{record.doctor_name}</p>
      </div>

      <ChevronRight className="w-4 h-4 text-[var(--foreground-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EMRRecordsClientProps {
  user: { id: string; name: string; email: string; role: string };
}

export function EMRRecordsClient({ user }: EMRRecordsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in-review" | "draft">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "general" | "followup" | "emergency">("all");
  const [selectedRecord, setSelectedRecord] = useState<EMRRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return MOCK_EMR_RECORDS.filter((r) => {
      const matchesSearch =
        r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.chief_complaint.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.diagnosis.some(d => d.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.icd_codes.some(c => c.code.toLowerCase().includes(searchQuery.toLowerCase()) || c.description.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.consultation_type !== typeFilter) return false;
      return true;
    });
  }, [searchQuery, statusFilter, typeFilter]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            EMR Records
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
            {MOCK_EMR_RECORDS.length} records · FHIR-compliant electronic medical records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Export All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-[var(--border)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--foreground-subtle)]">{stat.label}</p>
                      <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{stat.value}</p>
                    </div>
                    <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", stat.bg)}>
                      <Icon className={cn("w-4 h-4", stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient, complaint, diagnosis, or ICD code..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 rounded-lg text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] focus:outline-none cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="in-review">In Review</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-2 rounded-lg text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] focus:outline-none cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="general">General</option>
          <option value="followup">Follow-up</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>

      {/* Records List */}
      <div className="space-y-2">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--foreground-subtle)]">
            <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No records match your search</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filteredRecords.map((record, i) => (
            <EMRRow
              key={record.id}
              record={record}
              index={i}
              onClick={() => setSelectedRecord(record)}
            />
          ))
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedRecord && (
          <EMRDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
