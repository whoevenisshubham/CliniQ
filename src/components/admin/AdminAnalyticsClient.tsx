"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    BarChart3, TrendingUp, Users, Activity, DollarSign,
    Shield, Heart, Pill, Calendar, ArrowUp, ArrowDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const CONSULTATION_VOLUME = [
    { month: "Sep", consultations: 89, revenue: 78000 },
    { month: "Oct", consultations: 112, revenue: 95000 },
    { month: "Nov", consultations: 134, revenue: 112000 },
    { month: "Dec", consultations: 98, revenue: 86000 },
    { month: "Jan", consultations: 156, revenue: 134000 },
    { month: "Feb", consultations: 142, revenue: 128000 },
];

const TOP_DIAGNOSES = [
    { name: "Type 2 Diabetes", count: 187, icd: "E11.9" },
    { name: "Hypertension", count: 156, icd: "I10" },
    { name: "Acute Bronchitis", count: 89, icd: "J20.9" },
    { name: "UTI", count: 67, icd: "N39.0" },
    { name: "Hypothyroidism", count: 54, icd: "E03.9" },
    { name: "Heart Failure", count: 42, icd: "I50.9" },
];

const REVENUE_BREAKDOWN = [
    { name: "Consultations", value: 45, color: "#3b82f6" },
    { name: "Procedures", value: 25, color: "#8b5cf6" },
    { name: "Investigations", value: 18, color: "#06b6d4" },
    { name: "Medications", value: 12, color: "#22c55e" },
];

const SAFETY_ALERTS_TREND = [
    { month: "Sep", alerts: 12, acknowledged: 11 },
    { month: "Oct", alerts: 18, acknowledged: 17 },
    { month: "Nov", alerts: 15, acknowledged: 15 },
    { month: "Dec", alerts: 9, acknowledged: 9 },
    { month: "Jan", alerts: 22, acknowledged: 20 },
    { month: "Feb", alerts: 14, acknowledged: 13 },
];

const DOCTOR_PERFORMANCE = [
    { name: "Dr. Arjun Sharma", consultations: 342, avg_duration: "32 min", satisfaction: 4.8, revenue: 285000 },
    { name: "Dr. Neha Patel", consultations: 287, avg_duration: "28 min", satisfaction: 4.7, revenue: 223000 },
    { name: "Dr. Rajesh Gupta", consultations: 156, avg_duration: "42 min", satisfaction: 4.9, revenue: 312000 },
    { name: "Dr. Priya Desai", consultations: 89, avg_duration: "35 min", satisfaction: 4.6, revenue: 98000 },
];

