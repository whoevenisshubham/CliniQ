"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, Clock, Stethoscope, FlaskConical, Wrench, Pill,
  TrendingUp, IndianRupee, ChevronDown, ChevronUp
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeBilling, formatINR, CATEGORY_COLORS } from "@/lib/billing-engine";
import { cn } from "@/lib/utils";
import type { BillingItem } from "@/lib/types";

const CATEGORY_ICONS: Record<BillingItem["category"], React.ReactNode> = {
  consultation: <Stethoscope className="w-3 h-3" />,
  procedure: <Wrench className="w-3 h-3" />,
  investigation: <FlaskConical className="w-3 h-3" />,
  medication: <Pill className="w-3 h-3" />,
  equipment: <TrendingUp className="w-3 h-3" />,
};

interface LiveBillingPanelProps {
  durationMs: number;
  transcript: string;
}

export function LiveBillingPanel({ durationMs, transcript }: LiveBillingPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const billing = useMemo(
    () => computeBilling({ durationMs, transcript, existingItems: [] }),
    // Recalculate every time transcript changes (debounced upstream)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(durationMs / 60000), transcript]
  );

  const minutes = Math.max(1, Math.floor(durationMs / 60000));

  // Group items by category for display
  const grouped = billing.line_items.reduce<Record<string, BillingItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const procedureCount = (grouped.procedure?.length ?? 0) + (grouped.investigation?.length ?? 0) + (grouped.equipment?.length ?? 0);

  return (
    <Card className="border-[var(--border)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs">
          <Receipt className="w-3.5 h-3.5 text-amber-400" />
          Live Billing
          {procedureCount > 0 && (
            <Badge className="text-[9px] bg-amber-500/15 text-amber-400 border-amber-500/25 ml-1">
              {procedureCount} items auto-detected
            </Badge>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Running total bar */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <p className="text-[10px] text-amber-400/70">Running Total</p>
              <p className="text-[10px] text-[var(--foreground-subtle)]">{minutes} min · {billing.line_items.length} items</p>
            </div>
          </div>
          <div className="text-right">
            <motion.p
              key={billing.total}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              className="text-lg font-bold text-amber-400"
            >
              {formatINR(billing.total)}
            </motion.p>
            <p className="text-[9px] text-[var(--foreground-subtle)]">incl. 5% GST</p>
          </div>
        </div>

        {/* Breakdown */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 overflow-hidden"
            >
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className={cn(
                    "text-[9px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1",
                    CATEGORY_COLORS[category as BillingItem["category"]]
                  )}>
                    {CATEGORY_ICONS[category as BillingItem["category"]]}
                    {category}
                  </p>
                  <div className="space-y-1">
                    {items.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border-subtle)]"
                      >
                        <span className="text-xs text-[var(--foreground-muted)] truncate flex-1">
                          {item.description}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {item.quantity > 1 && (
                            <span className="text-[9px] text-[var(--foreground-subtle)]">
                              ×{item.quantity}
                            </span>
                          )}
                          <span className="text-xs font-medium text-[var(--foreground)]">
                            {formatINR(item.total)}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
                <div className="flex justify-between text-xs text-[var(--foreground-muted)]">
                  <span>Subtotal</span>
                  <span>{formatINR(billing.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--foreground-muted)]">
                  <span>GST (5%)</span>
                  <span>{formatINR(billing.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[var(--foreground)] pt-1 border-t border-[var(--border)]">
                  <span>Total</span>
                  <span className="text-amber-400">{formatINR(billing.total)}</span>
                </div>
              </div>

              {/* Insurance note */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/8 border border-blue-500/15">
                <IndianRupee className="w-3 h-3 text-blue-400 shrink-0" />
                <p className="text-[10px] text-blue-300">
                  Eligible for Ayushman Bharat / CGHS reimbursement
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
