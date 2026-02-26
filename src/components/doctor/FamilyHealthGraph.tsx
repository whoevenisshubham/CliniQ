"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, GitBranch, Info, X, HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  gender: "M" | "F";
  conditions: string[];
  deceased?: boolean;
  isPatient?: boolean;
}

// ─── Mock family data for demo patient (Priya Sharma) ────────────────────────

const FAMILY_DATA: FamilyMember[] = [
  // Generation 1 — Grandparents
  { id: "gf-p", name: "Krishnarao Sharma", relation: "Paternal Grandfather", age: 82, gender: "M", conditions: ["Type 2 Diabetes", "Hypertension"], deceased: true },
  { id: "gm-p", name: "Saraswati Sharma", relation: "Paternal Grandmother", age: 78, gender: "F", conditions: ["Hypertension", "Osteoporosis"] },
  { id: "gf-m", name: "Shivaji Patel", relation: "Maternal Grandfather", age: 80, gender: "M", conditions: ["CAD", "Type 2 Diabetes"], deceased: true },
  { id: "gm-m", name: "Kamala Patel", relation: "Maternal Grandmother", age: 75, gender: "F", conditions: ["Type 2 Diabetes", "Cataract"] },

  // Generation 2 — Parents
  { id: "father", name: "Suresh Sharma", relation: "Father", age: 58, gender: "M", conditions: ["Type 2 Diabetes", "Hypertension", "Dyslipidaemia"] },
  { id: "mother", name: "Sunita Sharma", relation: "Mother", age: 54, gender: "F", conditions: ["Hypothyroidism", "Hypertension"] },

  // Generation 2 — Aunts/Uncles
  { id: "uncle", name: "Vijay Sharma", relation: "Paternal Uncle", age: 52, gender: "M", conditions: ["Type 2 Diabetes", "CAD"] },

  // Generation 3 — Patient + Siblings
  { id: "patient", name: "Priya Sharma", relation: "Patient", age: 45, gender: "F", conditions: ["Type 2 Diabetes", "Hypertension"], isPatient: true },
  { id: "brother", name: "Rahul Sharma", relation: "Brother", age: 42, gender: "M", conditions: ["Pre-diabetes", "Hypertension"] },
  { id: "sister", name: "Neha Sharma", relation: "Sister", age: 38, gender: "F", conditions: ["Hypothyroidism"] },

  // Generation 4 — Children
  { id: "son", name: "Arjun Sharma", relation: "Son", age: 19, gender: "M", conditions: ["Asthma"] },
  { id: "daughter", name: "Kavya Sharma", relation: "Daughter", age: 16, gender: "F", conditions: [] },
];

// ─── Condition → colour mapping ───────────────────────────────────────────────

const CONDITION_COLORS: Record<string, string> = {
  "Type 2 Diabetes": "bg-amber-500 text-white",
  "Pre-diabetes": "bg-yellow-500 text-black",
  "Hypertension": "bg-red-500 text-white",
  "Hypothyroidism": "bg-purple-500 text-white",
  "Dyslipidaemia": "bg-orange-500 text-white",
  "CAD": "bg-rose-600 text-white",
  "Osteoporosis": "bg-slate-500 text-white",
  "Cataract": "bg-sky-500 text-white",
  "Asthma": "bg-blue-500 text-white",
};

const DEFAULT_CONDITION_COLOR = "bg-[var(--surface)] text-[var(--foreground-muted)] border border-[var(--border)]";

// ─── SVG layout constants ─────────────────────────────────────────────────────

const NODE_W = 90;
const NODE_H = 50;
const V_GAP = 80;  // vertical gap between generations
const H_GAP = 16;  // horizontal gap between nodes
const CORNER_R = 8;

// Generation layout (x positions are relative centres)
const LAYOUT: Record<string, { cx: number; cy: number }> = {
  // Gen 1 (y=0)
  "gf-p":   { cx: 60,  cy: 0 },
  "gm-p":   { cx: 165, cy: 0 },
  "gf-m":   { cx: 510, cy: 0 },
  "gm-m":   { cx: 615, cy: 0 },
  // Gen 2 (y=1)
  "father": { cx: 112, cy: 1 },
  "mother": { cx: 325, cy: 1 },
  "uncle":  { cx: 460, cy: 1 },
  // Gen 3 (y=2) — patient row
  "patient":  { cx: 200, cy: 2 },
  "brother":  { cx: 330, cy: 2 },
  "sister":   { cx: 460, cy: 2 },
  // Gen 4 (y=3)
  "son":      { cx: 165, cy: 3 },
  "daughter": { cx: 270, cy: 3 },
};

