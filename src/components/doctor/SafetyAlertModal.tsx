"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafetyAlert } from "@/lib/types";

interface SafetyAlertModalProps {
  alerts: SafetyAlert[];
  onAcknowledge: (id: string, reason: string) => void;
  onDismissAll: () => void;
}

const SEVERITY_CONFIG = {
  critical: {
    border: "border-red-500/50",
    bg: "bg-red-500/10",
    headerBg: "bg-red-600",
    badge: "bg-red-500 text-white",
    icon: "text-red-400",
    title: "CRITICAL SAFETY ALERT",
    glow: "shadow-[0_0_40px_rgba(239,68,68,0.3)]",
  },
  high: {
    border: "border-orange-500/50",
    bg: "bg-orange-500/10",
    headerBg: "bg-orange-600",
    badge: "bg-orange-500 text-white",
    icon: "text-orange-400",
    title: "HIGH SEVERITY ALERT",
    glow: "shadow-[0_0_40px_rgba(249,115,22,0.25)]",
  },
  medium: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/8",
    headerBg: "bg-amber-600",
    badge: "bg-amber-500 text-white",
    icon: "text-amber-400",
    title: "SAFETY WARNING",
    glow: "",
  },
  low: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    headerBg: "bg-yellow-600",
    badge: "bg-yellow-500 text-black",
    icon: "text-yellow-400",
    title: "SAFETY NOTICE",
    glow: "",
  },
};

export function SafetyAlertModal({
  alerts,
  onAcknowledge,
  onDismissAll,
}: SafetyAlertModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [overrideReason, setOverrideReason] = useState("");
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const current = activeAlerts[currentIdx];

  if (!current) return null;

  const cfg = SEVERITY_CONFIG[current.severity] ?? SEVERITY_CONFIG.medium;
  const isCritical = current.severity === "critical" || current.severity === "high";

  const handleAck = () => {
    if (isCritical && !overrideReason.trim()) return;
    onAcknowledge(current.id, overrideReason.trim() || "Acknowledged by doctor");
    setAcknowledged((prev) => new Set([...prev, current.id]));
    setOverrideReason("");
    if (currentIdx < activeAlerts.length - 1) {
      setCurrentIdx(currentIdx);
    } else {
      onDismissAll();
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm p-4 pt-6"
        onClick={(e) => { if (e.target === e.currentTarget) onDismissAll(); }}
      >
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, x: 60, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 60, y: -10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "relative w-full max-w-md rounded-2xl border overflow-hidden",
            cfg.border,
            cfg.bg,
            cfg.glow
          )}
        >
          {/* Pulse ring for critical */}
          {isCritical && (
            <div className="absolute inset-0 rounded-2xl border-2 border-red-500/30 animate-ping pointer-events-none" />
          )}

          {/* Header */}
          <div className={cn("px-5 py-4", cfg.headerBg)}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/15 shrink-0">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {cfg.title}
                </p>
                <h2 className="text-sm font-bold text-white leading-tight mt-0.5">
                  {current.title}
                </h2>
              </div>
              <button
                onClick={onDismissAll}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Drug pair */}
            {current.drug_a && current.drug_b && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                  {current.drug_a}
                </span>
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                  {current.drug_b}
                </span>
              </div>
            )}

            {/* Mechanism */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1">
                Mechanism
              </p>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">
                {current.description}
              </p>
            </div>

            {/* Alternatives */}
            {current.alternatives && current.alternatives.length > 0 && (
              <div className="p-3 rounded-xl bg-green-500/8 border border-green-500/20">
                <p className="text-[10px] uppercase tracking-wider text-green-400 font-semibold mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Safer Alternatives
                </p>
                <ul className="space-y-1">
                  {current.alternatives.map((alt, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-green-300">
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      {alt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Override reason (required for critical/high) */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold block mb-1.5">
                {isCritical ? "Override Reason (required to proceed)" : "Acknowledgement Note (optional)"}
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={
                  isCritical
                    ? "e.g. Risk-benefit discussed with patient; alternative not suitable because..."
                    : "Optional note..."
                }
                rows={2}
                className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            {/* Pagination for multiple alerts */}
            {activeAlerts.length > 1 && (
              <p className="text-[10px] text-[var(--foreground-subtle)] text-center">
                Alert {currentIdx + 1} of {activeAlerts.length}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {!isCritical && (
                <button
                  onClick={onDismissAll}
                  className="flex-1 py-2 rounded-xl text-xs font-medium text-[var(--foreground-muted)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--foreground-subtle)] transition-colors"
                >
                  Dismiss
                </button>
              )}
              <button
                onClick={handleAck}
                disabled={isCritical && !overrideReason.trim()}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-colors",
                  isCritical
                    ? "bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                {isCritical ? "Override & Document" : "Acknowledge"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
