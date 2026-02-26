"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
    ClipboardList, Search, Filter, Download, Calendar,
    Clock, User, Stethoscope, ChevronDown, ChevronRight,
    Activity, CheckCircle2, XCircle, AlertCircle, Video
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CONSULTATIONS = [
    { id: "CON-001", patient: "Priya Sharma", doctor: "Dr. Arjun Sharma", date: "Feb 15, 2026", time: "10:00 AM", duration: "32 min", type: "followup", mode: "in-person", status: "completed", diagnosis: "Type 2 Diabetes - Follow-up", icd: ["E11.9"], billing: 1200 },
    { id: "CON-002", patient: "Rajesh Kumar", doctor: "Dr. Arjun Sharma", date: "Feb 15, 2026", time: "10:45 AM", duration: "28 min", type: "general", mode: "in-person", status: "completed", diagnosis: "Acute Bronchitis", icd: ["J20.9"], billing: 800 },
    { id: "CON-003", patient: "Anita Verma", doctor: "Dr. Neha Patel", date: "Feb 15, 2026", time: "11:30 AM", duration: "—", type: "emergency", mode: "in-person", status: "active", diagnosis: "Chest Pain - Evaluation", icd: ["R07.9"], billing: 0 },
    { id: "CON-004", patient: "Mohan Das", doctor: "Dr. Arjun Sharma", date: "Feb 14, 2026", time: "2:00 PM", duration: "45 min", type: "followup", mode: "teleconsult", status: "completed", diagnosis: "Hypertension Management", icd: ["I10"], billing: 600 },
    { id: "CON-005", patient: "Sunita Rao", doctor: "Dr. Neha Patel", date: "Feb 14, 2026", time: "3:30 PM", duration: "22 min", type: "general", mode: "in-person", status: "completed", diagnosis: "Urinary Tract Infection", icd: ["N39.0"], billing: 700 },
    { id: "CON-006", patient: "Vikram Singh", doctor: "Dr. Rajesh Gupta", date: "Feb 14, 2026", time: "4:00 PM", duration: "55 min", type: "emergency", mode: "in-person", status: "completed", diagnosis: "Acute MI - STEMI", icd: ["I21.3"], billing: 15000 },
    { id: "CON-007", patient: "Lakshmi Nair", doctor: "Dr. Priya Desai", date: "Feb 13, 2026", time: "10:00 AM", duration: "35 min", type: "followup", mode: "teleconsult", status: "completed", diagnosis: "Hypothyroidism Follow-up", icd: ["E03.9"], billing: 500 },
    { id: "CON-008", patient: "Amit Patel", doctor: "Dr. Arjun Sharma", date: "Feb 13, 2026", time: "11:00 AM", duration: "18 min", type: "general", mode: "in-person", status: "cancelled", diagnosis: "—", icd: [], billing: 0 },
    { id: "CON-009", patient: "Deepa Joshi", doctor: "Dr. Neha Patel", date: "Feb 12, 2026", time: "9:30 AM", duration: "40 min", type: "followup", mode: "in-person", status: "completed", diagnosis: "Gestational Diabetes", icd: ["O24.4"], billing: 1100 },
    { id: "CON-010", patient: "Ravi Shankar", doctor: "Dr. Rajesh Gupta", date: "Feb 12, 2026", time: "1:00 PM", duration: "50 min", type: "followup", mode: "in-person", status: "completed", diagnosis: "Heart Failure Management", icd: ["I50.9"], billing: 2500 },
];

const STATUS_CONFIG = {
    active: { color: "text-green-400 bg-green-500/10 border-green-500/20", icon: Activity, label: "Active" },
    completed: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: CheckCircle2, label: "Completed" },
    cancelled: { color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle, label: "Cancelled" },
    draft: { color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: AlertCircle, label: "Draft" },
};

