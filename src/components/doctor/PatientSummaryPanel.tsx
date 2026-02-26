"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Languages, MessageSquare, Printer, AlertTriangle,
  CheckCircle2, Loader2, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EMREntry } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientSummaryData {
  headline: string;
  bullets: string[];
  medication_instructions: string[];
  follow_up: string;
  red_flags: string[];
}

// ─── WhatsApp message builder ─────────────────────────────────────────────────

function buildWhatsAppMessage(summary: PatientSummaryData, patientName: string, lang: "en" | "hi"): string {
  const greeting = lang === "hi"
    ? `Namaste *${patientName}*! Aapki aaj ki visit ka summary:`
    : `Hello *${patientName}*, here's your visit summary:`;

  const bullets = summary.bullets.map((b) => `• ${b}`).join("\n");
  const meds = summary.medication_instructions.length > 0
    ? `\n\n*${lang === "hi" ? "Dawaiyaan" : "Your Medicines"}:*\n` +
      summary.medication_instructions.map((m) => `• ${m}`).join("\n")
    : "";
  const followUp = `\n\n*${lang === "hi" ? "Agla appointment" : "Next Visit"}:* ${summary.follow_up}`;
  const redFlags = summary.red_flags.length > 0
    ? `\n\n*${lang === "hi" ? "⚠️ Turant doctor ko dikhao agar" : "⚠️ See doctor immediately if"}:*\n` +
      summary.red_flags.map((r) => `• ${r}`).join("\n")
    : "";
  const footer = `\n\n_NexusMD — ${lang === "hi" ? "Aapki sehat, humari zimmedari" : "Your health, our priority"}_`;

  return encodeURIComponent(`${greeting}\n\n${bullets}${meds}${followUp}${redFlags}${footer}`);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PatientSummaryPanelProps {
  emr: Partial<EMREntry>;
  patientName?: string;
  consultationId: string;
  /** Auto-generate when emr has diagnosis. Default false — user clicks Generate */
  autoGenerate?: boolean;
}

export function PatientSummaryPanel({
  emr,
  patientName = "Patient",
  consultationId,
  autoGenerate = false,
}: PatientSummaryPanelProps) {
  const [summary, setSummary] = useState<PatientSummaryData | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedFlags, setShowRedFlags] = useState(false);

  const hasEnoughData = (emr.diagnosis?.length ?? 0) > 0 || (emr.symptoms?.length ?? 0) > 0 || (emr.medications?.length ?? 0) > 0;

  const generate = async (lang: "en" | "hi" = language) => {
    if (!hasEnoughData) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patient-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emr, patientName, language: lang, consultationId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setIsLoading(false);
    }
  };

  const switchLanguage = (lang: "en" | "hi") => {
    setLanguage(lang);
    if (summary) generate(lang);
  };

  const whatsappUrl = summary
    ? `https://wa.me/?text=${buildWhatsAppMessage(summary, patientName, language)}`
    : null;

  if (!hasEnoughData) {
    return (
      <div className="flex flex-col items-center justify-center h-20 gap-1">
        <Sparkles className="w-5 h-5 text-[var(--foreground-subtle)]/40" />
        <p className="text-xs text-[var(--foreground-subtle)] italic text-center">
          Patient summary available after clinical data is extracted
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden text-[10px]">
          {(["en", "hi"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => switchLanguage(lang)}
              className={cn(
                "px-2.5 py-1.5 font-medium transition-colors",
                language === lang
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              )}
            >
              {lang === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => generate()}
          disabled={isLoading}
          className="gap-1.5 text-xs h-7"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : summary ? (
            <RefreshCw className="w-3 h-3" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {summary ? "Regenerate" : "Generate Summary"}
        </Button>

        {summary && whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-600/20 border border-green-600/30 hover:bg-green-600/30 transition-colors text-[10px] font-medium text-green-300"
          >
            <MessageSquare className="w-3 h-3" />
            WhatsApp
          </a>
        )}

        {summary && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] transition-colors text-[10px] text-[var(--foreground-muted)]"
          >
            <Printer className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> {error}
        </p>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 rounded bg-[var(--surface)] w-3/4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 rounded bg-[var(--surface)] w-full" />
          ))}
        </div>
      )}

      {/* Summary */}
      <AnimatePresence mode="wait">
        {summary && !isLoading && (
          <motion.div
            key={`${language}-${summary.headline.slice(0, 20)}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Headline */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-blue-200 leading-relaxed">{summary.headline}</p>
            </div>

            {/* 3-bullet summary */}
            <div className="space-y-2">
              {(summary.bullets ?? []).slice(0, 3).map((bullet, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-2.5"
                >
                  <CheckCircle2 className={cn(
                    "w-3.5 h-3.5 shrink-0 mt-0.5",
                    i === 0 ? "text-blue-400" : i === 1 ? "text-green-400" : "text-purple-400"
                  )} />
                  <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{bullet}</p>
                </motion.div>
              ))}
            </div>

            {/* Medication instructions */}
            {summary.medication_instructions?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-wider font-semibold text-[var(--foreground-subtle)]">
                  Your Medicines
                </p>
                {summary.medication_instructions.map((inst, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)]"
                  >
                    <span className="text-[10px] font-bold text-amber-400 shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{inst}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Follow-up */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <Languages className="w-3 h-3 text-[var(--foreground-subtle)] shrink-0 mt-0.5" />
              <p className="text-[10px] text-[var(--foreground-muted)] leading-relaxed italic">{summary.follow_up}</p>
            </div>

            {/* Red flags (collapsible) */}
            {summary.red_flags?.length > 0 && (
              <div>
                <button
                  onClick={() => setShowRedFlags((v) => !v)}
                  className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {summary.red_flags.length} warning sign{summary.red_flags.length > 1 ? "s" : ""} to watch
                  {showRedFlags ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <AnimatePresence>
                  {showRedFlags && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-2 space-y-1"
                    >
                      {summary.red_flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-amber-300">{flag}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
