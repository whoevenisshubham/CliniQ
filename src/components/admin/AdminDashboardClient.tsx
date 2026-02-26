"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Users, Shield, Activity, AlertTriangle,
  TrendingUp, Database, CheckCircle2, Clock, Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface AdminDashboardClientProps {
  user: { id: string; name: string; email: string; role: string };
}

const MOCK_SYSTEM_HEALTH = [
  { label: "Supabase DB", status: "operational", uptime: 99.9 },
  { label: "Deepgram STT", status: "operational", uptime: 99.7 },
  { label: "Groq AI", status: "operational", uptime: 99.5 },
  { label: "Audit Chain", status: "operational", uptime: 100 },
];

const MOCK_RECENT_ALERTS = [
  { type: "drug_interaction", patient: "R. Patel", severity: "critical", time: "10:32 AM" },
  { type: "allergy", patient: "P. Sharma", severity: "high", time: "10:15 AM" },
  { type: "dosage", patient: "A. Verma", severity: "medium", time: "9:47 AM" },
];

export function AdminDashboardClient({ user }: AdminDashboardClientProps) {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Admin Overview</h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5">System health, user activity, and compliance</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="w-3.5 h-3.5" />
          Settings
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Consultations", value: "1,247", icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10", delta: "+23 today" },
          { label: "Active Doctors", value: "18", icon: Users, color: "text-green-400", bg: "bg-green-500/10", delta: "12 online now" },
          { label: "Safety Alerts Today", value: "7", icon: Shield, color: "text-red-400", bg: "bg-red-500/10", delta: "3 unresolved" },
          { label: "Audit Events", value: "3,891", icon: Database, color: "text-purple-400", bg: "bg-purple-500/10", delta: "Chain intact ✓" },
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
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${stat.bg}`}>
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              System Health
              <Badge variant="success" className="ml-auto text-[9px]">All Operational</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_SYSTEM_HEALTH.map((service, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-[var(--foreground)] flex-1">{service.label}</span>
                <span className="text-[10px] text-[var(--foreground-subtle)]">{service.uptime}% uptime</span>
                <Progress value={service.uptime} className="w-16 h-1" indicatorClassName="bg-green-500" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent safety alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Recent Safety Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {MOCK_RECENT_ALERTS.map((alert, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--surface-elevated)]">
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
                  alert.severity === "critical" ? "text-red-400" :
                  alert.severity === "high" ? "text-orange-400" : "text-amber-400"
                }`} />
                <div className="flex-1">
                  <p className="text-xs font-medium text-[var(--foreground)]">{alert.patient}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] capitalize">{alert.type.replace("_", " ")}</p>
                </div>
                <div className="text-right">
                  <Badge variant={alert.severity === "critical" ? "critical" : "warning"} className="text-[9px]">
                    {alert.severity}
                  </Badge>
                  <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{alert.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Compliance metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Compliance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "ABDM Compliance", value: 100, color: "bg-green-500" },
              { label: "ICD-10 Auto-coding Rate", value: 98, color: "bg-blue-500" },
              { label: "Consent Capture Rate", value: 94, color: "bg-purple-500" },
              { label: "Audit Chain Integrity", value: 100, color: "bg-green-500" },
            ].map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--foreground-muted)]">{m.label}</span>
                  <span className="text-xs font-semibold text-[var(--foreground)]">{m.value}%</span>
                </div>
                <Progress value={m.value} className="h-1.5" indicatorClassName={m.color} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent doctor activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--foreground-subtle)]" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { event: "Consultation finalized", actor: "Dr. Sharma", time: "2m ago" },
              { event: "Safety alert acknowledged", actor: "Dr. Patel", time: "8m ago" },
              { event: "ICD codes mapped (E11.9, I10)", actor: "System", time: "12m ago" },
              { event: "Patient summary sent via WhatsApp", actor: "System", time: "15m ago" },
              { event: "Consent recorded for P. Kumar", actor: "Dr. Sharma", time: "22m ago" },
            ].map((event, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <p className="text-xs text-[var(--foreground-muted)] flex-1">{event.event}</p>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[var(--foreground-subtle)]">{event.actor}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)]">{event.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
