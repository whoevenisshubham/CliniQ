"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  HeartPulse, FileText, Pill, MessageSquare, Calendar,
  TrendingUp, Shield, Clock, ChevronRight, Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

const MOCK_RECENT_CONSULTATIONS = [
  { id: "1", date: "Feb 15, 2026", doctor: "Dr. Sharma", diagnosis: "Type 2 Diabetes - Follow-up", status: "completed" },
  { id: "2", date: "Jan 20, 2026", doctor: "Dr. Sharma", diagnosis: "Hypertension Management", status: "completed" },
  { id: "3", date: "Dec 10, 2025", doctor: "Dr. Patel", diagnosis: "Seasonal Flu", status: "completed" },
];

const MOCK_MEDICATIONS = [
  { name: "Metformin 500mg", frequency: "Twice daily", refillDays: 12, adherence: 92 },
  { name: "Amlodipine 5mg", frequency: "Once daily", refillDays: 8, adherence: 98 },
  { name: "Atorvastatin 10mg", frequency: "Once at night", refillDays: 21, adherence: 85 },
];

interface PatientDashboardClientProps {
  user: { id: string; name: string; email: string; role: string };
}

export function PatientDashboardClient({ user }: PatientDashboardClientProps) {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
          Your health summary and records
        </p>
      </div>

      {/* Health score */}
      <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--foreground-subtle)]">Health Score</p>
              <p className="text-4xl font-bold text-blue-400 mt-1">78<span className="text-sm text-[var(--foreground-muted)]">/100</span></p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">Good — Keep it up!</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-xs text-green-400 justify-end">
                <TrendingUp className="w-3.5 h-3.5" />
                +5 since last visit
              </div>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">Updated Feb 15, 2026</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent consultations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Recent Consultations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {MOCK_RECENT_CONSULTATIONS.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">{c.diagnosis}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)]">{c.doctor} · {c.date}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--foreground-subtle)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs mt-1 gap-1">
              View All Reports <ChevronRight className="w-3 h-3" />
            </Button>
          </CardContent>
        </Card>

        {/* Active medications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-green-400" />
              Active Medications
              <Badge variant="secondary" className="ml-auto text-[9px]">3 active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_MEDICATIONS.map((med, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--foreground)]">{med.name}</p>
                  <div className="flex items-center gap-1.5">
                    {med.refillDays <= 10 && (
                      <Badge variant="warning" className="text-[9px]">Refill in {med.refillDays}d</Badge>
                    )}
                    <span className="text-[10px] text-[var(--foreground-subtle)]">{med.adherence}%</span>
                  </div>
                </div>
                <Progress value={med.adherence} className="h-1" indicatorClassName={med.adherence >= 90 ? "bg-green-500" : "bg-amber-500"} />
                <p className="text-[10px] text-[var(--foreground-subtle)]">{med.frequency}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { label: "Ask My Doctor", icon: MessageSquare, href: "/patient/chat", color: "text-blue-400 bg-blue-500/10" },
              { label: "Book Appointment", icon: Calendar, href: "/patient/appointments", color: "text-green-400 bg-green-500/10" },
              { label: "My Reports", icon: FileText, href: "/patient/reports", color: "text-purple-400 bg-purple-500/10" },
              { label: "Drug Costs", icon: Shield, href: "/patient/prescriptions", color: "text-amber-400 bg-amber-500/10" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.label} href={action.href}>
                  <div className={`flex items-center gap-2 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--border)]/80 transition-colors cursor-pointer`}>
                    <div className={`flex items-center justify-center w-7 h-7 rounded-md ${action.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-[var(--foreground)]">{action.label}</span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Upcoming reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--foreground-subtle)]" />
              Reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { text: "Take Metformin 500mg", time: "8:00 AM · Today", done: true },
              { text: "Take Amlodipine 5mg", time: "8:00 AM · Today", done: true },
              { text: "HbA1c blood test due", time: "Feb 28, 2026", done: false },
              { text: "Follow-up with Dr. Sharma", time: "Mar 5, 2026", done: false },
            ].map((r, i) => (
              <div key={i} className={`flex items-center gap-2.5 p-2 rounded-lg ${r.done ? "opacity-50" : "bg-[var(--surface-elevated)]"}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.done ? "bg-green-500" : "bg-blue-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${r.done ? "line-through text-[var(--foreground-subtle)]" : "text-[var(--foreground)]"}`}>{r.text}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)]">{r.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
