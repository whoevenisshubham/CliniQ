"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Star, TrendingUp, Award, Globe, Upload,
  CheckCircle2, X, Database, Share2, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisionAnonymizer } from "@/components/shared/VisionAnonymizer";
import { cn } from "@/lib/utils";

// ─── Credit storage key ───────────────────────────────────────────────────────

const CREDIT_STORAGE_KEY = "nexusmd_protocol_credits";
const CREDIT_HISTORY_KEY = "nexusmd_credit_history";

interface CreditHistoryEntry {
  id: string;
  description: string;
  points: number;
  timestamp: string;
}

// ─── Credit tier config ───────────────────────────────────────────────────────

const CREDIT_TIERS = [
  { min: 0,   max: 9,   label: "Resident",     icon: "🩺", color: "text-slate-400"  },
  { min: 10,  max: 24,  label: "Consultant",   icon: "⚕️", color: "text-blue-400"   },
  { min: 25,  max: 49,  label: "Specialist",   icon: "🏥", color: "text-indigo-400" },
  { min: 50,  max: 99,  label: "Fellow",       icon: "🔬", color: "text-purple-400" },
  { min: 100, max: 999, label: "Attending+",   icon: "🏆", color: "text-amber-400"  },
];

function getTier(credits: number) {
  return CREDIT_TIERS.find((t) => credits >= t.min && credits <= t.max) ?? CREDIT_TIERS[0];
}

// ─── Credit hook ──────────────────────────────────────────────────────────────

export function useProtocolCredits() {
  const [credits, setCredits] = useState<number>(0);
  const [history, setHistory] = useState<CreditHistoryEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(CREDIT_STORAGE_KEY);
    if (stored) setCredits(Number(stored));
    const hist = localStorage.getItem(CREDIT_HISTORY_KEY);
    if (hist) setHistory(JSON.parse(hist));
  }, []);

  const addCredits = (points: number, description: string) => {
    setCredits((prev) => {
      const next = prev + points;
      localStorage.setItem(CREDIT_STORAGE_KEY, String(next));
      return next;
    });
    setHistory((prev) => {
      const entry: CreditHistoryEntry = {
        id: `cred-${Date.now()}`,
        description,
        points,
        timestamp: new Date().toISOString(),
      };
      const next = [entry, ...prev].slice(0, 20);
      localStorage.setItem(CREDIT_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { credits, history, addCredits };
}

// ─── Protocol Credit Badge ─────────────────────────────────────────────────────

interface ProtocolCreditBadgeProps {
  credits: number;
  compact?: boolean;
}

export function ProtocolCreditBadge({ credits, compact = false }: ProtocolCreditBadgeProps) {
  const tier = getTier(credits);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <Trophy className="w-3 h-3 text-amber-400" />
        <span className={cn("text-xs font-bold", tier.color)}>{credits}</span>
        <span className="text-[10px] text-[var(--foreground-subtle)]">credits</span>
      </div>
    );
  }

  const nextTier = CREDIT_TIERS.find((t) => t.min > credits);
  const progressToNext = nextTier
    ? ((credits - (getTier(credits).min)) / (nextTier.min - getTier(credits).min)) * 100
    : 100;

  return (
    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{tier.icon}</div>
        <div>
          <p className={cn("text-sm font-bold", tier.color)}>{tier.label}</p>
          <p className="text-[10px] text-[var(--foreground-subtle)]">Protocol Contributor</p>
        </div>
        <div className="ml-auto text-right">
          <p className={cn("text-xl font-bold", tier.color)}>{credits}</p>
          <p className="text-[10px] text-[var(--foreground-subtle)]">Protocol Credits</p>
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div>
          <div className="flex justify-between text-[9px] text-[var(--foreground-subtle)] mb-1">
            <span>{tier.label}</span>
            <span>{nextTier.label} at {nextTier.min} credits</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--background)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Global Repository Modal ──────────────────────────────────────────────────

interface GlobalRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContribute: (points: number, description: string) => void;
}

export function GlobalRepositoryModal({
  isOpen,
  onClose,
  onContribute,
}: GlobalRepositoryModalProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "history">("upload");
  const [recentContributions] = useState([
    { type: "Chest X-Ray (TB)", date: "Feb 20, 2026", credits: 2, status: "Verified" },
    { type: "ECG (STEMI pattern)", date: "Feb 18, 2026", credits: 3, status: "Under Review" },
    { type: "Fundoscopy (DR grade 3)", date: "Feb 15, 2026", credits: 2, status: "Verified" },
    { type: "Ultrasound (fatty liver)", date: "Feb 12, 2026", credits: 2, status: "Verified" },
  ]);

  const handleContribute = (dataUrl: string, filename: string) => {
    onContribute(2, `Contributed: ${filename}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.93, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.93, y: 20 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="w-full max-w-2xl bg-[var(--background-secondary)] border border-[var(--border)] rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/15">
                <Globe className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--foreground)]">Global Medical Repository</h2>
                <p className="text-[10px] text-[var(--foreground-subtle)]">
                  Contribute de-identified cases · Earn Protocol Credits · Advance Indian healthcare AI
                </p>
              </div>
              <button onClick={onClose} className="ml-auto text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
              {[
                { id: "upload", label: "Upload & Anonymise", icon: Upload },
                { id: "history", label: "My Contributions", icon: Database },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={cn(
                      "flex items-center gap-1.5 px-5 py-3 text-xs font-medium transition-colors border-b-2",
                      activeTab === tab.id
                        ? "border-purple-500 text-purple-400"
                        : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {activeTab === "upload" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-purple-500/8 border border-purple-500/20">
                    <Award className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-purple-300">Earn 2 Protocol Credits per verified contribution</p>
                      <p className="text-[10px] text-purple-400/60">All PHI is removed before upload. Your data stays within Indian servers (DISHA compliant).</p>
                    </div>
                  </div>
                  <VisionAnonymizer onContributeToRepo={handleContribute} />
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Cases Contributed", value: "9" },
                      { label: "Credits Earned", value: "21" },
                      { label: "Cases Verified", value: "7" },
                    ].map((s) => (
                      <div key={s.label} className="text-center p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                        <p className="text-xl font-bold text-[var(--foreground)]">{s.value}</p>
                        <p className="text-[10px] text-[var(--foreground-subtle)]">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {recentContributions.map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                      >
                        <Share2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-[var(--foreground)]">{c.type}</p>
                          <p className="text-[10px] text-[var(--foreground-subtle)]">{c.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-amber-400">+{c.credits} credits</span>
                          <Badge
                            className={cn(
                              "text-[9px]",
                              c.status === "Verified"
                                ? "bg-green-500/15 text-green-400 border-green-500/25"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/25"
                            )}
                          >
                            {c.status}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
