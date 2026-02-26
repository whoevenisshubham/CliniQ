"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Users, Search, Plus, ChevronRight, Filter, Phone,
  Stethoscope, AlertTriangle, Calendar, Heart, Droplets,
  Shield, FileText, Activity, Clock, MapPin, X,
  ChevronDown, ChevronUp, Eye, Edit3, Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, getInitials } from "@/lib/utils";

// ─── Comprehensive Mock Data ─────────────────────────────────────────────────

const MOCK_PATIENTS = [
  {
    id: "p-001",
    name: "Priya Sharma",
    age: 45,
    gender: "F" as const,
    phone: "+91 98765 43210",
    blood_group: "B+",
    dob: "1981-03-15",
    abha_id: "ABHA-1234-5678-9012",
    address: "42, Defence Colony, New Delhi",
    allergies: ["Penicillin", "Sulfa drugs"],
    chronic_conditions: ["Type 2 Diabetes", "Hypertension"],
    emergency_contact: "+91 98765 43211 (Husband - Rajesh Sharma)",
    last_visit: "2026-02-20",
    total_visits: 14,
    status: "active" as const,
    insurance: "Star Health - Gold",
    vitals: { bp: "148/92", sugar: "186 mg/dL", weight: "72 kg" },
    upcoming_appointment: "2026-02-28 10:00 AM",
    risk_level: "high" as const,
  },
  {
    id: "p-002",
    name: "Ramesh Patel",
    age: 62,
    gender: "M" as const,
    phone: "+91 87654 32109",
    blood_group: "O+",
    dob: "1964-07-22",
    abha_id: "ABHA-2345-6789-0123",
    address: "15, Jubilee Hills, Hyderabad",
    allergies: ["Aspirin"],
    chronic_conditions: ["Coronary Artery Disease", "Hyperlipidemia"],
    emergency_contact: "+91 87654 32110 (Wife - Sunita Patel)",
    last_visit: "2026-02-24",
    total_visits: 22,
    status: "active" as const,
    insurance: "CGHS",
    vitals: { bp: "138/88", sugar: "112 mg/dL", weight: "78 kg" },
    upcoming_appointment: "2026-03-01 11:00 AM",
    risk_level: "critical" as const,
  },
  {
    id: "p-003",
    name: "Anita Verma",
    age: 34,
    gender: "F" as const,
    phone: "+91 76543 21098",
    blood_group: "A+",
    dob: "1992-11-08",
    abha_id: "ABHA-3456-7890-1234",
    address: "78, Koramangala, Bangalore",
    allergies: [],
    chronic_conditions: ["Migraine"],
    emergency_contact: "+91 76543 21099 (Mother - Kanta Verma)",
    last_visit: "2026-02-18",
    total_visits: 6,
    status: "active" as const,
    insurance: "Ayushman Bharat",
    vitals: { bp: "118/76", sugar: "94 mg/dL", weight: "58 kg" },
    upcoming_appointment: null,
    risk_level: "low" as const,
  },
  {
    id: "p-004",
    name: "Suresh Kumar",
    age: 55,
    gender: "M" as const,
    phone: "+91 65432 10987",
    blood_group: "AB+",
    dob: "1971-01-30",
    abha_id: "ABHA-4567-8901-2345",
    address: "23, Salt Lake, Kolkata",
    allergies: ["Ibuprofen", "Codeine"],
    chronic_conditions: ["Hypertension", "Chronic Kidney Disease Stage 3"],
    emergency_contact: "+91 65432 10988 (Son - Amit Kumar)",
    last_visit: "2026-02-22",
    total_visits: 18,
    status: "active" as const,
    insurance: "National Insurance - Mediclaim",
    vitals: { bp: "156/98", sugar: "128 mg/dL", weight: "85 kg" },
    upcoming_appointment: "2026-02-27 02:00 PM",
    risk_level: "high" as const,
  },
  {
    id: "p-005",
    name: "Meera Singh",
    age: 28,
    gender: "F" as const,
    phone: "+91 54321 09876",
    blood_group: "O-",
    dob: "1998-06-12",
    abha_id: "ABHA-5678-9012-3456",
    address: "56, Bandra West, Mumbai",
    allergies: ["Latex"],
    chronic_conditions: [],
    emergency_contact: "+91 54321 09877 (Father - Harpreet Singh)",
    last_visit: "2026-02-15",
    total_visits: 3,
    status: "active" as const,
    insurance: "ICICI Lombard",
    vitals: { bp: "110/70", sugar: "88 mg/dL", weight: "54 kg" },
    upcoming_appointment: null,
    risk_level: "low" as const,
  },
  {
    id: "p-006",
    name: "Vikram Malhotra",
    age: 71,
    gender: "M" as const,
    phone: "+91 43210 98765",
    blood_group: "B-",
    dob: "1955-04-19",
    abha_id: "ABHA-6789-0123-4567",
    address: "9, Civil Lines, Lucknow",
    allergies: ["Metformin", "ACE Inhibitors"],
    chronic_conditions: ["COPD", "Atrial Fibrillation", "Type 2 Diabetes"],
    emergency_contact: "+91 43210 98766 (Daughter - Kavita Malhotra)",
    last_visit: "2026-02-25",
    total_visits: 31,
    status: "active" as const,
    insurance: "ECHS",
    vitals: { bp: "142/86", sugar: "210 mg/dL", weight: "68 kg" },
    upcoming_appointment: "2026-02-26 09:00 AM",
    risk_level: "critical" as const,
  },
  {
    id: "p-007",
    name: "Lakshmi Iyer",
    age: 50,
    gender: "F" as const,
    phone: "+91 32109 87654",
    blood_group: "A-",
    dob: "1976-09-03",
    abha_id: "ABHA-7890-1234-5678",
    address: "14, T Nagar, Chennai",
    allergies: ["Shellfish"],
    chronic_conditions: ["Hypothyroidism", "Osteoarthritis"],
    emergency_contact: "+91 32109 87655 (Husband - Ravi Iyer)",
    last_visit: "2026-01-28",
    total_visits: 9,
    status: "inactive" as const,
    insurance: "New India Assurance",
    vitals: { bp: "126/82", sugar: "102 mg/dL", weight: "66 kg" },
    upcoming_appointment: null,
    risk_level: "low" as const,
  },
  {
    id: "p-008",
    name: "Arjun Reddy",
    age: 38,
    gender: "M" as const,
    phone: "+91 21098 76543",
    blood_group: "O+",
    dob: "1988-12-25",
    abha_id: "ABHA-8901-2345-6789",
    address: "31, Banjara Hills, Hyderabad",
    allergies: [],
    chronic_conditions: ["Asthma"],
    emergency_contact: "+91 21098 76544 (Wife - Divya Reddy)",
    last_visit: "2026-02-10",
    total_visits: 7,
    status: "active" as const,
    insurance: "Max Bupa",
    vitals: { bp: "122/78", sugar: "96 mg/dL", weight: "76 kg" },
    upcoming_appointment: "2026-03-05 03:30 PM",
    risk_level: "low" as const,
  },
];