const SVG_W = 700;
const SVG_BASE_Y = 40;

function nodeX(id: string) { return LAYOUT[id]?.cx ?? 100; }
function nodeY(id: string) { return SVG_BASE_Y + (LAYOUT[id]?.cy ?? 0) * (NODE_H + V_GAP); }
const SVG_H = SVG_BASE_Y + 3 * (NODE_H + V_GAP) + NODE_H + 20;

// ─── Member node ──────────────────────────────────────────────────────────────

function MemberNode({
  member,
  onSelect,
}: {
  member: FamilyMember;
  onSelect: (m: FamilyMember) => void;
}) {
  const x = nodeX(member.id);
  const y = nodeY(member.id);
  const topCond = member.conditions[0];
  const condColor = topCond
    ? (Object.keys(CONDITION_COLORS).includes(topCond) ? "stroke-amber-500" : "stroke-blue-500")
    : "stroke-[var(--border)]";

  const isPatient = member.isPatient;
  const isDeceased = member.deceased;
  const fill = isPatient ? "rgba(59,130,246,0.15)" : isDeceased ? "rgba(100,100,100,0.1)" : "rgba(30,30,30,0.6)";
  const strokeColor = isPatient ? "#3b82f6" : member.conditions.length > 1 ? "#f59e0b" : "#374151";

  return (
    <g
      transform={`translate(${x - NODE_W / 2}, ${y})`}
      onClick={() => onSelect(member)}
      className="cursor-pointer group"
    >
      <motion.rect
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        width={NODE_W}
        height={NODE_H}
        rx={CORNER_R}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={isPatient ? 2 : 1}
        className="transition-all group-hover:stroke-blue-400"
      />
      {isDeceased && (
        <line x1={0} y1={NODE_H} x2={NODE_W} y2={0} stroke="#6b7280" strokeWidth={1} strokeDasharray="4 3" className="pointer-events-none" />
      )}
      {/* Name */}
      <text
        x={NODE_W / 2}
        y={14}
        textAnchor="middle"
        fontSize={9}
        fontWeight={isPatient ? "700" : "500"}
        fill={isPatient ? "#93c5fd" : "#d1d5db"}
        className="pointer-events-none"
      >
        {member.name.split(" ")[0]}
      </text>
      {/* Age + relation */}
      <text
        x={NODE_W / 2}
        y={24}
        textAnchor="middle"
        fontSize={8}
        fill="#6b7280"
        className="pointer-events-none"
      >
        {member.age}y · {member.gender}
      </text>
      {/* Condition pills */}
      {member.conditions.slice(0, 2).map((cond, i) => {
        const shortLabel = cond.replace("Type 2 ", "T2").replace("Hypertension", "HTN").replace("Hypothyroidism", "Thyroid").replace("Dyslipidaemia", "Dyslipid").replace("Osteoporosis", "Osteo");
        return (
          <rect
            key={i}
            x={4 + i * 41}
            y={NODE_H - 15}
            width={38}
            height={11}
            rx={5}
            fill={cond === "Type 2 Diabetes" || cond === "Pre-diabetes" ? "rgba(245,158,11,0.3)" :
                  cond === "Hypertension" || cond === "CAD" ? "rgba(239,68,68,0.3)" :
                  cond === "Hypothyroidism" ? "rgba(168,85,247,0.3)" : "rgba(59,130,246,0.25)"}
            className="pointer-events-none"
          />
        );
      })}
      {member.conditions.slice(0, 2).map((cond, i) => {
        const shortLabel = cond.replace("Type 2 ", "T2").replace("Hypertension", "HTN").replace("Hypothyroidism", "Thyroid").replace("Dyslipidaemia", "Dyslip").replace("Osteoporosis", "Osteo");
        return (
          <text
            key={i}
            x={4 + i * 41 + 19}
            y={NODE_H - 6.5}
            textAnchor="middle"
            fontSize={7}
            fill={cond === "Hypertension" || cond === "CAD" ? "#fca5a5" :
                  cond === "Type 2 Diabetes" || cond === "Pre-diabetes" ? "#fcd34d" :
                  "#a5b4fc"}
            className="pointer-events-none"
          >
            {shortLabel.substring(0, 7)}
          </text>
        );
      })}
      {member.conditions.length > 2 && (
        <text x={NODE_W - 6} y={NODE_H - 6} textAnchor="end" fontSize={7} fill="#9ca3af" className="pointer-events-none">
          +{member.conditions.length - 2}
        </text>
      )}
    </g>
  );
}

