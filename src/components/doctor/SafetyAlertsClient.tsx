"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldAlert, AlertTriangle, CheckCircle2, X, ChevronRight,
  Search, Filter, Clock, Pill, Activity, User, FileText,
  XCircle, ChevronDown, ChevronUp, Eye, Bell, BellOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { SafetyAlert, AlertSeverity, AlertType } from "@/lib/types";

// ─── Comprehensive Mock Safety Alerts ─────────────────────────────────────────

const MOCK_ALERTS: (SafetyAlert & { patient_name: string; patient_id: string })[] = [
  {
    id: "sa-001",
    consultation_id: "c-002",
    alert_type: "drug_interaction",
    severity: "critical",
    title: "Warfarin + Aspirin — Major Bleeding Risk",
    description: "Concurrent use of Warfarin (anticoagulant) with Aspirin (antiplatelet) significantly increases the risk of gastrointestinal and intracranial hemorrhage. INR may become supratherapeutic. The combination multiplies bleeding risk by 2-3x compared to either agent alone.",
    drug_a: "Warfarin",
    drug_b: "Aspirin 75mg",
    mechanism: "Aspirin inhibits platelet aggregation via COX-1 blockade, while Warfarin inhibits Vitamin K-dependent clotting factors. Dual blockade of both primary and secondary hemostasis creates synergistic bleeding risk.",
    alternatives: ["Clopidogrel 75mg (if antiplatelet needed)", "Reduce Aspirin to 50mg with PPI cover", "Use direct oral anticoagulant (Apixaban) instead of Warfarin"],
    acknowledged: false,
    created_at: "2026-02-26T09:15:00Z",
    patient_name: "Ramesh Patel",
    patient_id: "p-002",
  },
  {
    id: "sa-002",
    consultation_id: "c-001",
    alert_type: "allergy",
    severity: "high",
    title: "Penicillin Allergy — Amoxicillin Prescribed",
    description: "Patient has a documented Penicillin allergy (anaphylaxis history). Amoxicillin is a penicillin-class antibiotic and is ABSOLUTELY CONTRAINDICATED. Cross-reactivity rate is nearly 100%.",
    drug_a: "Amoxicillin",
    drug_b: "Penicillin (allergy)",
    mechanism: "Amoxicillin shares the beta-lactam ring structure with penicillin. Patients with true IgE-mediated penicillin allergy have near-certain cross-reactivity with aminopenicillins.",
    alternatives: ["Azithromycin 500mg (macrolide — no cross-reactivity)", "Doxycycline 100mg (tetracycline class)", "Levofloxacin 500mg (fluoroquinolone — use with caution)"],
    acknowledged: false,
    created_at: "2026-02-26T09:22:00Z",
    patient_name: "Priya Sharma",
    patient_id: "p-001",
  },
  {
    id: "sa-003",
    consultation_id: "c-004",
    alert_type: "contraindication",
    severity: "medium",
    title: "Metformin + Contrast Dye — Renal Risk",
    description: "Patient is scheduled for CT with IV contrast. Metformin should be held 48 hours before and after contrast administration in patients with eGFR < 60 to prevent contrast-induced nephropathy and lactic acidosis.",
    drug_a: "Metformin 1000mg",
    drug_b: "IV Contrast (Iodinated)",
    mechanism: "Iodinated contrast can cause acute kidney injury. In the presence of renal impairment, Metformin accumulates due to reduced renal clearance, leading to life-threatening lactic acidosis.",
    alternatives: ["Hold Metformin 48h pre/post contrast", "Switch to Glimepiride temporarily", "Use non-contrast MRI if feasible", "Ensure adequate pre-hydration with NS"],
    acknowledged: false,
    created_at: "2026-02-26T10:05:00Z",
    patient_name: "Suresh Kumar",
    patient_id: "p-004",
  },
  {
    id: "sa-004",
    consultation_id: "c-006",
    alert_type: "drug_interaction",
    severity: "high",
    title: "Digoxin + Azithromycin — Digoxin Toxicity Risk",
    description: "Macrolide antibiotics like Azithromycin can increase Digoxin levels by reducing gut flora that normally inactivate Digoxin, and by inhibiting P-glycoprotein transport. Risk of fatal arrhythmia.",
    drug_a: "Digoxin 0.25mg",
    drug_b: "Azithromycin 500mg",
    mechanism: "Azithromycin inhibits P-glycoprotein (intestinal efflux pump), increasing Digoxin absorption by ~20-40%. Also reduces colonic bacteria (Eubacterium lentum) that inactivate Digoxin. Elderly patients have reduced renal clearance, amplifying the effect.",
    alternatives: ["Use Amoxicillin/Clavulanate instead (if no allergy)", "Reduce Digoxin to 0.125mg during Azithromycin course", "Monitor Digoxin levels at 48h and 96h", "Use Doxycycline as alternative antibiotic"],
    acknowledged: false,
    created_at: "2026-02-26T10:30:00Z",
    patient_name: "Vikram Malhotra",
    patient_id: "p-006",
  },
  {
    id: "sa-005",
    consultation_id: "c-006",
    alert_type: "dosage",
    severity: "medium",
    title: "Prednisolone 40mg in Uncontrolled Diabetic",
    description: "High-dose systemic corticosteroids will significantly worsen glycemic control. Blood sugars may rise 150-300 mg/dL over baseline. HbA1c already 9.2% — requires proactive insulin adjustment.",
    drug_a: "Prednisolone 40mg",
    drug_b: "Insulin Glargine 18U",
    mechanism: "Corticosteroids cause hepatic gluconeogenesis, peripheral insulin resistance, and impaired pancreatic beta-cell function. Effect is dose-dependent and most pronounced 4-8 hours post-dose.",
    alternatives: ["Increase Insulin Glargine to 24-28 units during steroid course", "Add short-acting insulin (Actrapid) for postprandial spikes", "Monitor CBG 4 times daily", "Consider nebulized Budesonide instead of systemic steroid if mild exacerbation"],
    acknowledged: false,
    created_at: "2026-02-26T10:35:00Z",
    patient_name: "Vikram Malhotra",
    patient_id: "p-006",
  },
  {
    id: "sa-006",
    consultation_id: "c-004",
    alert_type: "drug_interaction",
    severity: "low",
    title: "Losartan + Chlorthalidone — Monitor Potassium",
    description: "ARBs (Losartan) tend to raise potassium, while thiazide diuretics (Chlorthalidone) lower it. Usually the effects balance out, but in CKD patients, hyperkalemia risk persists. Monitoring recommended.",
    drug_a: "Losartan 50mg",
    drug_b: "Chlorthalidone 12.5mg",
    mechanism: "Losartan blocks aldosterone secretion (RAAS), reducing potassium excretion. Chlorthalidone increases potassium excretion via distal tubule. In CKD, reduced GFR impairs potassium excretion regardless of drug effects.",
    alternatives: ["Check serum potassium at 1 week and monthly", "Avoid potassium-rich diet supplements", "Consider switching to Amlodipine + Chlorthalidone if K+ > 5.5"],
    acknowledged: true,
    acknowledged_by: "Dr. Arun Mehta",
    override_reason: "Acknowledged — will monitor K+ levels weekly. Patient counseled on potassium-rich foods.",
    created_at: "2026-02-25T14:20:00Z",
    patient_name: "Suresh Kumar",
    patient_id: "p-004",
  },
  {
    id: "sa-007",
    consultation_id: "c-002",
    alert_type: "dosage",
    severity: "low",
    title: "Furosemide — Electrolyte Monitoring Reminder",
    description: "Furosemide can cause hypokalemia, hyponatremia, and hypomagnesemia. Basic metabolic panel should be checked within 3-7 days of initiation, especially in elderly patients on digoxin.",
    drug_a: "Furosemide 40mg",
    alternatives: ["Order BMP at 72 hours", "Consider prophylactic KCl supplementation", "Advise potassium-rich foods (bananas, coconut water)"],
    acknowledged: true,
    acknowledged_by: "Dr. Arun Mehta",
    override_reason: "BMP ordered for day 3. KCl 600mg BD started prophylactically.",
    created_at: "2026-02-24T11:15:00Z",
    patient_name: "Ramesh Patel",
    patient_id: "p-002",
  },
];

