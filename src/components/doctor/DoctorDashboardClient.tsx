"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity, Users, Shield, CreditCard, Stethoscope,
  CalendarDays, Clock, ChevronRight, TrendingUp, AlertTriangle,
  CheckCircle2, Plus, Search, FileText, HeartPulse, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TriagePanel } from "@/components/doctor/TriagePanel";
import { FamilyHealthGraph } from "@/components/doctor/FamilyHealthGraph";
import { FlashbackCard } from "@/components/doctor/FlashbackCard";
import { ProtocolCreditBadge, GlobalRepositoryModal, useProtocolCredits } from "@/components/doctor/ProtocolCreditBadge";
import { formatDate, cn } from "@/lib/utils";

// ─── Mock data for demo ───────────────────────────────────────────────────────

const MOCK_APPOINTMENTS = [
  { id: "1", name: "Priya Sharma", age: 45, gender: "F", time: "10:00 AM", type: "followup", complaint: "Uncontrolled blood sugar, fatigue", lastVisit: "2026-01-15", status: "pending", urgency: "normal" },
  { id: "2", name: "Ramesh Patel", age: 62, gender: "M", time: "10:30 AM", type: "general", complaint: "Chest pain, breathlessness", lastVisit: "2025-12-20", status: "pending", urgency: "high" },
  { id: "3", name: "Anita Verma", age: 34, gender: "F", time: "11:00 AM", type: "general", complaint: "Fever, body ache, headache (3 days)", lastVisit: "2025-11-05", status: "completed", urgency: "normal" },
  { id: "4", name: "Suresh Kumar", age: 55, gender: "M", time: "11:30 AM", type: "followup", complaint: "BP review, medication adjustment", lastVisit: "2026-02-01", status: "pending", urgency: "normal" },
  { id: "5", name: "Meera Singh", age: 28, gender: "F", time: "12:00 PM", type: "general", complaint: "Rash on arms and neck, itching", lastVisit: "2025-10-12", status: "pending", urgency: "normal" },
];

