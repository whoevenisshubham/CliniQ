"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    Pill, TrendingDown, Store, Search, ChevronRight,
    Clock, AlertCircle, IndianRupee, BadgeCheck, Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ACTIVE_PRESCRIPTIONS = [
    {
        id: "rx1",
        name: "Metformin 500mg",
        generic_name: "Metformin Hydrochloride",
        frequency: "Twice daily (morning & night)",
        duration: "Ongoing",
        prescribed_by: "Dr. Arjun Sharma",
        prescribed_date: "Oct 5, 2025",
        brand_price: 180,
        generic_price: 45,
        jan_aushadhi_price: 22,
        jan_aushadhi_available: true,
        jan_aushadhi_store: "Jan Aushadhi Kendra, Sector 15",
        jan_aushadhi_distance: "2.3 km",
        adherence: 92,
        refill_days: 12,
        instructions: "Take with food. Do not skip doses.",
    },
    {
        id: "rx2",
        name: "Amlodipine 5mg",
        generic_name: "Amlodipine Besylate",
        frequency: "Once daily (morning)",
        duration: "Ongoing",
        prescribed_by: "Dr. Arjun Sharma",
        prescribed_date: "Jan 20, 2026",
        brand_price: 250,
        generic_price: 60,
        jan_aushadhi_price: 28,
        jan_aushadhi_available: true,
        jan_aushadhi_store: "Jan Aushadhi Kendra, Sector 15",
        jan_aushadhi_distance: "2.3 km",
        adherence: 98,
        refill_days: 8,
        instructions: "Take at the same time each day.",
    },
    {
        id: "rx3",
        name: "Atorvastatin 10mg",
        generic_name: "Atorvastatin Calcium",
        frequency: "Once at night",
        duration: "Ongoing",
        prescribed_by: "Dr. Arjun Sharma",
        prescribed_date: "Jan 20, 2026",
        brand_price: 320,
        generic_price: 78,
        jan_aushadhi_price: 35,
        jan_aushadhi_available: true,
        jan_aushadhi_store: "Jan Aushadhi Kendra, Sector 15",
        jan_aushadhi_distance: "2.3 km",
        adherence: 85,
        refill_days: 21,
        instructions: "Take after dinner. Avoid grapefruit juice.",
    },
];

const MOCK_PAST_PRESCRIPTIONS = [
    {
        id: "rx4",
        name: "Paracetamol 500mg",
        generic_name: "Paracetamol",
        frequency: "As needed (max 3/day)",
        duration: "5 days",
        prescribed_by: "Dr. Neha Patel",
        prescribed_date: "Dec 10, 2025",
        brand_price: 45,
        generic_price: 12,
        jan_aushadhi_price: 8,
        jan_aushadhi_available: true,
        status: "completed",
    },
    {
        id: "rx5",
        name: "Cetirizine 10mg",
        generic_name: "Cetirizine Hydrochloride",
        frequency: "Once daily",
        duration: "7 days",
        prescribed_by: "Dr. Neha Patel",
        prescribed_date: "Dec 10, 2025",
        brand_price: 95,
        generic_price: 20,
        jan_aushadhi_price: 10,
        jan_aushadhi_available: true,
        status: "completed",
    },
];

interface PatientPrescriptionsClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function PatientPrescriptionsClient({ user }: PatientPrescriptionsClientProps) {
    const [activeTab, setActiveTab] = useState<"active" | "past">("active");
    const [searchQuery, setSearchQuery] = useState("");

    const totalBrandCost = MOCK_ACTIVE_PRESCRIPTIONS.reduce((sum, rx) => sum + rx.brand_price, 0);
    const totalGenericCost = MOCK_ACTIVE_PRESCRIPTIONS.reduce((sum, rx) => sum + rx.generic_price, 0);
    const totalJACost = MOCK_ACTIVE_PRESCRIPTIONS.reduce((sum, rx) => sum + rx.jan_aushadhi_price, 0);
    const monthlySavings = totalBrandCost - totalJACost;
    const savingsPercentage = Math.round((monthlySavings / totalBrandCost) * 100);

