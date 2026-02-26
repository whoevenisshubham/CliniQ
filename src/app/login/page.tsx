"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

const DEMO_ROLES = [
  { label: "Doctor", email: "demo.doctor@nexusmd.app" },
  { label: "Patient", email: "demo.patient@nexusmd.app" },
  { label: "Admin", email: "demo.admin@nexusmd.app" },
  { label: "Reception", email: "demo.reception@nexusmd.app" },
] as const;

const ROLE_PATHS: Record<string, string> = {
  doctor: "/doctor", nurse: "/doctor",
  patient: "/patient", admin: "/admin", research: "/research",
  receptionist: "/receptionist",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(e: string, p: string) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, password: p }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Login failed"); setLoading(false); return; }
    router.push(ROLE_PATHS[data.user.role] ?? "/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex clinical-grid">
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Nexus<span className="text-blue-400">MD</span></span>
        </div>
        <div className="space-y-5">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Every Word<br /><span className="text-blue-400">Heals.</span>
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-w-xs">
            AI-powered ambient clinical documentation. Real-time ICD mapping. Safety guards. Built for Indian healthcare.
          </p>
        </div>
        <p className="text-[10px] text-[var(--foreground-subtle)]">ABDM Compliant · HIPAA Standards · ICD-10</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-1">Sign in</h2>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">Access your clinical workspace</p>

          <div className="mb-5 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-[10px] text-[var(--foreground-subtle)] mb-2 font-medium uppercase tracking-wider">Quick demo — one click login</p>
            <div className="flex gap-2">
              {DEMO_ROLES.map(({ label, email: e }) => (
                <button key={label} onClick={() => doLogin(e, "demo123456")} disabled={loading}
                  className="flex-1 text-[11px] py-2 rounded-md bg-[var(--surface-elevated)] text-[var(--foreground-muted)] hover:text-white hover:bg-blue-600 border border-[var(--border)] font-medium transition-colors disabled:opacity-40">
                  {loading ? "…" : label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(ev) => { ev.preventDefault(); doLogin(email, password); }} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="doctor@hospital.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-5 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            <p className="text-[10px] text-[var(--foreground-subtle)] font-mono">
              demo.doctor@nexusmd.app<br />
              demo.patient@nexusmd.app<br />
              demo.admin@nexusmd.app<br />
              demo.reception@nexusmd.app<br />
              <span className="text-[var(--foreground-muted)]">password: demo123456</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
