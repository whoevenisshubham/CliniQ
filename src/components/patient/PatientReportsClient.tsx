"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    FileText, Search, Calendar, ChevronDown, ChevronRight,
    Activity, Pill, TrendingUp, Download, Filter, Heart,
    Thermometer, Droplets, Scale, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Area, AreaChart
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────
interface ConsultationReport {
    id: string;
    date: string;
    doctor: string;
    department: string;
    type: string;
    diagnosis: string[];
    icd_codes: string[];
    chief_complaint: string;
    vitals: { bp: string; hr: number; temp: number; spo2: number; weight: number };
    medications: string[];
    lab_tests: string[];
    summary: string;
    status: "completed" | "active" | "draft";
}

// ─── Fallback mock data ─────────────────────────────────────────────────────
const MOCK_CONSULTATIONS: ConsultationReport[] = [
    {
        id: "c1", date: "Feb 15, 2026", doctor: "Dr. Arjun Sharma",
        department: "Internal Medicine", type: "followup",
        diagnosis: ["Type 2 Diabetes - Follow-up"], icd_codes: ["E11.9"],
        chief_complaint: "Uncontrolled blood sugar, fatigue",
        vitals: { bp: "138/88", hr: 78, temp: 98.4, spo2: 97, weight: 68 },
        medications: ["Metformin 500mg — Twice daily", "Amlodipine 5mg — Once daily"],
        lab_tests: ["HbA1c — 7.2%", "Fasting glucose — 142 mg/dL", "Lipid panel — Normal"],
        summary: "Patient's blood sugar levels remain above target. Metformin dosage maintained, lifestyle modifications emphasized.",
        status: "completed",
    },
    {
        id: "c2", date: "Jan 20, 2026", doctor: "Dr. Arjun Sharma",
        department: "Internal Medicine", type: "followup",
        diagnosis: ["Hypertension Management"], icd_codes: ["I10"],
        chief_complaint: "BP monitoring, dizziness",
        vitals: { bp: "144/92", hr: 82, temp: 98.2, spo2: 98, weight: 69 },
        medications: ["Amlodipine 5mg — Once daily", "Atorvastatin 10mg — Once at night"],
        lab_tests: ["Serum Creatinine — 0.9 mg/dL", "Electrolytes — Normal"],
        summary: "Blood pressure elevated. Amlodipine dose maintained, added dietary sodium restriction counseling.",
        status: "completed",
    },
    {
        id: "c3", date: "Dec 10, 2025", doctor: "Dr. Neha Patel",
        department: "General Medicine", type: "general",
        diagnosis: ["Seasonal Flu", "Viral Upper Respiratory Infection"], icd_codes: ["J06.9", "J11.1"],
        chief_complaint: "Fever, body ache, cough for 3 days",
        vitals: { bp: "130/84", hr: 88, temp: 100.8, spo2: 96, weight: 68.5 },
        medications: ["Paracetamol 500mg — As needed", "Cetirizine 10mg — Once daily"],
        lab_tests: ["CBC — Mild lymphocytosis", "CRP — 12 mg/L (elevated)"],
        summary: "Viral illness, symptomatic management prescribed. Advised rest and hydration.",
        status: "completed",
    },
];

const HEALTH_TRENDS = [
    { month: "Aug", bp_systolic: 132, bp_diastolic: 84, blood_sugar: 168, weight: 71 },
    { month: "Sep", bp_systolic: 134, bp_diastolic: 85, blood_sugar: 172, weight: 70.5 },
    { month: "Oct", bp_systolic: 136, bp_diastolic: 86, blood_sugar: 186, weight: 70 },
    { month: "Nov", bp_systolic: 140, bp_diastolic: 88, blood_sugar: 162, weight: 69.5 },
    { month: "Dec", bp_systolic: 130, bp_diastolic: 84, blood_sugar: 155, weight: 68.5 },
    { month: "Jan", bp_systolic: 144, bp_diastolic: 92, blood_sugar: 148, weight: 69 },
    { month: "Feb", bp_systolic: 138, bp_diastolic: 88, blood_sugar: 142, weight: 68 },
];