const MOCK_STATS = [
  { label: "Today's Patients", value: "12", icon: Users, delta: "+3 vs yesterday", color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Consultations Done", value: "7", icon: CheckCircle2, delta: "58% complete", color: "text-green-400", bg: "bg-green-500/10" },
  { label: "Safety Alerts", value: "3", icon: Shield, delta: "2 unresolved", color: "text-red-400", bg: "bg-red-500/10" },
  { label: "Revenue Today", value: "₹8,400", icon: CreditCard, delta: "+12% vs avg", color: "text-amber-400", bg: "bg-amber-500/10" },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ stat, index }: { stat: typeof MOCK_STATS[0]; index: number }) {
  const Icon = stat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="border-[var(--border)] hover:border-[var(--border)]/80 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[var(--foreground-subtle)]">{stat.label}</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{stat.value}</p>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">{stat.delta}</p>
            </div>
            <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", stat.bg)}>
              <Icon className={cn("w-4 h-4", stat.color)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Patient row ──────────────────────────────────────────────────────────────

function PatientRow({ appt, index }: { appt: typeof MOCK_APPOINTMENTS[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.04 }}
      className={cn(
        "flex items-center gap-4 p-3.5 rounded-lg border transition-colors cursor-pointer group",
        appt.status === "completed"
          ? "border-[var(--border-subtle)] opacity-60"
          : appt.urgency === "high"
            ? "border-red-500/25 bg-red-500/5 hover:bg-red-500/10"
            : "border-[var(--border)] hover:bg-[var(--surface-elevated)]"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold shrink-0",
        appt.urgency === "high" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
      )}>
        {appt.name.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">{appt.name}</p>
          <span className="text-[10px] text-[var(--foreground-subtle)]">
            {appt.age}{appt.gender}
          </span>
          {appt.urgency === "high" && (
            <Badge variant="destructive" className="text-[9px] py-0 px-1.5 h-3.5">
              Urgent
            </Badge>
          )}
          {appt.status === "completed" && (
            <Badge variant="success" className="text-[9px] py-0 px-1.5 h-3.5">
              Done
            </Badge>
          )}
        </div>
        <p className="text-xs text-[var(--foreground-muted)] truncate mt-0.5">{appt.complaint}</p>
      </div>

      {/* Time & type */}
      <div className="text-right shrink-0">
        <p className="text-xs font-medium text-[var(--foreground-muted)]">{appt.time}</p>
        <p className="text-[10px] text-[var(--foreground-subtle)] capitalize">{appt.type}</p>
      </div>

      {/* Action */}
      {appt.status !== "completed" && (
        <Link href={`/doctor/consultation?id=new&patientId=${appt.id}&patientName=${encodeURIComponent(appt.name)}`}>
          <Button size="sm" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Stethoscope className="w-3 h-3" />
            Start
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DoctorDashboardClientProps {
  user: { id: string; name: string; email: string; role: string };
}

export function DoctorDashboardClient({ user }: DoctorDashboardClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showRepoModal, setShowRepoModal] = useState(false);
  const { credits, addCredits } = useProtocolCredits();

  const filteredAppts = MOCK_APPOINTMENTS.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.complaint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Global Repository Modal */}
      <GlobalRepositoryModal
        isOpen={showRepoModal}
        onClose={() => setShowRepoModal(false)}
        onContribute={(points, description) => {
          addCredits(points, description);
          setShowRepoModal(false);
        }}
      />

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {greeting}, Dr. {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatDate(new Date())} · {MOCK_APPOINTMENTS.filter(a => a.status === "pending").length} patients waiting
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Protocol Credits compact badge */}
          <ProtocolCreditBadge credits={credits} compact />

          <button
            onClick={() => setShowRepoModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition-colors text-xs font-medium text-purple-300"
          >
            <Globe className="w-3.5 h-3.5" />
            Repository
          </button>

          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            All Records
          </Button>
          <Link href="/doctor/consultation?id=new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Consultation
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Stats grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {MOCK_STATS.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Today's appointments ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Today&apos;s Queue
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--foreground-subtle)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients..."
                className="pl-7 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500 w-48"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {filteredAppts.map((appt, i) => (
              <PatientRow key={appt.id} appt={appt} index={i} />
            ))}
          </div>
        </div>

        {/* ─── Right panel ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Safety alerts preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" />
                Active Alerts
                <Badge variant="destructive" className="ml-auto text-[9px]">3</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { drug: "Warfarin + Aspirin", severity: "critical", patient: "R. Patel" },
                { drug: "Penicillin allergy flag", severity: "high", patient: "P. Sharma" },
                { drug: "Metformin + Contrast dye", severity: "medium", patient: "S. Kumar" },
              ].map((alert, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2 p-2 rounded-lg text-xs border",
                  alert.severity === "critical" ? "bg-red-500/10 border-red-500/20" :
                    alert.severity === "high" ? "bg-orange-500/10 border-orange-500/20" :
                      "bg-amber-500/10 border-amber-500/20"
                )}>
                  <AlertTriangle className={cn("w-3 h-3 mt-0.5 shrink-0",
                    alert.severity === "critical" ? "text-red-400" :
                      alert.severity === "high" ? "text-orange-400" : "text-amber-400"
                  )} />
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{alert.drug}</p>
                    <p className="text-[var(--foreground-subtle)]">{alert.patient}</p>
                  </div>
                </div>
              ))}
              <Link href="/doctor/alerts">
                <Button variant="ghost" size="sm" className="w-full text-xs mt-1 gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Consultations", value: "47", icon: Stethoscope },
                { label: "Avg. Duration", value: "18 min", icon: Clock },
                { label: "Patient Satisfaction", value: "96%", icon: HeartPulse },
                { label: "Coding Accuracy", value: "100%", icon: Activity },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                      <span className="text-xs text-[var(--foreground-muted)]">{item.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-[var(--foreground)]">{item.value}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Triage panel */}
          <FlashbackCard patientName={MOCK_APPOINTMENTS[0]?.name} />
          <TriagePanel />
        </div>
      </div>

      {/* ─── Family Health Graph ──────────────────────────────────── */}
      <FamilyHealthGraph />
    </div>
  );
}