type AlertWithPatient = typeof MOCK_ALERTS[0];

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string; variant: "critical" | "destructive" | "warning" | "default";
  color: string; bg: string; borderColor: string; icon: typeof ShieldAlert;
}> = {
  critical: { label: "CRITICAL", variant: "critical", color: "text-red-400", bg: "bg-red-500/10", borderColor: "border-red-500/30", icon: ShieldAlert },
  high: { label: "HIGH", variant: "destructive", color: "text-orange-400", bg: "bg-orange-500/10", borderColor: "border-orange-500/30", icon: AlertTriangle },
  medium: { label: "MEDIUM", variant: "warning", color: "text-amber-400", bg: "bg-amber-500/10", borderColor: "border-amber-500/30", icon: AlertTriangle },
  low: { label: "LOW", variant: "default", color: "text-blue-400", bg: "bg-blue-500/10", borderColor: "border-blue-500/30", icon: Bell },
};

const TYPE_LABELS: Record<AlertType, string> = {
  drug_interaction: "Drug Interaction",
  allergy: "Allergy Alert",
  contraindication: "Contraindication",
  dosage: "Dosage Warning",
};

// ─── Stats ────────────────────────────────────────────────────────────────────

function getStats(alerts: AlertWithPatient[]) {
  const active = alerts.filter(a => !a.acknowledged);
  return [
    { label: "Active Alerts", value: active.length.toString(), icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Critical", value: active.filter(a => a.severity === "critical").length.toString(), icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Acknowledged", value: alerts.filter(a => a.acknowledged).length.toString(), icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Patients Affected", value: new Set(alerts.map(a => a.patient_id)).size.toString(), icon: User, color: "text-blue-400", bg: "bg-blue-500/10" },
  ];
}

// ─── Alert Detail Modal ───────────────────────────────────────────────────────

function AlertDetailModal({ alert, onClose, onAcknowledge }: {
  alert: AlertWithPatient;
  onClose: () => void;
  onAcknowledge: (id: string, reason: string) => void;
}) {
  const [overrideReason, setOverrideReason] = useState("");
  const cfg = SEVERITY_CONFIG[alert.severity];
  const isCriticalOrHigh = alert.severity === "critical" || alert.severity === "high";

  const handleAck = () => {
    if (isCriticalOrHigh && !overrideReason.trim()) return;
    onAcknowledge(alert.id, overrideReason.trim() || "Acknowledged by physician");
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isCriticalOrHigh) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "relative w-full max-w-lg mx-4 rounded-2xl border overflow-hidden",
          cfg.borderColor, cfg.bg,
          alert.severity === "critical" && "shadow-[0_0_40px_rgba(239,68,68,0.3)]"
        )}
      >
        {/* Pulse ring for critical */}
        {alert.severity === "critical" && (
          <div className="absolute inset-0 rounded-2xl border-2 border-red-500/30 animate-ping pointer-events-none" />
        )}

        {/* Header */}
        <div className={cn(
          "px-5 py-4",
          alert.severity === "critical" ? "bg-red-600" :
          alert.severity === "high" ? "bg-orange-600" :
          alert.severity === "medium" ? "bg-amber-600" : "bg-blue-600"
        )}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/15 shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {cfg.label} · {TYPE_LABELS[alert.alert_type]}
                </p>
              </div>
              <h2 className="text-sm font-bold text-white leading-tight mt-0.5">{alert.title}</h2>
              <p className="text-[10px] text-white/60 mt-0.5">{alert.patient_name} · {formatDate(alert.created_at)}</p>
            </div>
            {!isCriticalOrHigh && (
              <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Drug pair */}
          {alert.drug_a && alert.drug_b && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                {alert.drug_a}
              </span>
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                {alert.drug_b}
              </span>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1">Description</p>
            <p className="text-sm text-[var(--foreground)] leading-relaxed">{alert.description}</p>
          </div>

          {/* Mechanism */}
          {alert.mechanism && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1">Mechanism</p>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">{alert.mechanism}</p>
            </div>
          )}

          {/* Alternatives */}
          {alert.alternatives && alert.alternatives.length > 0 && (
            <div className="p-3 rounded-xl bg-green-500/8 border border-green-500/20">
              <p className="text-[10px] uppercase tracking-wider text-green-400 font-semibold mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Recommended Actions / Alternatives
              </p>
              <ul className="space-y-1.5">
                {alert.alternatives.map((alt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-green-300">
                    <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{alt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Already acknowledged */}
          {alert.acknowledged ? (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25">
              <p className="text-xs text-green-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Acknowledged by {alert.acknowledged_by}
              </p>
              {alert.override_reason && (
                <p className="text-xs text-green-300/70 mt-1.5 pl-5">{alert.override_reason}</p>
              )}
            </div>
          ) : (
            <>
              {/* Override reason input */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold block mb-1.5">
                  {isCriticalOrHigh ? "Override Reason (required)" : "Acknowledgement Note (optional)"}
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={isCriticalOrHigh ? "Risk-benefit discussed with patient; alternative not suitable because..." : "Optional note..."}
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {!isCriticalOrHigh && (
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl text-xs font-medium text-[var(--foreground-muted)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--foreground-subtle)] transition-colors"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  onClick={handleAck}
                  disabled={isCriticalOrHigh && !overrideReason.trim()}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-bold transition-colors",
                    isCriticalOrHigh
                      ? "bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  )}
                >
                  {isCriticalOrHigh ? "Override & Document" : "Acknowledge"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ alert, index, onClick }: { alert: AlertWithPatient; index: number; onClick: () => void }) {
  const cfg = SEVERITY_CONFIG[alert.severity];
  const SeverityIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group",
        alert.acknowledged
          ? "border-[var(--border-subtle)] opacity-60 hover:opacity-80"
          : cn(cfg.borderColor, cfg.bg, "hover:brightness-110")
      )}
    >
      {/* Severity icon */}
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
        alert.severity === "critical" ? "bg-red-500/20" :
        alert.severity === "high" ? "bg-orange-500/20" :
        alert.severity === "medium" ? "bg-amber-500/20" : "bg-blue-500/20"
      )}>
        <SeverityIcon className={cn("w-5 h-5", cfg.color)} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={cfg.variant} className="text-[9px] py-0 px-1.5 h-3.5 uppercase tracking-wider">
            {cfg.label}
          </Badge>
          <span className="text-[10px] text-[var(--foreground-subtle)]">{TYPE_LABELS[alert.alert_type]}</span>
          {alert.acknowledged && (
            <Badge variant="success" className="text-[9px] py-0 px-1.5 h-3.5 gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium text-[var(--foreground)] mt-1 truncate">{alert.title}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-[var(--foreground-muted)] flex items-center gap-1">
            <User className="w-3 h-3" /> {alert.patient_name}
          </span>
          {alert.drug_a && alert.drug_b && (
            <span className="text-xs text-[var(--foreground-subtle)]">
              {alert.drug_a} ✕ {alert.drug_b}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-right shrink-0">
        <p className="text-[10px] text-[var(--foreground-subtle)]">{formatDate(alert.created_at)}</p>
        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
          {new Date(alert.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-[var(--foreground-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SafetyAlertsClientProps {
  user: { id: string; name: string; email: string; role: string };
}

export function SafetyAlertsClient({ user }: SafetyAlertsClientProps) {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | AlertSeverity>("all");
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertWithPatient | null>(null);

  const handleAcknowledge = (id: string, reason: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === id
        ? { ...a, acknowledged: true, acknowledged_by: `Dr. ${user.name}`, override_reason: reason }
        : a
    ));
    setSelectedAlert(null);
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (!showAcknowledged && a.acknowledged) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.drug_a?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (a.drug_b?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      return matchesSearch;
    }).sort((a, b) => {
      // Active first, then by severity
      if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
      const order: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }, [alerts, searchQuery, severityFilter, showAcknowledged]);

  const stats = getStats(alerts);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Safety Alerts
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
            Drug interactions, allergies & contraindication monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowAcknowledged(!showAcknowledged)}
          >
            {showAcknowledged ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            {showAcknowledged ? "Hide Resolved" : "Show Resolved"}
          </Button>
        </div>
      </div>

      {/* Critical banner if active critical alerts */}
      {alerts.some(a => a.severity === "critical" && !a.acknowledged) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-red-500/50 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
        >
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Critical Alerts Require Immediate Attention</p>
            <p className="text-sm text-red-300 mt-0.5">
              {alerts.filter(a => a.severity === "critical" && !a.acknowledged).length} critical alert(s) must be reviewed and documented before proceeding
            </p>
          </div>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            onClick={() => {
              const firstCritical = alerts.find(a => a.severity === "critical" && !a.acknowledged);
              if (firstCritical) setSelectedAlert(firstCritical);
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Review Now
          </Button>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
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
            placeholder="Search by alert, patient, or drug name..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "critical", "high", "medium", "low"] as const).map((sev) => {
            const sevCfg = sev !== "all" ? SEVERITY_CONFIG[sev] : null;
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  severityFilter === sev
                    ? sev === "all"
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                      : cn(sevCfg!.bg, sevCfg!.borderColor, sevCfg!.color)
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                )}
              >
                {sev === "all" ? "All" : sevCfg!.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--foreground-subtle)]">
            <Shield className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No alerts match your criteria</p>
            <p className="text-xs mt-1">All clear — no active safety concerns</p>
          </div>
        ) : (
          filteredAlerts.map((alert, i) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              index={i}
              onClick={() => setSelectedAlert(alert)}
            />
          ))
        )}
      </div>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <AlertDetailModal
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
            onAcknowledge={handleAcknowledge}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