interface PatientReportsClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function PatientReportsClient({ user }: PatientReportsClientProps) {
    const [consultations, setConsultations] = useState<ConsultationReport[]>(MOCK_CONSULTATIONS);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeChart, setActiveChart] = useState<"bp" | "sugar" | "weight">("bp");

    // Fetch from real API, fall back to mock data
    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/patients/${user.id}/consultations`);
                const data = await res.json();
                if (data.consultations?.length > 0) {
                    // Transform DB format to component format
                    const mapped: ConsultationReport[] = data.consultations.map((c: Record<string, unknown>) => {
                        const emr = Array.isArray(c.emr_entries) && c.emr_entries.length > 0 ? c.emr_entries[0] : null;
                        const doctor = c.doctor as { name?: string; department?: string } | null;
                        const vitals = (emr?.vitals ?? {}) as Record<string, number>;
                        const meds = (emr?.medications ?? []) as Array<{ name: string; dosage: string; frequency: string }>;
                        return {
                            id: c.id as string,
                            date: new Date(c.started_at as string).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
                            doctor: doctor?.name ?? "Doctor",
                            department: doctor?.department ?? "",
                            type: (c.consultation_type ?? c.type ?? "general") as string,
                            diagnosis: (emr?.diagnosis ?? []) as string[],
                            icd_codes: ((emr?.icd_codes ?? []) as Array<{ code: string }>).map((ic) => ic.code),
                            chief_complaint: (emr?.chief_complaint ?? c.chief_complaint ?? "") as string,
                            vitals: {
                                bp: `${vitals.bp_systolic ?? "-"}/${vitals.bp_diastolic ?? "-"}`,
                                hr: vitals.heart_rate ?? 0,
                                temp: vitals.temperature ?? 0,
                                spo2: vitals.spo2 ?? 0,
                                weight: vitals.weight ?? 0,
                            },
                            medications: meds.map((m) => `${m.name} ${m.dosage} — ${m.frequency}`),
                            lab_tests: (emr?.lab_tests_ordered ?? []) as string[],
                            summary: (emr?.physical_examination ?? "") as string,
                            status: (c.status ?? "completed") as "completed" | "active" | "draft",
                        };
                    });
                    setConsultations(mapped);
                }
            } catch {
                // Keep mock data on error
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user.id]);

    const filtered = consultations.filter(
        (c) =>
            c.diagnosis.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase())) ||
            c.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.chief_complaint.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-[var(--foreground)]">My Reports</h1>
                <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                    Consultation history, lab results, and health trends
                </p>
            </div>

            {/* Health Trends */}
            <Card className="border-blue-500/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            Health Trends
                        </CardTitle>
                        <div className="flex gap-1">
                            {([
                                { key: "bp", label: "Blood Pressure", icon: Heart },
                                { key: "sugar", label: "Blood Sugar", icon: Droplets },
                                { key: "weight", label: "Weight", icon: Scale },
                            ] as const).map((t) => (
                                <Button
                                    key={t.key}
                                    variant={activeChart === t.key ? "default" : "ghost"}
                                    size="sm"
                                    className="text-[10px] h-7 px-2 gap-1"
                                    onClick={() => setActiveChart(t.key)}
                                >
                                    <t.icon className="w-3 h-3" />
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            {activeChart === "bp" ? (
                                <AreaChart data={HEALTH_TRENDS}>
                                    <defs>
                                        <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="month" tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} domain={[70, 160]} />
                                    <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                                    <Area type="monotone" dataKey="bp_systolic" stroke="#ef4444" fill="url(#bpGrad)" strokeWidth={2} name="Systolic" />
                                    <Line type="monotone" dataKey="bp_diastolic" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Diastolic" />
                                </AreaChart>
                            ) : activeChart === "sugar" ? (
                                <AreaChart data={HEALTH_TRENDS}>
                                    <defs>
                                        <linearGradient id="sugarGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="month" tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                                    <Area type="monotone" dataKey="blood_sugar" stroke="#3b82f6" fill="url(#sugarGrad)" strokeWidth={2} name="Fasting Glucose (mg/dL)" />
                                </AreaChart>
                            ) : (
                                <LineChart data={HEALTH_TRENDS}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="month" tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} domain={[65, 75]} />
                                    <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                                    <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: "#22c55e" }} name="Weight (kg)" />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by diagnosis, doctor, or complaint..."
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>
                <Badge variant="secondary" className="text-[10px]">
                    {filtered.length} report{filtered.length !== 1 ? "s" : ""}
                </Badge>
            </div>

            {/* Consultation list */}
            <div className="space-y-3">
                {filtered.map((c, i) => {
                    const isExpanded = expandedId === c.id;
                    return (
                        <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className={`transition-colors ${isExpanded ? "border-blue-500/30" : ""}`}>
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                    className="w-full text-left"
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <FileText className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-semibold text-[var(--foreground)] truncate">
                                                        {c.diagnosis.join(", ")}
                                                    </p>
                                                    {c.icd_codes.map((code) => (
                                                        <Badge key={code} variant="secondary" className="text-[8px] shrink-0">
                                                            {code}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
                                                    {c.doctor} · {c.department} · {c.date}
                                                </p>
                                            </div>
                                            <Badge variant={c.type === "followup" ? "default" : "secondary"} className="text-[9px] shrink-0">
                                                {c.type}
                                            </Badge>
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-[var(--foreground-subtle)]" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-[var(--foreground-subtle)]" />
                                            )}
                                        </div>
                                    </CardContent>
                                </button>

                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="border-t border-[var(--border)]"
                                    >
                                        <CardContent className="p-4 space-y-4">
                                            {/* Chief complaint */}
                                            <div>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-1">Chief Complaint</p>
                                                <p className="text-xs text-[var(--foreground)]">{c.chief_complaint}</p>
                                            </div>

                                            {/* Vitals grid */}
                                            <div>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-2">Vitals</p>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {[
                                                        { label: "BP", value: c.vitals.bp, icon: Heart, color: "text-red-400" },
                                                        { label: "HR", value: `${c.vitals.hr} bpm`, icon: Activity, color: "text-green-400" },
                                                        { label: "Temp", value: `${c.vitals.temp}°F`, icon: Thermometer, color: "text-amber-400" },
                                                        { label: "SpO2", value: `${c.vitals.spo2}%`, icon: Droplets, color: "text-blue-400" },
                                                        { label: "Weight", value: `${c.vitals.weight} kg`, icon: Scale, color: "text-purple-400" },
                                                    ].map((v) => (
                                                        <div key={v.label} className="bg-[var(--surface)] rounded-lg p-2 text-center">
                                                            <v.icon className={`w-3 h-3 mx-auto ${v.color}`} />
                                                            <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">{v.label}</p>
                                                            <p className="text-xs font-semibold text-[var(--foreground)]">{v.value}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Medications */}
                                                <div>
                                                    <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-1">Medications</p>
                                                    {c.medications.map((m, i) => (
                                                        <div key={i} className="flex items-center gap-2 py-1">
                                                            <Pill className="w-3 h-3 text-green-400 shrink-0" />
                                                            <span className="text-xs text-[var(--foreground)]">{m}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Lab Tests */}
                                                <div>
                                                    <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-1">Lab Results</p>
                                                    {c.lab_tests.map((t, i) => (
                                                        <div key={i} className="flex items-center gap-2 py-1">
                                                            <Activity className="w-3 h-3 text-blue-400 shrink-0" />
                                                            <span className="text-xs text-[var(--foreground)]">{t}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Summary */}
                                            <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                                                <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Clinical Summary</p>
                                                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{c.summary}</p>
                                            </div>

                                            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                                <Download className="w-3 h-3" /> Download Report
                                            </Button>
                                        </CardContent>
                                    </motion.div>
                                )}
                            </Card>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