interface AdminAnalyticsClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function AdminAnalyticsClient({ user }: AdminAnalyticsClientProps) {
    const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");
    const [topDiagnoses, setTopDiagnoses] = useState(TOP_DIAGNOSES);
    const [doctorPerf, setDoctorPerf] = useState(DOCTOR_PERFORMANCE);
    const [kpis, setKpis] = useState({ totalRevenue: '₹6,33,000', totalConsultations: '731', activeNow: '0' });

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/analytics');
                const data = await res.json();
                if (data.stats) {
                    setKpis({
                        totalRevenue: `₹${Number(data.stats.total_revenue).toLocaleString('en-IN')}`,
                        totalConsultations: String(data.stats.total_consultations),
                        activeNow: String(data.stats.active_consultations),
                    });
                }
                if (data.top_diagnoses?.length > 0) {
                    setTopDiagnoses(data.top_diagnoses.map((d: { name: string; count: number }) => ({
                        name: d.name, count: d.count, icd: '',
                    })));
                }
                if (data.doctor_performance?.length > 0) {
                    setDoctorPerf(data.doctor_performance.map((d: { name: string; department?: string; consultations: number }) => ({
                        name: d.name,
                        consultations: d.consultations,
                        avg_duration: '—',
                        satisfaction: 4.7,
                        revenue: 0,
                    })));
                }
            } catch { /* keep mock data */ }
        }
        fetchData();
    }, []);

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">Analytics</h1>
                    <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                        Hospital performance, trends, and compliance metrics
                    </p>
                </div>
                <div className="flex bg-[var(--surface)] rounded-lg p-0.5 border border-[var(--border)]">
                    {(["7d", "30d", "90d", "1y"] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${timeRange === range
                                ? "bg-blue-600 text-white shadow"
                                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: "Total Revenue", value: kpis.totalRevenue, delta: "+12.3%", up: true, icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10" },
                    { label: "Total Consultations", value: kpis.totalConsultations, delta: "+8.7%", up: true, icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10" },
                    { label: "Avg. Satisfaction", value: "4.75", delta: "+0.2", up: true, icon: Heart, color: "text-pink-400", bg: "bg-pink-500/10" },
                    { label: "Safety Compliance", value: "97.8%", delta: "+1.1%", up: true, icon: Shield, color: "text-purple-400", bg: "bg-purple-500/10" },
                ].map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                        <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[10px] text-[var(--foreground-subtle)]">{kpi.label}</p>
                                            <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{kpi.value}</p>
                                            <div className={`flex items-center gap-1 text-[10px] mt-1 ${kpi.up ? "text-green-400" : "text-red-400"}`}>
                                                {kpi.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                {kpi.delta} vs last period
                                            </div>
                                        </div>
                                        <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                                            <Icon className={`w-4 h-4 ${kpi.color}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Consultation Volume Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            Consultation Volume & Revenue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={CONSULTATION_VOLUME}>
                                    <defs>
                                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="month" tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                                    <Area type="monotone" dataKey="consultations" stroke="#3b82f6" fill="url(#volGrad)" strokeWidth={2} name="Consultations" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Revenue Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-green-400" />
                            Revenue Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-56 flex items-center">
                            <div className="w-1/2 h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={REVENUE_BREAKDOWN} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                                            {REVENUE_BREAKDOWN.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-1/2 space-y-2">
                                {REVENUE_BREAKDOWN.map((item) => (
                                    <div key={item.name} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                                        <span className="text-xs text-[var(--foreground-muted)] flex-1">{item.name}</span>
                                        <span className="text-xs font-semibold text-[var(--foreground)]">{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Diagnoses */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Pill className="w-4 h-4 text-purple-400" />
                            Top Diagnoses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topDiagnoses} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} width={120} />
                                    <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Cases" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Safety Alerts Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Shield className="w-4 h-4 text-red-400" />
                            Safety Alerts Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={SAFETY_ALERTS_TREND}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="month" tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
                                    <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                                    <Bar dataKey="alerts" fill="#ef4444" radius={[4, 4, 0, 0]} name="Total Alerts" />
                                    <Bar dataKey="acknowledged" fill="#22c55e" radius={[4, 4, 0, 0]} name="Acknowledged" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Doctor Performance Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-blue-400" />
                        Doctor Performance
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-[var(--border)] text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider font-semibold">
                        <span>Doctor</span>
                        <span>Consultations</span>
                        <span>Avg Duration</span>
                        <span>Satisfaction</span>
                        <span>Revenue</span>
                    </div>
                    {doctorPerf.map((doc, i) => (
                        <motion.div
                            key={doc.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-colors items-center"
                        >
                            <span className="text-xs font-medium text-[var(--foreground)]">{doc.name}</span>
                            <span className="text-xs text-[var(--foreground-muted)]">{doc.consultations}</span>
                            <span className="text-xs text-[var(--foreground-muted)]">{doc.avg_duration}</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-amber-400">{doc.satisfaction}</span>
                                <Progress value={doc.satisfaction * 20} className="h-1 flex-1" indicatorClassName="bg-amber-500" />
                            </div>
                            <span className="text-xs font-medium text-green-400">₹{(doc.revenue / 1000).toFixed(0)}K</span>
                        </motion.div>
                    ))}
                </CardContent>
            </Card>

            {/* Compliance Rates */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-green-400" />
                        Compliance Rates
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: "ABDM Compliance", value: 100, color: "bg-green-500" },
                            { label: "ICD-10 Auto-Coding", value: 98.2, color: "bg-blue-500" },
                            { label: "Consent Capture", value: 94.5, color: "bg-purple-500" },
                            { label: "Audit Chain Integrity", value: 100, color: "bg-green-500" },
                        ].map((metric) => (
                            <div key={metric.label} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[var(--foreground-muted)]">{metric.label}</span>
                                    <span className="text-xs font-bold text-[var(--foreground)]">{metric.value}%</span>
                                </div>
                                <Progress value={metric.value} className="h-2" indicatorClassName={metric.color} />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