type PatientType = typeof MOCK_PATIENTS[0];

// ─── Patient stats ────────────────────────────────────────────────────────────

const STATS = [
  { label: "Total Patients", value: MOCK_PATIENTS.length.toString(), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "High Risk", value: MOCK_PATIENTS.filter(p => p.risk_level === "critical" || p.risk_level === "high").length.toString(), icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  { label: "Today's Appts", value: "3", icon: Calendar, color: "text-green-400", bg: "bg-green-500/10" },
  { label: "Active Cases", value: MOCK_PATIENTS.filter(p => p.status === "active").length.toString(), icon: Activity, color: "text-amber-400", bg: "bg-amber-500/10" },
];

// ─── Risk level config ────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low: { label: "Low Risk", variant: "success" as const, dot: "bg-green-400" },
  high: { label: "High Risk", variant: "warning" as const, dot: "bg-amber-400" },
  critical: { label: "Critical", variant: "destructive" as const, dot: "bg-red-400" },
};

// ─── Filter options ───────────────────────────────────────────────────────────

type FilterKey = "all" | "critical" | "high" | "low" | "active" | "inactive";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High Risk" },
  { key: "low", label: "Low Risk" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

// ─── Patient Detail Drawer ────────────────────────────────────────────────────

function PatientDetail({ patient, onClose }: { patient: PatientType; onClose: () => void }) {
  const risk = RISK_CONFIG[patient.risk_level];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-lg bg-[var(--background)] border-l border-[var(--border)] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--border)] px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold",
                patient.risk_level === "critical" ? "bg-red-500/20 text-red-400" :
                patient.risk_level === "high" ? "bg-amber-500/20 text-amber-400" :
                "bg-blue-500/20 text-blue-400"
              )}>
                {getInitials(patient.name)}
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">{patient.name}</h2>
                <p className="text-xs text-[var(--foreground-muted)]">
                  {patient.age}{patient.gender} · {patient.blood_group} · ID: {patient.id.toUpperCase()}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--foreground-subtle)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant={risk.variant}>{risk.label}</Badge>
            <Badge variant="secondary">{patient.insurance}</Badge>
            <Badge variant="outline" className="font-mono text-[10px]">{patient.abha_id}</Badge>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Link href={`/doctor/consultation/new?patientId=${patient.id}`}>
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                <Stethoscope className="w-3.5 h-3.5" /> Consult
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> EMR
            </Button>
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
              <Phone className="w-3.5 h-3.5" /> Call
            </Button>
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">Contact Information</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                <Phone className="w-3 h-3 text-[var(--foreground-subtle)]" /> {patient.phone}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                <MapPin className="w-3 h-3 text-[var(--foreground-subtle)]" /> {patient.address}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                <Shield className="w-3 h-3 text-[var(--foreground-subtle)]" /> Emergency: {patient.emergency_contact}
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">Latest Vitals</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <p className="text-[10px] text-[var(--foreground-subtle)]">Blood Pressure</p>
                <p className="text-sm font-bold text-[var(--foreground)]">{patient.vitals.bp}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">mmHg</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <p className="text-[10px] text-[var(--foreground-subtle)]">Blood Sugar</p>
                <p className="text-sm font-bold text-[var(--foreground)]">{patient.vitals.sugar.replace(" mg/dL", "")}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">mg/dL</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <p className="text-[10px] text-[var(--foreground-subtle)]">Weight</p>
                <p className="text-sm font-bold text-[var(--foreground)]">{patient.vitals.weight.replace(" kg", "")}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">kg</p>
              </div>
            </div>
          </div>

          {/* Allergies */}
          {patient.allergies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Allergies
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.map((a) => (
                  <Badge key={a} variant="destructive" className="text-[10px]">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Chronic Conditions */}
          {patient.chronic_conditions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Heart className="w-3 h-3" /> Chronic Conditions
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {patient.chronic_conditions.map((c) => (
                  <Badge key={c} variant="warning" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Visit History */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">Visit History</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--foreground-muted)]">Total Visits</span>
                <span className="text-[var(--foreground)] font-medium">{patient.total_visits}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--foreground-muted)]">Last Visit</span>
                <span className="text-[var(--foreground)] font-medium">{formatDate(patient.last_visit)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--foreground-muted)]">Date of Birth</span>
                <span className="text-[var(--foreground)] font-medium">{formatDate(patient.dob)}</span>
              </div>
              {patient.upcoming_appointment && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--foreground-muted)]">Next Appointment</span>
                  <span className="text-green-400 font-medium">{patient.upcoming_appointment}</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent consultations */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">Recent Consultations</h3>
            {[
              { date: patient.last_visit, complaint: patient.chronic_conditions[0] || "General checkup", type: "Follow-up", doctor: "Dr. Arun Mehta" },
              { date: "2026-01-20", complaint: "Routine blood work review", type: "Lab Review", doctor: "Dr. Arun Mehta" },
              { date: "2025-12-15", complaint: "Medication adjustment", type: "Follow-up", doctor: "Dr. Arun Mehta" },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">{c.complaint}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)]">{c.type} · {c.doctor}</p>
                </div>
                <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0">{formatDate(c.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Patient Row ──────────────────────────────────────────────────────────────

function PatientRow({ patient, index, onClick }: { patient: PatientType; index: number; onClick: () => void }) {
  const risk = RISK_CONFIG[patient.risk_level];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-3.5 rounded-xl border transition-all cursor-pointer group",
        patient.risk_level === "critical"
          ? "border-red-500/25 bg-red-500/5 hover:bg-red-500/10"
          : patient.risk_level === "high"
          ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
          : "border-[var(--border)] hover:bg-[var(--surface-elevated)]"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold shrink-0",
        patient.risk_level === "critical" ? "bg-red-500/20 text-red-400" :
        patient.risk_level === "high" ? "bg-amber-500/20 text-amber-400" :
        "bg-blue-500/20 text-blue-400"
      )}>
        {getInitials(patient.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">{patient.name}</p>
          <span className="text-[10px] text-[var(--foreground-subtle)]">{patient.age}{patient.gender}</span>
          <Badge variant={risk.variant} className="text-[9px] py-0 px-1.5 h-3.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", risk.dot)} />
            {risk.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-[var(--foreground-muted)] truncate">
            {patient.chronic_conditions.length > 0 ? patient.chronic_conditions.join(", ") : "No chronic conditions"}
          </p>
        </div>
      </div>

      {/* Allergies indicator */}
      {patient.allergies.length > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span className="text-[10px] text-red-400">{patient.allergies.length}</span>
        </div>
      )}

      {/* Blood group */}
      <div className="shrink-0">
        <Badge variant="outline" className="text-[10px] font-mono">
          <Droplets className="w-2.5 h-2.5 mr-0.5" />
          {patient.blood_group}
        </Badge>
      </div>

      {/* Last visit */}
      <div className="text-right shrink-0">
        <p className="text-[10px] text-[var(--foreground-subtle)]">Last visit</p>
        <p className="text-xs font-medium text-[var(--foreground-muted)]">{formatDate(patient.last_visit)}</p>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-[var(--foreground-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PatientsClientProps {
  user: { id: string; name: string; email: string; role: string };
}

export function PatientsClient({ user }: PatientsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedPatient, setSelectedPatient] = useState<PatientType | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "risk" | "lastVisit">("risk");

  const filteredPatients = useMemo(() => {
    let list = MOCK_PATIENTS.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone.includes(searchQuery) ||
        p.abha_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.chronic_conditions.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;

      switch (activeFilter) {
        case "critical": return p.risk_level === "critical";
        case "high": return p.risk_level === "high";
        case "low": return p.risk_level === "low";
        case "active": return p.status === "active";
        case "inactive": return p.status === "inactive";
        default: return true;
      }
    });

    // Sort
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "lastVisit") return new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime();
      // risk: critical > high > low
      const riskOrder = { critical: 0, high: 1, low: 2 };
      return riskOrder[a.risk_level] - riskOrder[b.risk_level];
    });

    return list;
  }, [searchQuery, activeFilter, sortBy]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Patient Registry
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
            {MOCK_PATIENTS.length} patients · {MOCK_PATIENTS.filter(p => p.status === "active").length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Patient
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-[var(--border)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--foreground-subtle)]">{stat.label}</p>
                      <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{stat.value}</p>
                    </div>
                    <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", stat.bg)}>
                      <Icon className={cn("w-4 h-4", stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, ABHA ID, or condition..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                activeFilter === f.key
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 rounded-lg text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] focus:outline-none cursor-pointer"
        >
          <option value="risk">Sort: Risk Level</option>
          <option value="name">Sort: Name</option>
          <option value="lastVisit">Sort: Last Visit</option>
        </select>
      </div>

      {/* Patient List */}
      <div className="space-y-2">
        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--foreground-subtle)]">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No patients match your search</p>
            <p className="text-xs mt-1">Try adjusting your filters or search query</p>
          </div>
        ) : (
          filteredPatients.map((patient, i) => (
            <PatientRow
              key={patient.id}
              patient={patient}
              index={i}
              onClick={() => setSelectedPatient(patient)}
            />
          ))
        )}
      </div>

      {/* Patient Detail Drawer */}
      <AnimatePresence>
        {selectedPatient && (
          <PatientDetail
            patient={selectedPatient}
            onClose={() => setSelectedPatient(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