interface AdminConsultationsClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function AdminConsultationsClient({ user }: AdminConsultationsClientProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [consultations, setConsultations] = useState(MOCK_CONSULTATIONS);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/consultations');
                const data = await res.json();
                if (data.consultations?.length > 0) {
                    const mapped = data.consultations.map((c: Record<string, unknown>, i: number) => {
                        const patient = c.patient as { name?: string } | null;
                        const doctor = c.doctor as { name?: string } | null;
                        const emr = Array.isArray(c.emr_entries) && c.emr_entries.length > 0 ? c.emr_entries[0] : null;
                        const billing = Array.isArray(c.billing) && c.billing.length > 0 ? c.billing[0] : null;
                        return {
                            id: `CON-${String(i + 1).padStart(3, '0')}`,
                            patient: patient?.name ?? 'Patient',
                            doctor: doctor?.name ?? 'Doctor',
                            date: new Date(c.started_at as string).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                            time: new Date(c.started_at as string).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
                            duration: c.duration_sec ? `${Math.round(Number(c.duration_sec) / 60)} min` : '—',
                            type: (c.consultation_type ?? c.type ?? 'general') as string,
                            mode: (c.mode ?? 'in-person') as string,
                            status: (c.status ?? 'active') as string,
                            diagnosis: (emr?.chief_complaint ?? c.chief_complaint ?? '—') as string,
                            icd: ((emr?.icd_codes ?? []) as Array<{ code: string }>).map(ic => ic.code),
                            billing: billing ? Number(billing.total ?? 0) : 0,
                        };
                    });
                    setConsultations(mapped);
                }
            } catch { /* keep mock data */ }
        }
        fetchData();
    }, []);

    const filtered = useMemo(() => {
        return consultations.filter((c) => {
            const matchesSearch =
                c.patient.toLowerCase().includes(search.toLowerCase()) ||
                c.doctor.toLowerCase().includes(search.toLowerCase()) ||
                c.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
                c.id.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === "all" || c.status === statusFilter;
            const matchesType = typeFilter === "all" || c.type === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [search, statusFilter, typeFilter, consultations]);

    // Stats
    const totalToday = consultations.filter((c) => {
        const today = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        return c.date === today;
    }).length;
    const activeCount = consultations.filter((c) => c.status === "active").length;
    const totalRevenue = consultations.reduce((sum, c) => sum + c.billing, 0);

    const handleExport = () => {
        const csv = [
            ["ID", "Patient", "Doctor", "Date", "Time", "Type", "Status", "Diagnosis", "ICD", "Billing"].join(","),
            ...filtered.map((c) =>
                [c.id, c.patient, c.doctor, c.date, c.time, c.type, c.status, `"${c.diagnosis}"`, `"${c.icd.join(";")}"`, c.billing].join(",")
            ),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "consultations_export.csv";
        a.click();
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">All Consultations</h1>
                    <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                        Monitor, search, and manage all patient consultations
                    </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
                    <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Total Consultations", value: consultations.length.toString(), color: "text-blue-400", bg: "bg-blue-500/10" },
                    { label: "Today", value: totalToday.toString(), color: "text-green-400", bg: "bg-green-500/10" },
                    { label: "Active Now", value: activeCount.toString(), color: "text-amber-400", bg: "bg-amber-500/10" },
                    { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString()}`, color: "text-purple-400", bg: "bg-purple-500/10" },
                ].map((stat) => (
                    <Card key={stat.label}>
                        <CardContent className="p-3 text-center">
                            <p className="text-[10px] text-[var(--foreground-subtle)]">{stat.label}</p>
                            <p className={`text-lg font-bold ${stat.color} mt-0.5`}>{stat.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by patient, doctor, diagnosis, or ID..."
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50"
                >
                    <option value="all">All Types</option>
                    <option value="general">General</option>
                    <option value="followup">Follow-up</option>
                    <option value="emergency">Emergency</option>
                    <option value="teleconsult">Teleconsult</option>
                </select>
                <Badge variant="secondary" className="text-[10px] shrink-0">{filtered.length} results</Badge>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {/* Table header */}
                    <div className="grid grid-cols-[80px_1fr_1fr_100px_80px_90px_80px_100px] gap-2 px-4 py-2.5 border-b border-[var(--border)] text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider font-semibold">
                        <span>ID</span>
                        <span>Patient</span>
                        <span>Doctor</span>
                        <span>Date</span>
                        <span>Type</span>
                        <span>Status</span>
                        <span>Billing</span>
                        <span>Diagnosis</span>
                    </div>

                    {/* Table rows */}
                    {filtered.map((c, i) => {
                        const isExpanded = expandedId === c.id;
                        const statusCfg = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
                        const StatusIcon = statusCfg.icon;

                        return (
                            <motion.div
                                key={c.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.02 }}
                            >
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                    className="w-full grid grid-cols-[80px_1fr_1fr_100px_80px_90px_80px_100px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-colors text-left items-center"
                                >
                                    <span className="text-[10px] font-mono text-[var(--foreground-subtle)]">{c.id}</span>
                                    <span className="text-xs font-medium text-[var(--foreground)] truncate">{c.patient}</span>
                                    <span className="text-xs text-[var(--foreground-muted)] truncate">{c.doctor}</span>
                                    <span className="text-[10px] text-[var(--foreground-muted)]">{c.date.replace(", 2026", "")}</span>
                                    <span className="flex items-center gap-1">
                                        {c.mode === "teleconsult" && <Video className="w-3 h-3 text-purple-400" />}
                                        <span className="text-[10px] text-[var(--foreground-muted)] capitalize">{c.type}</span>
                                    </span>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {statusCfg.label}
                                    </span>
                                    <span className="text-xs font-medium text-[var(--foreground)]">{c.billing > 0 ? `₹${c.billing.toLocaleString()}` : "—"}</span>
                                    <span className="text-[10px] text-[var(--foreground-muted)] truncate">{c.diagnosis}</span>
                                </button>

                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="bg-[var(--surface-elevated)] border-b border-[var(--border)] px-4 py-3"
                                    >
                                        <div className="grid grid-cols-4 gap-4 text-xs">
                                            <div>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] uppercase mb-0.5">Duration</p>
                                                <p className="text-[var(--foreground)] flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] uppercase mb-0.5">ICD Codes</p>
                                                <div className="flex gap-1">
                                                    {c.icd.length > 0 ? c.icd.map((code) => (
                                                        <Badge key={code} variant="secondary" className="text-[9px]">{code}</Badge>
                                                    )) : <span className="text-[var(--foreground-subtle)]">—</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] uppercase mb-0.5">Mode</p>
                                                <p className="text-[var(--foreground)] capitalize">{c.mode}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] uppercase mb-0.5">Time</p>
                                                <p className="text-[var(--foreground)]">{c.time}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
