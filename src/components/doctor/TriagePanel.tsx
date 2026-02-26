"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Siren, Activity, AlertTriangle, Clock, User, Thermometer,
  HeartPulse, ChevronRight, X, Radio, Stethoscope, ShieldAlert,
  CheckCircle2, ArrowRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TRIAGE_PATCHES, getRandomPatch, type TriagePatch } from "@/lib/triage";

// ─── Priority-level styling ───────────────────────────────────────────────────

const PRIORITY_STYLES = {
  P1: {
    border: "border-red-500/50",
    bg: "bg-red-500/10",
    badge: "bg-red-500 text-white",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.2)]",
    text: "text-red-400",
    label: "IMMEDIATE",
    pulse: true,
  },
  P2: {
    border: "border-orange-500/40",
    bg: "bg-orange-500/8",
    badge: "bg-orange-500 text-white",
    glow: "",
    text: "text-orange-400",
    label: "URGENT",
    pulse: false,
  },
  P3: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    badge: "bg-yellow-500 text-black",
    glow: "",
    text: "text-yellow-400",
    label: "DELAYED",
    pulse: false,
  },
};

// ─── Incoming triage alert ────────────────────────────────────────────────────

function IncomingPatchModal({
  patch,
  onAccept,
  onDismiss,
}: {
  patch: TriagePatch;
  onAccept: (p: TriagePatch) => void;
  onDismiss: () => void;
}) {
  const style = PRIORITY_STYLES[patch.priority];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 24 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className={cn(
            "relative w-full max-w-lg mx-4 rounded-2xl border overflow-hidden",
            style.border,
            style.bg,
            style.glow
          )}
        >
          {/* Pulse ring for P1 */}
          {style.pulse && (
            <div className="absolute inset-0 rounded-2xl border-2 border-red-500/25 animate-ping pointer-events-none" />
          )}

          {/* Header */}
          <div className="px-5 py-4 bg-red-700 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/15 shrink-0 animate-pulse">
              <Siren className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                EMT Radio Patch · Incoming
              </p>
              <h2 className="text-sm font-bold text-white">{patch.scenario}</h2>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20">
              <Clock className="w-3 h-3 text-white" />
              <span className="text-xs font-bold text-white">ETA {patch.eta_minutes} min</span>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Priority badge */}
            <div className="flex items-center gap-2">
              <span className={cn("px-3 py-1 rounded-full text-xs font-bold", style.badge)}>
                {patch.priority} — {style.label}
              </span>
              <span className="px-2. py-1 rounded-full text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)]">
                {patch.emt_unit}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Activity className="w-3 h-3 text-red-400" />
                <span className="text-xs font-bold text-red-400">Severity {patch.severity_score}/100</span>
              </div>
            </div>

            {/* Patient info */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <User className="w-4 h-4 text-[var(--foreground-subtle)] shrink-0" />
              <div>
                <p className="text-xs font-medium text-[var(--foreground)]">{patch.patient.name}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">
                  {patch.patient.age}y · {patch.patient.gender === "M" ? "Male" : "Female"}
                  {patch.patient.blood_group ? ` · ${patch.patient.blood_group}` : ""}
                  {patch.patient.known_conditions?.length
                    ? ` · ${patch.patient.known_conditions.join(", ")}`
                    : ""}
                </p>
              </div>
            </div>

            {/* Chief complaint */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1">
                Chief Complaint
              </p>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">{patch.chief_complaint}</p>
            </div>

            {/* Vitals grid */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-2">
                Vitals (En Route)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "BP", value: `${patch.vitals.bp_systolic}/${patch.vitals.bp_diastolic}`, unit: "mmHg", alert: patch.vitals.bp_systolic! < 90 },
                  { label: "HR", value: String(patch.vitals.heart_rate), unit: "bpm", alert: patch.vitals.heart_rate! > 120 },
                  { label: "SpO₂", value: String(patch.vitals.spo2), unit: "%", alert: patch.vitals.spo2! < 92 },
                  { label: "Temp", value: String(patch.vitals.temperature), unit: "°C", alert: false },
                  { label: "Weight", value: patch.vitals.weight ? String(patch.vitals.weight) : "—", unit: "kg", alert: false },
                  { label: "GCS", value: "—", unit: "/15", alert: false },
                ].map((v) => (
                  <div
                    key={v.label}
                    className={cn(
                      "text-center p-2 rounded-lg border",
                      v.alert
                        ? "bg-red-500/15 border-red-500/30"
                        : "bg-[var(--background)] border-[var(--border-subtle)]"
                    )}
                  >
                    <p className="text-[9px] uppercase text-[var(--foreground-subtle)]">{v.label}</p>
                    <p className={cn("text-sm font-bold", v.alert ? "text-red-400" : "text-[var(--foreground)]")}>
                      {v.value}
                    </p>
                    <p className="text-[9px] text-[var(--foreground-subtle)]">{v.unit}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Treatments given */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1.5">
                Treatments Given (Pre-hospital)
              </p>
              <ul className="space-y-1">
                {patch.treatments_given.map((t, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                    <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* ER Prep notes */}
            <div className={cn("p-3 rounded-xl border", style.border, style.bg)}>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1.5" style={{ color: "inherit" }}>
                <ShieldAlert className="w-3 h-3" />
                <span className={style.text}>ER Preparation</span>
              </p>
              <p className="text-xs text-[var(--foreground)] leading-relaxed">{patch.er_prep_notes}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onDismiss} className="flex-1 gap-1.5">
                <X className="w-3.5 h-3.5" />
                Decline
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => onAccept(patch)}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Accept & Pre-fill EMR
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Triage queue item ────────────────────────────────────────────────────────

function TriageQueueItem({
  patch,
  onSelect,
}: {
  patch: TriagePatch;
  onSelect: (p: TriagePatch) => void;
}) {
  const style = PRIORITY_STYLES[patch.priority];
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 2 }}
      onClick={() => onSelect(patch)}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors hover:bg-[var(--surface-elevated)]",
        style.border
      )}
    >
      <div className={cn("w-2 h-2 rounded-full shrink-0", patch.priority === "P1" ? "bg-red-500 animate-pulse" : patch.priority === "P2" ? "bg-orange-500" : "bg-yellow-500")} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--foreground)] truncate">{patch.scenario}</p>
        <p className="text-[10px] text-[var(--foreground-subtle)]">{patch.emt_unit} · ETA {patch.eta_minutes}min</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", style.badge)}>{patch.priority}</span>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
      </div>
    </motion.div>
  );
}

