"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Link2, Clock, Hash, Eye, Lock, Loader2, ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortHash, verifyChain } from "@/lib/audit-chain";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/types";

// ─── Event type display config ────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CONSULTATION_STARTED:        { label: "Consultation Started",     color: "text-blue-400",   bg: "bg-blue-500/10" },
  CONSULTATION_ENDED:          { label: "Consultation Ended",       color: "text-green-400",  bg: "bg-green-500/10" },
  EMR_FIELD_UPDATED:           { label: "EMR Updated",              color: "text-cyan-400",   bg: "bg-cyan-500/10" },
  SAFETY_ALERT_TRIGGERED:      { label: "Safety Alert",             color: "text-red-400",    bg: "bg-red-500/10" },
  SAFETY_ALERT_ACKNOWLEDGED:   { label: "Alert Acknowledged",       color: "text-orange-400", bg: "bg-orange-500/10" },
  PRESCRIPTION_ADDED:          { label: "Prescription Added",       color: "text-purple-400", bg: "bg-purple-500/10" },
  SUMMARY_SENT_TO_PATIENT:     { label: "Summary Sent",             color: "text-teal-400",   bg: "bg-teal-500/10" },
  DOCUMENT_ACCESSED:           { label: "Document Accessed",        color: "text-slate-400",  bg: "bg-slate-500/10" },
  CONSENT_RECORDED:            { label: "Consent Recorded",         color: "text-emerald-400",bg: "bg-emerald-500/10" },
  ICD_CODE_MAPPED:             { label: "ICD Code Mapped",          color: "text-indigo-400", bg: "bg-indigo-500/10" },
  ALERT_OVERRIDDEN:            { label: "Alert Overridden",         color: "text-amber-400",  bg: "bg-amber-500/10" },
};

// ─── Single audit row ─────────────────────────────────────────────────────────

function AuditRow({
  entry,
  index,
  isFirst,
  isLast,
  expanded,
  onToggle,
}: {
  entry: AuditEntry;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = EVENT_CONFIG[entry.event_type] ?? { label: entry.event_type, color: "text-[var(--foreground-subtle)]", bg: "bg-[var(--surface)]" };
  const time = new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative pl-6"
    >
      {/* Chain line */}
      {!isFirst && (
        <div className="absolute left-[9px] top-0 bottom-0 w-px bg-[var(--border)]" />
      )}
      {/* Node */}
      <div className={cn(
        "absolute left-0 top-3 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center",
        isLast ? "border-green-500 bg-green-500/20" : "border-[var(--border)] bg-[var(--background)]"
      )}>
        {isLast ? (
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--foreground-subtle)]" />
        )}
      </div>

      {/* Card */}
      <div
        className={cn(
          "ml-3 mb-2 rounded-xl border overflow-hidden cursor-pointer",
          cfg.bg,
          "border-[var(--border)]"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <span className={cn("text-[9px] font-bold uppercase tracking-wider shrink-0", cfg.color)}>
            {cfg.label}
          </span>
          <div className="flex-1" />
          <span className="text-[9px] text-[var(--foreground-subtle)] font-mono">{time}</span>
          <button className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-0 space-y-2 border-t border-[var(--border)]">
                {/* Hash display */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-[var(--foreground-subtle)]" />
                    <span className="text-[9px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold">Hash</span>
                  </div>
                  <p className="text-[10px] font-mono text-[var(--foreground-muted)] bg-[var(--background)] px-2 py-1 rounded-lg border border-[var(--border-subtle)] break-all">
                    {entry.hash}
                  </p>
                </div>

                {/* Previous hash */}
                <div className="flex items-center gap-1.5">
                  <Link2 className="w-3 h-3 text-[var(--foreground-subtle)]" />
                  <span className="text-[9px] text-[var(--foreground-subtle)]">Prev:</span>
                  <span className="text-[9px] font-mono text-[var(--foreground-subtle)]">
                    {shortHash(entry.previous_hash)}
                  </span>
                </div>

                {/* Payload (condensed) */}
                {Object.keys(entry.payload).length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1">Payload</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(entry.payload).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--background)] border border-[var(--border-subtle)] text-[var(--foreground-subtle)]">
                          {k}: {typeof v === "string" ? v.slice(0, 20) : JSON.stringify(v).slice(0, 20)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-[var(--foreground-subtle)]">Actor:</span>
                  <span className="text-[9px] font-medium text-[var(--foreground-muted)]">{entry.actor_id}</span>
                  <span className="text-[9px] text-[var(--foreground-subtle)]">({entry.actor_role})</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main AuditTrailPanel ─────────────────────────────────────────────────────

interface AuditTrailPanelProps {
  entries: AuditEntry[];
  consultationId: string;
}

export function AuditTrailPanel({ entries, consultationId }: AuditTrailPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  const toggleEntry = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runVerification = async () => {
    setVerifying(true);
    const valid = await verifyChain(entries);
    setChainValid(valid);
    setVerifying(false);
  };

  // Auto-verify when entries change
  useEffect(() => {
    if (entries.length > 0) {
      runVerification();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  return (
    <Card className="border-[var(--border)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/15">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          Audit Trail
          <Badge variant="secondary" className="ml-1 text-[9px]">{entries.length} events</Badge>

          {/* Chain integrity badge */}
          <div className="ml-auto flex items-center gap-1.5">
            {verifying ? (
              <div className="flex items-center gap-1 text-[9px] text-[var(--foreground-subtle)]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Verifying...
              </div>
            ) : chainValid === true ? (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/25">
                <ShieldCheck className="w-3 h-3 text-green-400" />
                <span className="text-[9px] text-green-400 font-semibold">Chain Intact</span>
              </div>
            ) : chainValid === false ? (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span className="text-[9px] text-red-400 font-semibold">Chain Broken!</span>
              </div>
            ) : null}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Lock className="w-8 h-8 text-[var(--foreground-subtle)]/30" />
            <p className="text-xs text-[var(--foreground-subtle)] italic">
              Audit trail will appear when events are recorded
            </p>
          </div>
        ) : (
          <div className="space-y-0 max-h-80 overflow-y-auto pr-1">
            {entries.map((entry, i) => (
              <AuditRow
                key={entry.id}
                entry={entry}
                index={i}
                isFirst={i === 0}
                isLast={i === entries.length - 1}
                expanded={expandedIds.has(entry.id)}
                onToggle={() => toggleEntry(entry.id)}
              />
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-[var(--foreground-subtle)]" />
              <span className="text-[10px] text-[var(--foreground-subtle)]">
                Consultation ID: <span className="font-mono">{consultationId.slice(0, 16)}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={runVerification}
              disabled={verifying}
              className="text-[10px] h-6 gap-1"
            >
              {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Re-verify
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
