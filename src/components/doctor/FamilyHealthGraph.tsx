"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, GitBranch, Info, X, HeartPulse, Loader2 } from "lucide-react";
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
  is_patient?: boolean; // from DB column
  parent_id?: string | null;
  generation?: number;
}

// ─── Fallback data (used when DB is unavailable) ─────────────────────────────

const FALLBACK_FAMILY_DATA: FamilyMember[] = [
  // Generation 0 — Grandparents
  { id: "gf-p", name: "Krishnarao Sharma", relation: "Paternal Grandfather", age: 82, gender: "M", conditions: ["Type 2 Diabetes", "Hypertension"], deceased: true, generation: 0 },
  { id: "gm-p", name: "Saraswati Sharma", relation: "Paternal Grandmother", age: 78, gender: "F", conditions: ["Hypertension", "Osteoporosis"], generation: 0 },
  { id: "gf-m", name: "Shivaji Patel", relation: "Maternal Grandfather", age: 80, gender: "M", conditions: ["CAD", "Type 2 Diabetes"], deceased: true, generation: 0 },
  { id: "gm-m", name: "Kamala Patel", relation: "Maternal Grandmother", age: 75, gender: "F", conditions: ["Type 2 Diabetes", "Cataract"], generation: 0 },
  // Generation 1 — Parents
  { id: "father", name: "Suresh Sharma", relation: "Father", age: 58, gender: "M", conditions: ["Type 2 Diabetes", "Hypertension", "Dyslipidaemia"], parent_id: "gf-p", generation: 1 },
  { id: "mother", name: "Sunita Sharma", relation: "Mother", age: 54, gender: "F", conditions: ["Hypothyroidism", "Hypertension"], parent_id: "gf-m", generation: 1 },
  { id: "uncle", name: "Vijay Sharma", relation: "Paternal Uncle", age: 52, gender: "M", conditions: ["Type 2 Diabetes", "CAD"], parent_id: "gf-p", generation: 1 },
  // Generation 2 — Patient + Siblings
  { id: "patient", name: "Priya Sharma", relation: "Patient", age: 45, gender: "F", conditions: ["Type 2 Diabetes", "Hypertension"], isPatient: true, parent_id: "father", generation: 2 },
  { id: "brother", name: "Rahul Sharma", relation: "Brother", age: 42, gender: "M", conditions: ["Pre-diabetes", "Hypertension"], parent_id: "father", generation: 2 },
  { id: "sister", name: "Neha Sharma", relation: "Sister", age: 38, gender: "F", conditions: ["Hypothyroidism"], parent_id: "father", generation: 2 },
  // Generation 3 — Children
  { id: "son", name: "Arjun Sharma", relation: "Son", age: 19, gender: "M", conditions: ["Asthma"], parent_id: "patient", generation: 3 },
  { id: "daughter", name: "Kavya Sharma", relation: "Daughter", age: 16, gender: "F", conditions: [], parent_id: "patient", generation: 3 },
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
const V_GAP = 80;
const CORNER_R = 8;

const SVG_W = 700;
const SVG_BASE_Y = 40;
const SVG_H = SVG_BASE_Y + 3 * (NODE_H + V_GAP) + NODE_H + 20;

// ─── Auto-layout calculator ──────────────────────────────────────────────────

function calculateLayout(members: FamilyMember[]): Record<string, { cx: number; cy: number }> {
  // Group members by generation
  const generations: Record<number, FamilyMember[]> = {};
  members.forEach((m) => {
    const gen = m.generation ?? 0;
    if (!generations[gen]) generations[gen] = [];
    generations[gen].push(m);
  });

  const layout: Record<string, { cx: number; cy: number }> = {};
  const genKeys = Object.keys(generations).map(Number).sort((a, b) => a - b);

  genKeys.forEach((gen) => {
    const genMembers = generations[gen];
    const totalWidth = genMembers.length * (NODE_W + 16) - 16;
    const startX = (SVG_W - totalWidth) / 2 + NODE_W / 2;

    genMembers.forEach((member, idx) => {
      layout[member.id] = {
        cx: startX + idx * (NODE_W + 16),
        cy: gen,
      };
    });
  });

  return layout;
}

// ─── Derive connections from parent_id ───────────────────────────────────────

function deriveConnections(members: FamilyMember[]): Array<[string, string]> {
  const connections: Array<[string, string]> = [];
  const memberIds = new Set(members.map((m) => m.id));

  members.forEach((member) => {
    if (member.parent_id && memberIds.has(member.parent_id)) {
      connections.push([member.parent_id, member.id]);
    }
  });

  // Also add spouse connections for parents (grandparents paired, parents paired)
  const gen0 = members.filter((m) => (m.generation ?? 0) === 0);
  const gen1 = members.filter((m) => (m.generation ?? 0) === 1);

  // Pair grandparents: paternal pair, maternal pair
  const paternalGP = gen0.filter((m) => m.relation.includes("Paternal"));
  const maternalGP = gen0.filter((m) => m.relation.includes("Maternal"));

  // Connect both paternal grandparents to father
  const father = gen1.find((m) => m.relation === "Father");
  const mother = gen1.find((m) => m.relation === "Mother");

  if (father) {
    paternalGP.forEach((gp) => {
      if (!connections.some(([f, t]) => f === gp.id && t === father.id)) {
        connections.push([gp.id, father.id]);
      }
    });
  }
  if (mother) {
    maternalGP.forEach((gp) => {
      if (!connections.some(([f, t]) => f === gp.id && t === mother.id)) {
        connections.push([gp.id, mother.id]);
      }
    });

    // Connect mother to patient's siblings too
    const gen2 = members.filter((m) => (m.generation ?? 0) === 2);
    gen2.forEach((child) => {
      if (!connections.some(([f, t]) => f === mother.id && t === child.id)) {
        connections.push([mother.id, child.id]);
      }
    });
  }

  return connections;
}

// ─── Member node ──────────────────────────────────────────────────────────────

function MemberNode({
  member,
  layout,
  onSelect,
}: {
  member: FamilyMember;
  layout: Record<string, { cx: number; cy: number }>;
  onSelect: (m: FamilyMember) => void;
}) {
  const pos = layout[member.id];
  if (!pos) return null;

  const x = pos.cx;
  const y = SVG_BASE_Y + pos.cy * (NODE_H + V_GAP);

  const isPatient = member.isPatient || member.is_patient;
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
      {/* Age + gender */}
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
      {member.conditions.slice(0, 2).map((cond, i) => (
        <rect
          key={`bg-${i}`}
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
      ))}
      {member.conditions.slice(0, 2).map((cond, i) => {
        const shortLabel = cond.replace("Type 2 ", "T2").replace("Hypertension", "HTN").replace("Hypothyroidism", "Thyroid").replace("Dyslipidaemia", "Dyslip").replace("Osteoporosis", "Osteo");
        return (
          <text
            key={`txt-${i}`}
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

function Connectors({
  connections,
  layout,
}: {
  connections: Array<[string, string]>;
  layout: Record<string, { cx: number; cy: number }>;
}) {
  return (
    <>
      {connections.map(([from, to], i) => {
        const fromPos = layout[from];
        const toPos = layout[to];
        if (!fromPos || !toPos) return null;

        const x1 = fromPos.cx;
        const y1 = SVG_BASE_Y + fromPos.cy * (NODE_H + V_GAP) + NODE_H;
        const x2 = toPos.cx;
        const y2 = SVG_BASE_Y + toPos.cy * (NODE_H + V_GAP);
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
          />
        );
      })}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FamilyHealthGraphProps {
  patientId?: string;
}

export function FamilyHealthGraph({ patientId }: FamilyHealthGraphProps) {
  const [familyData, setFamilyData] = useState<FamilyMember[]>(FALLBACK_FAMILY_DATA);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<"fallback" | "database">("fallback");
  const [selected, setSelected] = useState<FamilyMember | null>(null);

  // Fetch from DB if patientId is provided
  useEffect(() => {
    if (!patientId) return;

    async function fetchFamily() {
      setLoading(true);
      try {
        const res = await fetch(`/api/family?patient_id=${patientId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.members && data.members.length > 0) {
            // Normalize DB fields to component fields
            const normalized: FamilyMember[] = data.members.map((m: Record<string, unknown>) => ({
              ...m,
              isPatient: m.is_patient ?? false,
              conditions: m.conditions ?? [],
            }));
            setFamilyData(normalized);
            setDataSource("database");
          }
        }
      } catch {
        // Silently fall back to hardcoded data
      } finally {
        setLoading(false);
      }
    }

    fetchFamily();
  }, [patientId]);

  // Calculate layout and connections dynamically
  const layout = calculateLayout(familyData);
  const connections = deriveConnections(familyData);

  // Aggregate condition frequency for legend
  const condCounts: Record<string, number> = {};
  familyData.forEach((m) => m.conditions.forEach((c) => { condCounts[c] = (condCounts[c] ?? 0) + 1; }));
  const topConditions = Object.entries(condCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <Card className="border-[var(--border)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/15">
            <GitBranch className="w-3.5 h-3.5 text-purple-400" />
          </div>
          Family Health Graph
          <Badge variant="secondary" className="ml-auto text-[9px]">{familyData.length} members</Badge>
          {dataSource === "database" && (
            <Badge variant="outline" className="text-[9px] text-green-400 border-green-500/30">DB</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            <p className="text-xs text-[var(--foreground-subtle)]">Loading family data...</p>
          </div>
        ) : (
          <>
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
                <Connectors connections={connections} layout={layout} />
                {familyData.map((member) => (
                  <MemberNode key={member.id} member={member} layout={layout} onSelect={setSelected} />
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

                  {(selected.isPatient || selected.is_patient) && (
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
