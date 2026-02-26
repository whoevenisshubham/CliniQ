"use client";

import React from "react";
import { motion } from "framer-motion";
import { FlaskConical, Globe, BarChart3, Database, TrendingUp, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ResearchDashboardClientProps {
  user: { id: string; name: string; email: string; role: string };
}

export function ResearchDashboardClient({ user }: ResearchDashboardClientProps) {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Research Insights</h1>
        <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
          Anonymized population health data · Personal data hidden via ZK-Proofs
        </p>
      </div>

      {/* ZK-Proof notice */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/25">
        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-green-500/20">
          <Database className="w-3 h-3 text-green-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-green-300">Zero-Knowledge Privacy Active</p>
          <p className="text-[10px] text-[var(--foreground-muted)]">
            All patient identifiers (name, DOB, ABHA ID) are cryptographically hidden. You access de-identified insights only.
          </p>
        </div>
        <Badge variant="success" className="ml-auto text-[9px] shrink-0">HIPAA Compliant</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Cases", value: "12,847", delta: "De-identified", icon: Database },
          { label: "Disease Clusters", value: "23", delta: "Active tracking", icon: Globe },
          { label: "ICD Codes Mapped", value: "4,219", delta: "Unique codes", icon: FlaskConical },
          { label: "Epidemiology Models", value: "8", delta: "Active regions", icon: MapPin },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--foreground-subtle)]">{stat.label}</p>
                      <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{stat.value}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">{stat.delta}</p>
                    </div>
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10">
                      <Icon className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Top Conditions (Feb 2026)
              <Badge variant="secondary" className="ml-auto text-[9px]">Monsoon season</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { condition: "Type 2 Diabetes (E11)", count: 1847, pct: 78 },
              { condition: "Hypertension (I10)", count: 1623, pct: 68 },
              { condition: "Dengue Fever (A90)", count: 812, pct: 34 },
              { condition: "Upper Respiratory (J06)", count: 654, pct: 27 },
              { condition: "Malaria (B54)", count: 431, pct: 18 },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--foreground-muted)]">{item.condition}</span>
                  <span className="text-[10px] text-[var(--foreground-subtle)]">{item.count.toLocaleString()} cases</span>
                </div>
                <Progress value={item.pct} className="h-1.5" indicatorClassName="bg-blue-500" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Epid model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Adaptive Epidemiology Model
              <Badge variant="warning" className="ml-auto text-[9px]">High dengue risk</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-[var(--foreground-muted)]">Context-aware probability adjustments active:</p>
            {[
              { factor: "Season: Monsoon (July–Sept)", adjustment: "+34% vector disease", color: "text-amber-400" },
              { factor: "Region: Urban Metro (Delhi)", adjustment: "+22% lifestyle diseases", color: "text-blue-400" },
              { factor: "Cluster: Ages 45–65", adjustment: "+18% diabetes/hypertension", color: "text-purple-400" },
              { factor: "Network: +12 dengue cases nearby", adjustment: "+41% dengue probability", color: "text-red-400" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--foreground-subtle)] mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--foreground-muted)]">{f.factor}</p>
                  <p className={`text-[10px] font-medium ${f.color}`}>{f.adjustment}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