    const activeMeds = MOCK_ACTIVE_PRESCRIPTIONS.filter(
        (rx) =>
            rx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rx.generic_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pastMeds = MOCK_PAST_PRESCRIPTIONS.filter(
        (rx) =>
            rx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rx.generic_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-[var(--foreground)]">Prescriptions & Drug Costs</h1>
                <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                    Track medications, compare prices, and find affordable alternatives
                </p>
            </div>

            {/* Savings banner */}
            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-[var(--foreground-subtle)]">Monthly Savings Opportunity</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <p className="text-3xl font-bold text-green-400">
                                    <IndianRupee className="w-5 h-5 inline" />{monthlySavings}
                                </p>
                                <Badge variant="success" className="text-[9px]">{savingsPercentage}% savings</Badge>
                            </div>
                            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                                Switch to Jan Aushadhi generics to save ₹{monthlySavings}/month
                            </p>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="text-[10px] text-[var(--foreground-subtle)]">
                                <span className="line-through">Brand: ₹{totalBrandCost}/mo</span>
                            </div>
                            <div className="text-[10px] text-[var(--foreground-muted)]">
                                Generic: ₹{totalGenericCost}/mo
                            </div>
                            <div className="text-xs font-semibold text-green-400">
                                Jan Aushadhi: ₹{totalJACost}/mo
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs + Search */}
            <div className="flex items-center gap-3">
                <div className="flex bg-[var(--surface)] rounded-lg p-0.5 border border-[var(--border)]">
                    {(["active", "past"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab
                                    ? "bg-blue-600 text-white shadow"
                                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                }`}
                        >
                            {tab === "active" ? `Active (${MOCK_ACTIVE_PRESCRIPTIONS.length})` : `Past (${MOCK_PAST_PRESCRIPTIONS.length})`}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search medications..."
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>
            </div>

            {/* Active prescriptions */}
            {activeTab === "active" && (
                <div className="space-y-3">
                    {activeMeds.map((rx, i) => (
                        <motion.div
                            key={rx.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                                <Pill className="w-4 h-4 text-green-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-[var(--foreground)]">{rx.name}</p>
                                                <p className="text-[10px] text-[var(--foreground-subtle)]">
                                                    {rx.generic_name} · {rx.frequency}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {rx.refill_days <= 10 && (
                                                <Badge variant="warning" className="text-[9px] gap-1">
                                                    <Clock className="w-2.5 h-2.5" /> Refill in {rx.refill_days}d
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Adherence */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-[var(--foreground-subtle)]">Adherence</span>
                                            <span className="text-xs font-semibold text-[var(--foreground)]">{rx.adherence}%</span>
                                        </div>
                                        <Progress
                                            value={rx.adherence}
                                            className="h-1.5"
                                            indicatorClassName={rx.adherence >= 90 ? "bg-green-500" : rx.adherence >= 70 ? "bg-amber-500" : "bg-red-500"}
                                        />
                                    </div>

                                    {/* Price comparison */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-[var(--surface)] rounded-lg p-2.5 text-center border border-[var(--border)]">
                                            <p className="text-[9px] text-[var(--foreground-subtle)] uppercase">Brand</p>
                                            <p className="text-sm font-bold text-[var(--foreground-muted)] line-through mt-0.5">₹{rx.brand_price}</p>
                                        </div>
                                        <div className="bg-[var(--surface)] rounded-lg p-2.5 text-center border border-[var(--border)]">
                                            <p className="text-[9px] text-[var(--foreground-subtle)] uppercase">Generic</p>
                                            <p className="text-sm font-bold text-[var(--foreground)] mt-0.5">₹{rx.generic_price}</p>
                                        </div>
                                        <div className="bg-green-500/5 rounded-lg p-2.5 text-center border border-green-500/20">
                                            <div className="flex items-center justify-center gap-1">
                                                <p className="text-[9px] text-green-400 uppercase">Jan Aushadhi</p>
                                                <BadgeCheck className="w-3 h-3 text-green-400" />
                                            </div>
                                            <p className="text-sm font-bold text-green-400 mt-0.5">₹{rx.jan_aushadhi_price}</p>
                                        </div>
                                    </div>

                                    {/* Jan Aushadhi store */}
                                    {rx.jan_aushadhi_available && rx.jan_aushadhi_store && (
                                        <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/15 rounded-lg p-2.5">
                                            <Store className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-green-400 font-medium">{rx.jan_aushadhi_store}</p>
                                                <p className="text-[9px] text-[var(--foreground-subtle)]">{rx.jan_aushadhi_distance} away</p>
                                            </div>
                                            <Badge variant="success" className="text-[8px] shrink-0">
                                                Save ₹{rx.brand_price - rx.jan_aushadhi_price}/mo
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Instructions */}
                                    {rx.instructions && (
                                        <div className="flex items-start gap-2 text-[10px] text-[var(--foreground-subtle)]">
                                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                            {rx.instructions}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--foreground-subtle)]">
                                        <span>Prescribed by {rx.prescribed_by}</span>
                                        <span>{rx.prescribed_date}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Past prescriptions */}
            {activeTab === "past" && (
                <div className="space-y-3">
                    {pastMeds.map((rx, i) => (
                        <motion.div
                            key={rx.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="opacity-75">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-[var(--surface-elevated)] flex items-center justify-center shrink-0">
                                            <Package className="w-4 h-4 text-[var(--foreground-subtle)]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-[var(--foreground)]">{rx.name}</p>
                                            <p className="text-[10px] text-[var(--foreground-subtle)]">
                                                {rx.generic_name} · {rx.frequency} · {rx.duration}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="secondary" className="text-[9px]">Completed</Badge>
                                            <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">{rx.prescribed_date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-[10px]">
                                        <span className="text-[var(--foreground-subtle)]">Brand: <span className="line-through">₹{rx.brand_price}</span></span>
                                        <span className="text-[var(--foreground-muted)]">Generic: ₹{rx.generic_price}</span>
                                        {rx.jan_aushadhi_available && (
                                            <span className="text-green-400">Jan Aushadhi: ₹{rx.jan_aushadhi_price}</span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