// ─── Connector lines ──────────────────────────────────────────────────────────

const CONNECTIONS: Array<[string, string]> = [
  ["gf-p", "father"], ["gm-p", "father"],
  ["gf-m", "mother"], ["gm-m", "mother"],
  ["father", "patient"], ["father", "brother"], ["father", "sister"],
  ["mother", "patient"], ["mother", "brother"], ["mother", "sister"],
  ["patient", "son"], ["patient", "daughter"],
];

function Connectors() {
  return (
    <>
      {CONNECTIONS.map(([from, to], i) => {
        const x1 = nodeX(from);
        const y1 = nodeY(from) + NODE_H;
        const x2 = nodeX(to);
        const y2 = nodeY(to);
        const midY = (y1 + y2) / 2;
        return (
          <motion.path
            key={i}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            d={`M${x1} ${y1} C${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`}
            fill="none"
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="none"
          />
        );
      })}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FamilyHealthGraph() {
  const [selected, setSelected] = useState<FamilyMember | null>(null);

  // Aggregate condition frequency for legend
  const condCounts: Record<string, number> = {};
  FAMILY_DATA.forEach((m) => m.conditions.forEach((c) => { condCounts[c] = (condCounts[c] ?? 0) + 1; }));
  const topConditions = Object.entries(condCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <Card className="border-[var(--border)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/15">
            <GitBranch className="w-3.5 h-3.5 text-purple-400" />
          </div>
          Family Health Graph
          <Badge variant="secondary" className="ml-auto text-[9px]">{FAMILY_DATA.length} members</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Legend */}
        <div className="flex flex-wrap gap-1.5">
          {topConditions.map(([cond, count]) => (
            <div
              key={cond}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium",
                CONDITION_COLORS[cond] ?? DEFAULT_CONDITION_COLOR
              )}
            >
              <span>{cond}</span>
              <span className="opacity-70">×{count}</span>
            </div>
          ))}
        </div>

        {/* SVG Graph */}
        <div className="w-full overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <svg
            width={SVG_W}
            height={SVG_H}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="min-w-full"
          >
            <Connectors />
            {FAMILY_DATA.map((member) => (
              <MemberNode key={member.id} member={member} onSelect={setSelected} />
            ))}
          </svg>
        </div>

        {/* Legend labels */}
        <div className="flex items-center gap-4 text-[9px] text-[var(--foreground-subtle)]">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 border border-dashed border-[var(--foreground-subtle)]" />
            Deceased
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-blue-500" />
            Patient
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-amber-500" />
            2+ conditions
          </div>
          <span className="ml-auto italic">Click a node to view details</span>
        </div>

        {/* Member detail drawer */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{selected.name}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)]">
                    {selected.relation} · {selected.age}y · {selected.gender === "M" ? "Male" : "Female"}
                    {selected.deceased ? " · Deceased" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {selected.conditions.length > 0 ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)] font-semibold mb-1.5 flex items-center gap-1">
                    <HeartPulse className="w-3 h-3" /> Medical Conditions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.conditions.map((c) => (
                      <span
                        key={c}
                        className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", CONDITION_COLORS[c] ?? DEFAULT_CONDITION_COLOR)}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <span>✓</span> No known medical conditions
                </p>
              )}

              {selected.isPatient && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Info className="w-3 h-3 text-blue-400 shrink-0" />
                  <p className="text-[10px] text-blue-300">
                    Strong family history of T2DM and HTN — high genetic risk. Screen every 6 months.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
