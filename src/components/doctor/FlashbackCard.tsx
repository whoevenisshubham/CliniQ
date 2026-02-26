"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronRight, Pin, Pill, Stethoscope, AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlashbackVisit {
  date: string;          // ISO or "Feb 12, 2026"
  patientName: string;
  chiefComplaint: string;
  bullets: string[];     // exactly 3 summary points
  medications: string[]; // top 2-3 med names
  diagnosis: string[];   // top 1-2 diagnoses
  urgencyFlag?: string;  // optional — "BP still high", "HbA1c due"
}

interface FlashbackCardProps {
  patientName?: string;
  consultationId?: string;
}

// ─── Mock last-visit data (per demo patient) ─────────────────────────────────

const MOCK_FLASHBACKS: Record<string, FlashbackVisit> = {
  default: {
    date: "Feb 5, 2026",
    patientName: "Priya Sharma",
    chiefComplaint: "Uncontrolled blood sugar, fatigue for 2 weeks",
    bullets: [
      "HbA1c was 8.4% — sugar control needs improvement",
      "Metformin dose increased to 1g BD; diet counselling given",
      "Advised daily morning walk 30 min, avoid rice at dinner",
    ],
    medications: ["Metformin 1g", "Telmisartan 40mg", "Atorvastatin 10mg"],
    diagnosis: ["Type 2 Diabetes (uncontrolled)", "Hypertension – Stage 1"],
    urgencyFlag: "HbA1c recheck due — 3 months overdue",
  },
};

// ─── Sticky-note color palette (cycles by date hash) ─────────────────────────

const NOTE_COLORS = [
  { bg: "bg-amber-400/15",    border: "border-amber-400/30",   pin: "text-amber-400",   text: "text-amber-200" },
  { bg: "bg-sky-400/15",      border: "border-sky-400/30",     pin: "text-sky-400",     text: "text-sky-200" },
  { bg: "bg-violet-400/15",   border: "border-violet-400/30",  pin: "text-violet-400",  text: "text-violet-200" },
  { bg: "bg-emerald-400/15",  border: "border-emerald-400/30", pin: "text-emerald-400", text: "text-emerald-200" },
];

function colorForDate(dateStr: string) {
  let hash = 0;
  for (const ch of dateStr) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlashbackCard({ patientName = "Priya Sharma", consultationId }: FlashbackCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const visit: FlashbackVisit = MOCK_FLASHBACKS[consultationId ?? "default"] ?? MOCK_FLASHBACKS["default"];
  const color = colorForDate(visit.date);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8, rotate: -0.8 }}
          animate={{ opacity: 1, y: 0, rotate: -0.4 }}
          exit={{ opacity: 0, scale: 0.9, rotate: 2 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className={cn(
            "relative p-4 rounded-xl border shadow-lg space-y-3",
            color.bg, color.border
          )}
          style={{ boxShadow: "3px 4px 12px rgba(0,0,0,0.25)" }}
        >
          {/* Pin icon */}
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
            <Pin className={cn("w-4 h-4 rotate-45", color.pin)} />
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 pt-1">
            <Calendar className={cn("w-3.5 h-3.5 shrink-0", color.pin)} />
            <div>
              <p className={cn("text-[10px] font-bold uppercase tracking-wider", color.text)}>
                Last Visit Flashback
              </p>
              <p className="text-[9px] text-[var(--foreground-subtle)]">{visit.date} · {visit.patientName}</p>
            </div>
          </div>

          {/* Chief complaint */}
          <p className="text-[10px] text-[var(--foreground-muted)] italic leading-relaxed border-l-2 border-[var(--border)] pl-2">
            &ldquo;{visit.chiefComplaint}&rdquo;
          </p>

          {/* 3-bullet summary */}
          <div className="space-y-1.5">
            {visit.bullets.map((bullet, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="flex items-start gap-2"
              >
                <span className={cn("text-[10px] font-bold shrink-0 mt-0.5", color.pin)}>
                  {i + 1}.
                </span>
                <p className="text-[10px] text-[var(--foreground-muted)] leading-relaxed">{bullet}</p>
              </motion.div>
            ))}
          </div>

          {/* Diagnosis + Meds */}
          <div className="flex flex-wrap gap-1.5">
            {visit.diagnosis.map((d) => (
              <div key={d} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-[var(--border)] bg-[var(--background)]/50">
                <Stethoscope className="w-2.5 h-2.5 text-[var(--foreground-subtle)]" />
                <span className="text-[9px] text-[var(--foreground-muted)]">{d}</span>
              </div>
            ))}
            {visit.medications.map((m) => (
              <div key={m} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-green-500/25 bg-green-500/5">
                <Pill className="w-2.5 h-2.5 text-green-400" />
                <span className="text-[9px] text-green-400/80">{m}</span>
              </div>
            ))}
          </div>

          {/* Urgency flag */}
          {visit.urgencyFlag && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
              <span className="text-[10px] text-amber-300 font-medium">{visit.urgencyFlag}</span>
            </motion.div>
          )}

          {/* Continue CTA */}
          <button className="flex items-center gap-1 text-[10px] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors ml-auto">
            Continue from here <ChevronRight className="w-3 h-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