// ─── Main TriagePanel component ───────────────────────────────────────────────

interface TriagePanelProps {
  onTriageAccepted?: (patch: TriagePatch) => void;
}

export function TriagePanel({ onTriageAccepted }: TriagePanelProps) {
  const [activePatch, setActivePatch] = useState<TriagePatch | null>(null);
  const [simulating, setSimulating] = useState(false);
  const router = useRouter();

  const simulateIncoming = () => {
    setSimulating(true);
    setTimeout(() => {
      setActivePatch(getRandomPatch());
      setSimulating(false);
    }, 1200);
  };

  const handleAccept = (patch: TriagePatch) => {
    setActivePatch(null);
    onTriageAccepted?.(patch);
    // Navigate to consultation with triage data encoded
    const params = new URLSearchParams({
      triage: patch.id,
      patientName: patch.patient.name,
      complaint: patch.chief_complaint,
    });
    router.push(`/doctor/consultation/new?${params.toString()}`);
  };

  return (
    <>
      {activePatch && (
        <IncomingPatchModal
          patch={activePatch}
          onAccept={handleAccept}
          onDismiss={() => setActivePatch(null)}
        />
      )}

      <Card className="border-[var(--border)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xs">
            <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-500/15">
              <Siren className="w-3.5 h-3.5 text-red-400" />
            </div>
            Ambulance Triage
            <Badge className="ml-auto text-[9px] bg-red-500/15 text-red-400 border-red-500/30">
              LIVE
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Simulate button */}
          <Button
            onClick={simulateIncoming}
            disabled={simulating}
            className="w-full gap-2 bg-red-600/15 text-red-400 border border-red-500/30 hover:bg-red-600/25 transition-colors"
            variant="outline"
          >
            {simulating ? (
              <>
                <Radio className="w-4 h-4 animate-pulse" />
                Receiving EMT Patch...
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                Simulate Incoming Triage
              </>
            )}
          </Button>

          {/* Pre-set scenarios */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-2">
              Active Scenarios (demo)
            </p>
            <div className="space-y-1.5">
              {TRIAGE_PATCHES.slice(0, 3).map((patch) => (
                <TriageQueueItem
                  key={patch.id}
                  patch={patch}
                  onSelect={setActivePatch}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
