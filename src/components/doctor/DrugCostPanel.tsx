"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingDown, MapPin, IndianRupee, ShieldCheck, ExternalLink, Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { lookupMedications, lookupDrug } from "@/lib/jan-aushadhi";
import { cn } from "@/lib/utils";
import type { Medication } from "@/lib/types";

interface DrugCostPanelProps {
  medications: Medication[];
}

export function DrugCostPanel({ medications }: DrugCostPanelProps) {
  const results = useMemo(
    () => lookupMedications(medications),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(medications)]
  );

  if (!medications || medications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-2">
        <Package className="w-7 h-7 text-[var(--foreground-subtle)]/40" />
        <p className="text-xs text-[var(--foreground-subtle)] italic">
          Drug cost analysis will appear when medications are extracted
        </p>
      </div>
    );
  }

  const totalBrandCost = results.reduce(
    (acc, r) => acc + (r.entry ? r.entry.brand_price_per_unit * 14 : 0), 0
  );
  const totalJACost = results.reduce(
    (acc, r) => acc + (r.entry ? r.entry.jan_aushadhi_price_per_unit * 14 : 0), 0
  );
  const totalSavings = totalBrandCost - totalJACost;
  const savingsPct = totalBrandCost > 0 ? Math.round((totalSavings / totalBrandCost) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      {results.length > 0 && totalSavings > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/20 shrink-0">
            <TrendingDown className="w-4 h-4 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-green-300">
              Save ₹{Math.round(totalSavings)}{" "}
              <span className="font-normal text-green-400/70">({savingsPct}% off)</span>
            </p>
            <p className="text-[10px] text-green-400/60">
              14-day course · Jan Aushadhi vs brand
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-green-400/60">JA Total</p>
            <p className="text-sm font-bold text-green-300">₹{Math.round(totalJACost)}</p>
          </div>
        </motion.div>
      )}

      {/* Per-drug rows */}
      <AnimatePresence>
        {medications.map((med, idx) => {
          const result = results[idx];
          const entry = result?.entry;

          return (
            <motion.div
              key={`${med.name}-${idx}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-2"
            >
              {/* Drug header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground)] capitalize">{med.name}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)]">
                    {med.dosage} · {med.frequency} · {med.duration}
                  </p>
                </div>
                {entry ? (
                  <Badge variant="outline" className="text-[9px] shrink-0">{entry.category}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] shrink-0">Not found</Badge>
                )}
              </div>

              {entry ? (
                <>
                  {/* Price comparison grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Brand */}
                    <div className="p-2 rounded-lg bg-[var(--surface)] text-center">
                      <p className="text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wide mb-0.5">Brand</p>
                      <p className="text-sm font-bold text-red-400">₹{entry.brand_price_per_unit}</p>
                      <p className="text-[9px] text-[var(--foreground-subtle)]">per {entry.unit}</p>
                    </div>

                    {/* Generic */}
                    <div className="p-2 rounded-lg bg-[var(--surface)] text-center">
                      <p className="text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wide mb-0.5">Generic</p>
                      <p className="text-sm font-bold text-amber-400">₹{entry.generic_price_per_unit}</p>
                      <p className="text-[9px] text-[var(--foreground-subtle)]">per {entry.unit}</p>
                    </div>

                    {/* Jan Aushadhi */}
                    <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                      <p className="text-[9px] text-green-400/80 uppercase tracking-wide mb-0.5 font-semibold">JA Store</p>
                      <p className="text-sm font-bold text-green-400">₹{entry.jan_aushadhi_price_per_unit}</p>
                      <p className="text-[9px] text-green-400/60">per {entry.unit}</p>
                    </div>
                  </div>

                  {/* 14-day savings badge */}
                  {result.monthly_savings_14day && result.monthly_savings_14day > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--foreground-subtle)]">
                        14-day course savings
                      </span>
                      <span className="text-[10px] font-semibold text-green-400">
                        Save ₹{result.monthly_savings_14day} ({result.savings_pct}%)
                      </span>
                    </div>
                  )}

                  {/* Nearest store */}
                  {result.nearest_store && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)]">
                      <MapPin className="w-3 h-3 text-green-400 shrink-0" />
                      <p className="text-[10px] text-[var(--foreground-muted)] flex-1 truncate">
                        {result.nearest_store.name}
                      </p>
                      <span className="text-[10px] text-green-400 font-medium shrink-0">
                        {result.nearest_store.distance}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[10px] text-[var(--foreground-subtle)] italic">
                  No price data available for this drug
                </p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Jan Aushadhi info footer */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)]">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <p className="text-[10px] text-[var(--foreground-subtle)]">
          Jan Aushadhi stores are govt-run — same molecule, quality-tested, 50–90% cheaper
        </p>
        <ExternalLink className="w-3 h-3 text-[var(--foreground-subtle)] shrink-0 ml-auto" />
      </div>
    </div>
  );
}

// ─── Compact inline drug cost card for EMR panel ──────────────────────────────

export function DrugCostInline({ medName }: { medName: string }) {
  const result = useMemo(() => lookupDrug(medName), [medName]);

  if (!result.found || !result.entry) return null;

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <IndianRupee className="w-2.5 h-2.5 text-green-400" />
      <span className="text-[9px] text-red-400 line-through">₹{result.entry.brand_price_per_unit}</span>
      <span className="text-[9px] text-green-400 font-medium">₹{result.entry.jan_aushadhi_price_per_unit} JA</span>
      {result.savings_pct && result.savings_pct >= 50 && (
        <Badge className="text-[8px] px-1 py-0 h-3 bg-green-500/20 text-green-400 border-green-500/30">
          -{result.savings_pct}%
        </Badge>
      )}
    </div>
  );
}
