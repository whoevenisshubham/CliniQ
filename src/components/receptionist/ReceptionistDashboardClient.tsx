"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Search, Plus, UserPlus, ClipboardList, HeartPulse,
    Clock, Phone, Calendar, X, Check, AlertTriangle,
    ChevronRight, Activity, Stethoscope, Thermometer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueEntry {
    id: string;
    patient_id: string;
    patient_name: string;
    doctor_id: string;
    doctor_name: string;
    queue_number: number;
    status: string;
    priority: string;
    check_in_time: string;
    start_time: string | null;
    reason: string;
    visit_type: string;
    vitals_recorded: Record<string, number>;
}

interface PatientResult {
    id: string;
    user_id: string;
    name: string;
    phone: string;
    dob: string;
    gender: string;
    blood_group: string;
    abha_id: string;
    allergies: string[];
    chronic_conditions: string[];
}

interface ReceptionistDashboardClientProps {
    user: { id: string; name: string; email: string; role: string };
}

const PRIORITY_CONFIG = {
    normal: { color: "text-green-400 bg-green-500/10 border-green-500/20", label: "Normal" },
    urgent: { color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Urgent" },
    emergency: { color: "text-red-400 bg-red-500/10 border-red-500/20", label: "Emergency" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    waiting: { color: "text-amber-400 bg-amber-500/10", label: "Waiting" },
    "in-consultation": { color: "text-blue-400 bg-blue-500/10", label: "In Consultation" },
    completed: { color: "text-green-400 bg-green-500/10", label: "Completed" },
    "no-show": { color: "text-red-400 bg-red-500/10", label: "No Show" },
};

const DOCTORS = [
    { id: "demo-doctor-001", name: "Dr. Arjun Sharma", department: "Internal Medicine" },
    { id: "demo-doctor-002", name: "Dr. Neha Patel", department: "General Medicine" },
];

export function ReceptionistDashboardClient({ user }: ReceptionistDashboardClientProps) {
    const [activeTab, setActiveTab] = useState<"queue" | "register" | "vitals">("queue");
    const [queue, setQueue] = useState<QueueEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Registration form
    const [regForm, setRegForm] = useState({
        name: "", phone: "", dob: "", gender: "M", blood_group: "",
        abha_id: "", allergies: "", chronic_conditions: "", emergency_contact: "",
    });

    // Queue form
    const [queueForm, setQueueForm] = useState({
        patient_id: "", patient_name: "", doctor_id: DOCTORS[0].id,
        doctor_name: DOCTORS[0].name, priority: "normal", reason: "", visit_type: "walk-in",
    });
    const [showQueueForm, setShowQueueForm] = useState(false);

    // Vitals form
    const [vitalsForm, setVitalsForm] = useState({
        bp_systolic: "", bp_diastolic: "", heart_rate: "", temperature: "", spo2: "", weight: "", height: "",
    });
    const [vitalsQueueId, setVitalsQueueId] = useState<string | null>(null);

    // Fetch queue
    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch("/api/queue");
            const data = await res.json();
            if (data.queue) setQueue(data.queue);
        } catch { /* fallback */ }
    }, []);

    useEffect(() => { fetchQueue(); const interval = setInterval(fetchQueue, 10000); return () => clearInterval(interval); }, [fetchQueue]);

    // Search patients
    const handleSearch = useCallback(async (q: string) => {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setSearchResults(data.patients ?? []);
        } catch { setSearchResults([]); }
        setIsSearching(false);
    }, []);

    // Register patient
    const handleRegister = async () => {
        if (!regForm.name || !regForm.phone) return;
        try {
            const res = await fetch("/api/patients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...regForm,
                    allergies: regForm.allergies ? regForm.allergies.split(",").map(s => s.trim()) : [],
                    chronic_conditions: regForm.chronic_conditions ? regForm.chronic_conditions.split(",").map(s => s.trim()) : [],
                }),
            });
            const data = await res.json();
            if (data.patient) {
                setQueueForm(prev => ({
                    ...prev,
                    patient_id: data.patient.user_id,
                    patient_name: regForm.name,
                }));
                setShowQueueForm(true);
                setActiveTab("queue");
                setRegForm({ name: "", phone: "", dob: "", gender: "M", blood_group: "", abha_id: "", allergies: "", chronic_conditions: "", emergency_contact: "" });
            }
        } catch { /* error */ }
    };

    // Add to queue
    const handleAddToQueue = async () => {
        if (!queueForm.patient_name) return;
        try {
            await fetch("/api/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...queueForm, registered_by: user.id }),
            });
            setShowQueueForm(false);
            setQueueForm({ patient_id: "", patient_name: "", doctor_id: DOCTORS[0].id, doctor_name: DOCTORS[0].name, priority: "normal", reason: "", visit_type: "walk-in" });
            fetchQueue();
        } catch { /* error */ }
    };

    // Save vitals
    const handleSaveVitals = async () => {
        if (!vitalsQueueId) return;
        const vitals: Record<string, number> = {};
        Object.entries(vitalsForm).forEach(([k, v]) => { if (v) vitals[k] = parseFloat(v); });

        try {
            await fetch("/api/queue", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: vitalsQueueId, vitals_recorded: vitals }),
            });
            setVitalsQueueId(null);
            setVitalsForm({ bp_systolic: "", bp_diastolic: "", heart_rate: "", temperature: "", spo2: "", weight: "", height: "" });
            fetchQueue();
        } catch { /* error */ }
    };

    // Select from search results to add to queue
    const selectPatient = (p: PatientResult) => {
        setQueueForm(prev => ({ ...prev, patient_id: p.user_id, patient_name: p.name }));
        setShowQueueForm(true);
        setSearchQuery("");
        setSearchResults([]);
        setActiveTab("queue");
    };

    // Stats
    const waitingCount = queue.filter(q => q.status === "waiting").length;
    const inConsultCount = queue.filter(q => q.status === "in-consultation").length;
    const completedCount = queue.filter(q => q.status === "completed").length;

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">Front Desk</h1>
                    <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                        Patient registration, queue management & vitals
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => setShowQueueForm(true)}>
                        <Plus className="w-3.5 h-3.5" /> Add to Queue
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveTab("register")}>
                        <UserPlus className="w-3.5 h-3.5" /> Register Patient
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Total Today", value: queue.length.toString(), color: "text-blue-400", bg: "bg-blue-500/10", icon: ClipboardList },
                    { label: "Waiting", value: waitingCount.toString(), color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock },
                    { label: "In Consultation", value: inConsultCount.toString(), color: "text-green-400", bg: "bg-green-500/10", icon: Activity },
                    { label: "Completed", value: completedCount.toString(), color: "text-purple-400", bg: "bg-purple-500/10", icon: Check },
                ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label}>
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                                    <Icon className={`w-4 h-4 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-[var(--foreground-subtle)]">{stat.label}</p>
                                    <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Patient Search */}
            <Card>
                <CardContent className="p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search patient by name, phone, or ABHA ID..."
                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                            {searchResults.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => selectPatient(p)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors text-left"
                                >
                                    <Avatar className="w-7 h-7 shrink-0">
                                        <AvatarFallback className="text-[10px]">{getInitials(p.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-[var(--foreground)]">{p.name}</p>
                                        <p className="text-[10px] text-[var(--foreground-subtle)]">{p.phone} · {p.gender} · {p.blood_group}</p>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                                </button>
                            ))}
                        </div>
                    )}
                    {isSearching && <p className="text-[10px] text-[var(--foreground-subtle)] mt-2">Searching...</p>}
                    {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                        <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                            <p className="text-xs text-amber-400">No patient found</p>
                            <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => { setRegForm(prev => ({ ...prev, name: searchQuery })); setActiveTab("register"); }}>
                                Register New
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex bg-[var(--surface)] rounded-lg p-0.5 border border-[var(--border)] w-fit">
                {[
                    { key: "queue", label: `Patient Queue (${waitingCount})`, icon: ClipboardList },
                    { key: "register", label: "Register New Patient", icon: UserPlus },
                ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as "queue" | "register")}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all ${activeTab === tab.key
                                    ? "bg-blue-600 text-white shadow"
                                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Add to Queue Form */}
            <AnimatePresence>
                {showQueueForm && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        <Card className="border-blue-500/30">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2"><Plus className="w-4 h-4 text-blue-400" />Add to Queue</span>
                                    <button onClick={() => setShowQueueForm(false)}><X className="w-4 h-4 text-[var(--foreground-subtle)]" /></button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Patient Name</label>
                                        <input value={queueForm.patient_name} onChange={(e) => setQueueForm({ ...queueForm, patient_name: e.target.value })} placeholder="Patient name" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Doctor</label>
                                        <select value={queueForm.doctor_id} onChange={(e) => { const d = DOCTORS.find(d => d.id === e.target.value); setQueueForm({ ...queueForm, doctor_id: e.target.value, doctor_name: d?.name ?? "" }); }} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                            {DOCTORS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Priority</label>
                                        <select value={queueForm.priority} onChange={(e) => setQueueForm({ ...queueForm, priority: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                            <option value="normal">Normal</option>
                                            <option value="urgent">Urgent</option>
                                            <option value="emergency">Emergency</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Visit Type</label>
                                        <select value={queueForm.visit_type} onChange={(e) => setQueueForm({ ...queueForm, visit_type: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                            <option value="walk-in">Walk-in</option>
                                            <option value="appointment">Appointment</option>
                                            <option value="emergency">Emergency</option>
                                            <option value="referral">Referral</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Reason / Chief Complaint</label>
                                    <input value={queueForm.reason} onChange={(e) => setQueueForm({ ...queueForm, reason: e.target.value })} placeholder="E.g., Fever for 3 days, follow-up for diabetes..." className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                                </div>
                                <Button size="sm" className="mt-3 gap-1" onClick={handleAddToQueue}><Check className="w-3.5 h-3.5" />Add to Queue</Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Queue Tab */}
            {activeTab === "queue" && (
                <Card>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-[60px_1fr_1fr_100px_100px_100px_80px] gap-2 px-4 py-2.5 border-b border-[var(--border)] text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider font-semibold">
                            <span>#</span>
                            <span>Patient</span>
                            <span>Doctor</span>
                            <span>Priority</span>
                            <span>Status</span>
                            <span>Wait Time</span>
                            <span>Actions</span>
                        </div>
                        {queue.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <ClipboardList className="w-8 h-8 text-[var(--foreground-subtle)] mx-auto mb-2" />
                                <p className="text-xs text-[var(--foreground-subtle)]">No patients in queue today</p>
                            </div>
                        ) : (
                            queue.map((entry, i) => {
                                const priorityCfg = PRIORITY_CONFIG[entry.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
                                const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.waiting;
                                const waitMinutes = Math.round((Date.now() - new Date(entry.check_in_time).getTime()) / 60000);
                                const hasVitals = Object.keys(entry.vitals_recorded ?? {}).length > 0;

                                return (
                                    <motion.div
                                        key={entry.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="grid grid-cols-[60px_1fr_1fr_100px_100px_100px_80px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-colors items-center"
                                    >
                                        <span className="text-lg font-bold text-[var(--foreground)]">{entry.queue_number}</span>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Avatar className="w-7 h-7 shrink-0">
                                                <AvatarFallback className="text-[10px]">{getInitials(entry.patient_name)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-[var(--foreground)] truncate">{entry.patient_name}</p>
                                                <p className="text-[10px] text-[var(--foreground-subtle)] truncate">{entry.reason || "—"}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-[var(--foreground-muted)]">{entry.doctor_name}</span>
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${priorityCfg.color}`}>
                                            {entry.priority === "emergency" && <AlertTriangle className="w-3 h-3" />}
                                            {priorityCfg.label}
                                        </span>
                                        <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${statusCfg.color}`}>
                                            {statusCfg.label}
                                        </span>
                                        <span className="text-xs text-[var(--foreground-muted)]">
                                            {entry.status === "waiting" ? `${waitMinutes} min` : "—"}
                                        </span>
                                        <div className="flex gap-1">
                                            {entry.status === "waiting" && !hasVitals && (
                                                <button
                                                    onClick={() => { setVitalsQueueId(entry.id); setActiveTab("vitals"); }}
                                                    className="p-1.5 rounded-md hover:bg-[var(--surface)] transition-colors"
                                                    title="Record Vitals"
                                                >
                                                    <HeartPulse className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            )}
                                            {hasVitals && (
                                                <Badge variant="success" className="text-[8px]">Vitals ✓</Badge>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Register Tab */}
            {activeTab === "register" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <UserPlus className="w-4 h-4 text-blue-400" /> Register New Patient
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Full Name *</label>
                                <input value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} placeholder="Patient's full name" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                            </div>
                            <div>
                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Phone *</label>
                                <input value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} placeholder="+91 98765 43210" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                            </div>
                            <div>
                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Date of Birth</label>
                                <input type="date" value={regForm.dob} onChange={(e) => setRegForm({ ...regForm, dob: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                            </div>
                            <div>
                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Gender</label>
                                <select value={regForm.gender} onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Blood Group</label>
                                <select value={regForm.blood_group} onChange={(e) => setRegForm({ ...regForm, blood_group: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                    <option value="">Select</option>
                                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">ABHA ID</label>
                                <input value={regForm.abha_id} onChange={(e) => setRegForm({ ...regForm, abha_id: e.target.value })} placeholder="14-digit ABHA" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                            </div>
                            <div className="col-span-3 grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Allergies (comma-separated)</label>
                                    <input value={regForm.allergies} onChange={(e) => setRegForm({ ...regForm, allergies: e.target.value })} placeholder="Penicillin, Sulfa" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Chronic Conditions (comma-separated)</label>
                                    <input value={regForm.chronic_conditions} onChange={(e) => setRegForm({ ...regForm, chronic_conditions: e.target.value })} placeholder="Diabetes, Hypertension" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Emergency Contact</label>
                                    <input value={regForm.emergency_contact} onChange={(e) => setRegForm({ ...regForm, emergency_contact: e.target.value })} placeholder="Name & Phone" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button size="sm" className="gap-1" onClick={handleRegister}>
                                <Check className="w-3.5 h-3.5" /> Register & Add to Queue
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setActiveTab("queue")}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Vitals Tab */}
            {activeTab === "vitals" && vitalsQueueId && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <HeartPulse className="w-4 h-4 text-red-400" /> Record Vitals
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                                {queue.find(q => q.id === vitalsQueueId)?.patient_name ?? "Patient"}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                            {[
                                { key: "bp_systolic", label: "BP Systolic", unit: "mmHg", icon: Activity, placeholder: "120" },
                                { key: "bp_diastolic", label: "BP Diastolic", unit: "mmHg", icon: Activity, placeholder: "80" },
                                { key: "heart_rate", label: "Heart Rate", unit: "bpm", icon: HeartPulse, placeholder: "72" },
                                { key: "temperature", label: "Temperature", unit: "°F", icon: Thermometer, placeholder: "98.6" },
                                { key: "spo2", label: "SpO₂", unit: "%", icon: Activity, placeholder: "98" },
                                { key: "weight", label: "Weight", unit: "kg", icon: Users, placeholder: "70" },
                                { key: "height", label: "Height", unit: "cm", icon: Users, placeholder: "170" },
                            ].map((field) => {
                                const Icon = field.icon;
                                return (
                                    <div key={field.key}>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase flex items-center gap-1">
                                            <Icon className="w-3 h-3" /> {field.label} <span className="text-[8px]">({field.unit})</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={vitalsForm[field.key as keyof typeof vitalsForm]}
                                            onChange={(e) => setVitalsForm({ ...vitalsForm, [field.key]: e.target.value })}
                                            placeholder={field.placeholder}
                                            className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button size="sm" className="gap-1" onClick={handleSaveVitals}>
                                <Check className="w-3.5 h-3.5" /> Save Vitals
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setVitalsQueueId(null); setActiveTab("queue"); }}>
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
