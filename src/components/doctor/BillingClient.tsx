"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Search, IndianRupee, Clock, Receipt, Stethoscope,
  FlaskConical, Wrench, Pill, TrendingUp, Calendar, User,
  Download, Printer, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, FileText, X, Eye, Filter,
  Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Mock Billing Data ────────────────────────────────────────────────────────

interface BillingLineItem {
  description: string;
  category: "consultation" | "procedure" | "investigation" | "medication" | "equipment";
  quantity: number;
  unit_price: number;
  total: number;
}

interface BillingRecord {
  id: string;
  consultation_id: string;
  patient_name: string;
  patient_id: string;
  patient_age: number;
  patient_gender: string;
  doctor_name: string;
  date: string;
  consultation_type: "general" | "followup" | "emergency";
  duration_minutes: number;
  line_items: BillingLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  insurance: string;
  insurance_eligible: boolean;
  insurance_covered: number;
  patient_payable: number;
  payment_status: "paid" | "pending" | "partial" | "insurance-pending";
  payment_method?: string;
  receipt_no: string;
}

const MOCK_BILLING: BillingRecord[] = [
  {
    id: "bill-001",
    consultation_id: "c-001",
    patient_name: "Priya Sharma",
    patient_id: "p-001",
    patient_age: 45,
    patient_gender: "F",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-24",
    consultation_type: "followup",
    duration_minutes: 22,
    line_items: [
      { description: "Consultation Fee (Follow-up)", category: "consultation", quantity: 1, unit_price: 300, total: 300 },
      { description: "Extended Consultation (22 min)", category: "consultation", quantity: 22, unit_price: 12, total: 264 },
      { description: "Blood Glucose / HbA1c", category: "investigation", quantity: 1, unit_price: 150, total: 150 },
      { description: "Fundoscopy", category: "procedure", quantity: 1, unit_price: 250, total: 250 },
      { description: "Complete Blood Count (CBC)", category: "investigation", quantity: 1, unit_price: 250, total: 250 },
      { description: "Renal Function Test", category: "investigation", quantity: 1, unit_price: 350, total: 350 },
      { description: "Urine Routine + Microscopy", category: "investigation", quantity: 1, unit_price: 150, total: 150 },
    ],
    subtotal: 1714,
    discount: 0,
    tax: 86,
    total: 1800,
    insurance: "Star Health - Gold",
    insurance_eligible: true,
    insurance_covered: 1440,
    patient_payable: 360,
    payment_status: "paid",
    payment_method: "UPI",
    receipt_no: "NX-2026-0247",
  },
  {
    id: "bill-002",
    consultation_id: "c-002",
    patient_name: "Ramesh Patel",
    patient_id: "p-002",
    patient_age: 62,
    patient_gender: "M",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-24",
    consultation_type: "general",
    duration_minutes: 35,
    line_items: [
      { description: "Consultation Fee (General)", category: "consultation", quantity: 1, unit_price: 300, total: 300 },
      { description: "Extended Consultation (35 min)", category: "consultation", quantity: 35, unit_price: 12, total: 420 },
      { description: "12-Lead ECG", category: "investigation", quantity: 1, unit_price: 250, total: 250 },
      { description: "Clinical Auscultation", category: "procedure", quantity: 1, unit_price: 150, total: 150 },
      { description: "Cardiac Enzymes (Troponin)", category: "investigation", quantity: 1, unit_price: 900, total: 900 },
      { description: "Lipid Profile", category: "investigation", quantity: 1, unit_price: 400, total: 400 },
      { description: "Renal Function Test", category: "investigation", quantity: 1, unit_price: 350, total: 350 },
      { description: "Chest X-Ray", category: "investigation", quantity: 1, unit_price: 500, total: 500 },
      { description: "Pulse Oximetry Monitoring", category: "equipment", quantity: 1, unit_price: 100, total: 100 },
    ],
    subtotal: 3370,
    discount: 0,
    tax: 169,
    total: 3539,
    insurance: "CGHS",
    insurance_eligible: true,
    insurance_covered: 3539,
    patient_payable: 0,
    payment_status: "insurance-pending",
    receipt_no: "NX-2026-0248",
  },
  {
    id: "bill-003",
    consultation_id: "c-003",
    patient_name: "Anita Verma",
    patient_id: "p-003",
    patient_age: 34,
    patient_gender: "F",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-18",
    consultation_type: "general",
    duration_minutes: 15,
    line_items: [
      { description: "Consultation Fee (General)", category: "consultation", quantity: 1, unit_price: 300, total: 300 },
      { description: "Consultation Time (15 min)", category: "consultation", quantity: 15, unit_price: 12, total: 180 },
      { description: "Complete Blood Count (CBC)", category: "investigation", quantity: 1, unit_price: 250, total: 250 },
      { description: "Dengue Serology (NS1/IgM)", category: "investigation", quantity: 1, unit_price: 600, total: 600 },
      { description: "Malaria Thick Smear / ICT", category: "investigation", quantity: 1, unit_price: 300, total: 300 },
      { description: "Urine Routine + Microscopy", category: "investigation", quantity: 1, unit_price: 150, total: 150 },
    ],
    subtotal: 1780,
    discount: 0,
    tax: 89,
    total: 1869,
    insurance: "Ayushman Bharat",
    insurance_eligible: true,
    insurance_covered: 1869,
    patient_payable: 0,
    payment_status: "paid",
    payment_method: "Ayushman Bharat Card",
    receipt_no: "NX-2026-0234",
  },
  {
    id: "bill-004",
    consultation_id: "c-004",
    patient_name: "Suresh Kumar",
    patient_id: "p-004",
    patient_age: 55,
    patient_gender: "M",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-22",
    consultation_type: "followup",
    duration_minutes: 18,
    line_items: [
      { description: "Consultation Fee (Follow-up)", category: "consultation", quantity: 1, unit_price: 300, total: 300 },
      { description: "Consultation Time (18 min)", category: "consultation", quantity: 18, unit_price: 12, total: 216 },
      { description: "Renal Function Test", category: "investigation", quantity: 1, unit_price: 350, total: 350 },
      { description: "Electrolytes Panel", category: "investigation", quantity: 1, unit_price: 300, total: 300 },
      { description: "24hr Urine Protein", category: "investigation", quantity: 1, unit_price: 500, total: 500 },
      { description: "Renal Doppler USG", category: "investigation", quantity: 1, unit_price: 800, total: 800 },
      { description: "Fundoscopy", category: "procedure", quantity: 1, unit_price: 250, total: 250 },
    ],
    subtotal: 2716,
    discount: 200,
    tax: 126,
    total: 2642,
    insurance: "National Insurance - Mediclaim",
    insurance_eligible: true,
    insurance_covered: 2000,
    patient_payable: 642,
    payment_status: "pending",
    receipt_no: "NX-2026-0241",
  },
  {
    id: "bill-005",
    consultation_id: "c-005",
    patient_name: "Meera Singh",
    patient_id: "p-005",
    patient_age: 28,
    patient_gender: "F",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-15",
    consultation_type: "general",
    duration_minutes: 12,
    line_items: [
      { description: "Consultation Fee (General)", category: "consultation", quantity: 1, unit_price: 300, total: 300 },
      { description: "Consultation Time (12 min)", category: "consultation", quantity: 12, unit_price: 12, total: 144 },
      { description: "IgE Levels", category: "investigation", quantity: 1, unit_price: 400, total: 400 },
    ],
    subtotal: 844,
    discount: 0,
    tax: 42,
    total: 886,
    insurance: "ICICI Lombard",
    insurance_eligible: true,
    insurance_covered: 700,
    patient_payable: 186,
    payment_status: "paid",
    payment_method: "Card",
    receipt_no: "NX-2026-0228",
  },
  {
    id: "bill-006",
    consultation_id: "c-006",
    patient_name: "Vikram Malhotra",
    patient_id: "p-006",
    patient_age: 71,
    patient_gender: "M",
    doctor_name: "Dr. Arun Mehta",
    date: "2026-02-25",
    consultation_type: "emergency",
    duration_minutes: 45,
    line_items: [
      { description: "Consultation Fee (Emergency)", category: "consultation", quantity: 1, unit_price: 500, total: 500 },
      { description: "Extended Consultation (45 min)", category: "consultation", quantity: 45, unit_price: 12, total: 540 },
      { description: "Nebulisation — SABA (×3)", category: "procedure", quantity: 3, unit_price: 350, total: 1050 },
      { description: "Nebulisation — Ipratropium (×2)", category: "procedure", quantity: 2, unit_price: 350, total: 700 },
      { description: "Arterial Blood Gas (ABG)", category: "investigation", quantity: 1, unit_price: 700, total: 700 },
      { description: "Complete Blood Count (CBC)", category: "investigation", quantity: 1, unit_price: 250, total: 250 },
      { description: "CRP (C-Reactive Protein)", category: "investigation", quantity: 1, unit_price: 400, total: 400 },
      { description: "12-Lead ECG", category: "investigation", quantity: 1, unit_price: 250, total: 250 },
      { description: "Chest X-Ray", category: "investigation", quantity: 1, unit_price: 500, total: 500 },
      { description: "Blood Glucose / HbA1c", category: "investigation", quantity: 1, unit_price: 150, total: 150 },
      { description: "Digoxin Level", category: "investigation", quantity: 1, unit_price: 500, total: 500 },
      { description: "Sputum Culture & Sensitivity", category: "investigation", quantity: 1, unit_price: 800, total: 800 },
      { description: "Oxygen Therapy (6hrs)", category: "equipment", quantity: 6, unit_price: 200, total: 1200 },
      { description: "Cardiac Monitoring (6hrs)", category: "equipment", quantity: 6, unit_price: 500, total: 3000 },
      { description: "Pulse Oximetry Monitoring", category: "equipment", quantity: 1, unit_price: 100, total: 100 },
      { description: "Glucometry (×4)", category: "equipment", quantity: 4, unit_price: 80, total: 320 },
      { description: "IV Access + Fluid", category: "procedure", quantity: 1, unit_price: 250, total: 250 },
      { description: "Insulin Glargine Administration", category: "medication", quantity: 1, unit_price: 150, total: 150 },
      { description: "Prednisolone 40mg", category: "medication", quantity: 5, unit_price: 8, total: 40 },
      { description: "Azithromycin 500mg", category: "medication", quantity: 5, unit_price: 35, total: 175 },
    ],
    subtotal: 11075,
    discount: 500,
    tax: 529,
    total: 11104,
    insurance: "ECHS",
    insurance_eligible: true,
    insurance_covered: 11104,
    patient_payable: 0,
    payment_status: "insurance-pending",
    receipt_no: "NX-2026-0250",
  },
];

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: typeof Stethoscope; color: string; bg: string }> = {
  consultation: { icon: Stethoscope, color: "text-blue-400", bg: "bg-blue-500/10" },
  procedure: { icon: Wrench, color: "text-purple-400", bg: "bg-purple-500/10" },
  investigation: { icon: FlaskConical, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  medication: { icon: Pill, color: "text-green-400", bg: "bg-green-500/10" },
  equipment: { icon: Package, color: "text-amber-400", bg: "bg-amber-500/10" },
};

const PAYMENT_STATUS_CONFIG = {
  paid: { label: "Paid", variant: "success" as const, icon: CheckCircle2 },
  pending: { label: "Pending", variant: "warning" as const, icon: Clock },
  partial: { label: "Partial", variant: "default" as const, icon: AlertTriangle },
  "insurance-pending": { label: "Insurance Pending", variant: "default" as const, icon: FileText },
};

// ─── Stats ────────────────────────────────────────────────────────────────────

function getStats(bills: BillingRecord[]) {
  const totalRevenue = bills.reduce((s, b) => s + b.total, 0);
  const collected = bills.filter(b => b.payment_status === "paid").reduce((s, b) => s + b.patient_payable, 0) +
    bills.filter(b => b.payment_status === "paid").reduce((s, b) => s + b.insurance_covered, 0);
  const pending = bills.filter(b => b.payment_status === "pending" || b.payment_status === "insurance-pending").reduce((s, b) => s + b.total, 0);
  const insTotal = bills.reduce((s, b) => s + b.insurance_covered, 0);

  return [
    { label: "Total Revenue", value: formatINR(totalRevenue), icon: IndianRupee, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Collected", value: formatINR(collected), icon: CheckCircle2, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Pending", value: formatINR(pending), icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Insurance Claims", value: formatINR(insTotal), icon: FileText, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];
}

// ─── Billing Detail Drawer ────────────────────────────────────────────────────

function BillingDetail({ bill, onClose }: { bill: BillingRecord; onClose: () => void }) {
  const statusCfg = PAYMENT_STATUS_CONFIG[bill.payment_status];
  const StatusIcon = statusCfg.icon;

  // Group line items by category
  const grouped = bill.line_items.reduce<Record<string, BillingLineItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ x: 600 }}
        animate={{ x: 0 }}
        exit={{ x: 600 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-xl bg-[var(--background)] border-l border-[var(--border)] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--border)] px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={statusCfg.variant} className="gap-1 text-[10px]">
                  <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                </Badge>
                <span className="text-[10px] text-[var(--foreground-subtle)] font-mono">{bill.receipt_no}</span>
              </div>
              <h2 className="text-base font-bold text-[var(--foreground)]">{bill.patient_name}</h2>
              <p className="text-xs text-[var(--foreground-muted)]">
                {bill.patient_age}{bill.patient_gender} · {formatDate(bill.date)} · {bill.doctor_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Printer className="w-3 h-3" /> Print
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Download className="w-3 h-3" /> PDF
              </Button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--foreground-subtle)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Total banner */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Invoice Total</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">{bill.duration_minutes} min · {bill.line_items.length} items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-amber-400">{formatINR(bill.total)}</p>
              <p className="text-[9px] text-[var(--foreground-subtle)]">incl. 5% GST</p>
            </div>
          </div>

          {/* Consultation info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <p className="text-[10px] text-[var(--foreground-subtle)]">Type</p>
              <p className="text-xs font-medium text-[var(--foreground)] capitalize">{bill.consultation_type}</p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <p className="text-[10px] text-[var(--foreground-subtle)]">Duration</p>
              <p className="text-xs font-medium text-[var(--foreground)]">{bill.duration_minutes} min</p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <p className="text-[10px] text-[var(--foreground-subtle)]">Payment</p>
              <p className="text-xs font-medium text-[var(--foreground)]">{bill.payment_method || "N/A"}</p>
            </div>
          </div>

          {/* Line items by category */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">Itemized Breakdown</h3>
            {Object.entries(grouped).map(([category, items]) => {
              const catCfg = CATEGORY_CONFIG[category];
              const CatIcon = catCfg?.icon || Stethoscope;
              const catTotal = items.reduce((s, it) => s + it.total, 0);
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={cn(
                      "text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1",
                      catCfg?.color || "text-[var(--foreground-muted)]"
                    )}>
                      <CatIcon className="w-3 h-3" /> {category}
                    </p>
                    <span className="text-[10px] font-medium text-[var(--foreground-muted)]">{formatINR(catTotal)}</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                        <span className="text-xs text-[var(--foreground-muted)] truncate flex-1">{item.description}</span>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          {item.quantity > 1 && (
                            <span className="text-[9px] text-[var(--foreground-subtle)]">×{item.quantity}</span>
                          )}
                          <span className="text-xs font-medium text-[var(--foreground)] min-w-[60px] text-right">{formatINR(item.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="border-t border-[var(--border)] pt-4 space-y-2">
            <div className="flex justify-between text-xs text-[var(--foreground-muted)]">
              <span>Subtotal</span>
              <span>{formatINR(bill.subtotal)}</span>
            </div>
            {bill.discount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>Discount</span>
                <span>-{formatINR(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-[var(--foreground-muted)]">
              <span>GST (5%)</span>
              <span>{formatINR(bill.tax)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[var(--foreground)] pt-2 border-t border-[var(--border)]">
              <span>Total</span>
              <span className="text-amber-400">{formatINR(bill.total)}</span>
            </div>
          </div>

          {/* Insurance */}
          {bill.insurance_eligible && (
            <div className="p-4 rounded-xl bg-blue-500/8 border border-blue-500/20 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold flex items-center gap-1">
                <FileText className="w-3 h-3" /> Insurance Details
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--foreground-muted)]">Provider</span>
                <span className="text-[var(--foreground)] font-medium">{bill.insurance}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--foreground-muted)]">Covered Amount</span>
                <span className="text-blue-400 font-medium">{formatINR(bill.insurance_covered)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--foreground-muted)]">Patient Payable</span>
                <span className="text-[var(--foreground)] font-bold">{formatINR(bill.patient_payable)}</span>
              </div>
              {bill.patient_payable === 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-green-400 font-medium">Fully covered by insurance</span>
                </div>
              )}
            </div>
          )}

          {/* Ayushman note */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/15">
            <IndianRupee className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <p className="text-[10px] text-green-300">
              Eligible for Ayushman Bharat / CGHS / ECHS reimbursement. ABHA-linked billing supported.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Billing Row ──────────────────────────────────────────────────────────────

function BillingRow({ bill, index, onClick }: { bill: BillingRecord; index: number; onClick: () => void }) {
  const statusCfg = PAYMENT_STATUS_CONFIG[bill.payment_status];
  const StatusIcon = statusCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="flex items-center gap-4 p-3.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-all cursor-pointer group"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
        <Receipt className="w-4 h-4 text-amber-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">{bill.patient_name}</p>
          <span className="text-[10px] text-[var(--foreground-subtle)]">{bill.patient_age}{bill.patient_gender}</span>
          <Badge variant={statusCfg.variant} className="text-[9px] py-0 px-1.5 h-3.5 gap-0.5">
            <StatusIcon className="w-2.5 h-2.5" /> {statusCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
          {bill.receipt_no} · {bill.line_items.length} items · {bill.duration_minutes} min
        </p>
      </div>

      {/* Type */}
      <Badge variant="outline" className="text-[10px] capitalize shrink-0">
        {bill.consultation_type}
      </Badge>

      {/* Insurance */}
      <div className="text-center shrink-0 hidden md:block">
        <p className="text-[10px] text-[var(--foreground-subtle)]">Insurance</p>
        <p className="text-[10px] font-medium text-blue-400 truncate max-w-[100px]">{bill.insurance}</p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-amber-400">{formatINR(bill.total)}</p>
        {bill.patient_payable > 0 && bill.patient_payable < bill.total && (
          <p className="text-[10px] text-[var(--foreground-subtle)]">Patient: {formatINR(bill.patient_payable)}</p>
        )}
      </div>

      {/* Date */}
      <div className="text-right shrink-0">
        <p className="text-xs text-[var(--foreground-muted)]">{formatDate(bill.date)}</p>
      </div>

      <ChevronRight className="w-4 h-4 text-[var(--foreground-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.div>
  );
}

// ─── Revenue Breakdown Chart (Simple) ─────────────────────────────────────────

function RevenueBreakdown({ bills }: { bills: BillingRecord[] }) {
  const allItems = bills.flatMap(b => b.line_items);
  const byCategory = Object.entries(
    allItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.total;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const total = byCategory.reduce((s, [, v]) => s + v, 0);

  return (
    <Card className="border-[var(--border)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs">
          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          Revenue by Category
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {byCategory.map(([cat, amount]) => {
          const catCfg = CATEGORY_CONFIG[cat];
          const CatIcon = catCfg?.icon || Stethoscope;
          const pct = Math.round((amount / total) * 100);
          return (
            <div key={cat} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={cn("text-xs flex items-center gap-1 capitalize", catCfg?.color || "text-[var(--foreground-muted)]")}>
                  <CatIcon className="w-3 h-3" /> {cat}
                </span>
                <span className="text-xs font-medium text-[var(--foreground)]">{formatINR(amount)} ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className={cn("h-full rounded-full", catCfg?.bg || "bg-blue-500/30")}
                  style={{ backgroundColor: catCfg?.color.replace("text-", "").includes("blue") ? "rgb(96,165,250)" : catCfg?.color.includes("purple") ? "rgb(192,132,252)" : catCfg?.color.includes("cyan") ? "rgb(34,211,238)" : catCfg?.color.includes("green") ? "rgb(74,222,128)" : "rgb(251,191,36)" }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BillingClientProps {
  user: { id: string; name: string; email: string; role: string };
}

export function BillingClient({ user }: BillingClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BillingRecord["payment_status"]>("all");
  const [selectedBill, setSelectedBill] = useState<BillingRecord | null>(null);

  const filteredBills = useMemo(() => {
    return MOCK_BILLING.filter((b) => {
      if (statusFilter !== "all" && b.payment_status !== statusFilter) return false;
      const matchesSearch =
        b.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.receipt_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.insurance.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [searchQuery, statusFilter]);

  const stats = getStats(MOCK_BILLING);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            Billing & Invoices
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
            {MOCK_BILLING.length} invoices · Auto-generated from consultations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-[var(--border)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--foreground-subtle)]">{stat.label}</p>
                      <p className="text-lg font-bold text-[var(--foreground)] mt-0.5">{stat.value}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main billing list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patient, receipt #, or insurance..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(["all", "paid", "pending", "insurance-pending"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                    statusFilter === status
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {status === "all" ? "All" : status === "insurance-pending" ? "Insurance" : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Billing List */}
          <div className="space-y-2">
            {filteredBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--foreground-subtle)]">
                <CreditCard className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No invoices match your search</p>
              </div>
            ) : (
              filteredBills.map((bill, i) => (
                <BillingRow
                  key={bill.id}
                  bill={bill}
                  index={i}
                  onClick={() => setSelectedBill(bill)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Revenue breakdown */}
          <RevenueBreakdown bills={MOCK_BILLING} />

          {/* Recent activity */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { action: "Invoice generated", patient: "V. Malhotra", amount: "₹11,104", time: "10:35 AM", color: "text-amber-400" },
                { action: "Payment received", patient: "P. Sharma", amount: "₹360", time: "09:45 AM", color: "text-green-400" },
                { action: "Insurance claim filed", patient: "R. Patel", amount: "₹3,539", time: "09:20 AM", color: "text-blue-400" },
                { action: "Invoice generated", patient: "S. Kumar", amount: "₹2,642", time: "Yesterday", color: "text-amber-400" },
                { action: "Payment received", patient: "M. Singh", amount: "₹186", time: "Feb 15", color: "text-green-400" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", item.color.replace("text-", "bg-"))} />
                  <span className="text-[var(--foreground-muted)] flex-1 truncate">{item.action} — {item.patient}</span>
                  <span className={cn("font-medium shrink-0", item.color)}>{item.amount}</span>
                  <span className="text-[var(--foreground-subtle)] shrink-0 text-[10px]">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Insurance summary */}
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                Insurance Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(
                MOCK_BILLING.reduce<Record<string, number>>((acc, b) => {
                  acc[b.insurance] = (acc[b.insurance] || 0) + b.insurance_covered;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).map(([insurer, amount]) => (
                <div key={insurer} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--foreground-muted)] truncate flex-1">{insurer}</span>
                  <span className="text-purple-400 font-medium shrink-0">{formatINR(amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Billing Detail Drawer */}
      <AnimatePresence>
        {selectedBill && (
          <BillingDetail bill={selectedBill} onClose={() => setSelectedBill(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
