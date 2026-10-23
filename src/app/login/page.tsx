"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

const ROLE_PATHS: Record<string, string> = {
  doctor: "/doctor", nurse: "/doctor",
  patient: "/patient", admin: "/admin", research: "/research",
  receptionist: "/receptionist",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(e: string, p: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "Sign-in failed. Try again."); return; }
      const role = data.data?.user?.role;
      if (typeof role !== "string" || !ROLE_PATHS[role]) { setError("Sign-in could not be confirmed."); return; }
      // A new document clears the previous actor's in-memory editor/capture state.
      window.location.assign(ROLE_PATHS[role]);
    } catch { setError("Unable to reach sign-in. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex clinical-grid">
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-bold text-[var(--foreground)]">CLINIQ<span className="text-[var(--primary)]">+</span></span>
        </div>
        <div className="space-y-5">
          <h1 className="text-4xl font-bold text-[var(--foreground)] leading-tight">
            Your records.<br /><span className="text-[var(--primary)]">Your context.</span>
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-w-xs">
            Private records and source text for your next care conversation. Clinical features are still being built and verified.
          </p>
        </div>
        <p className="text-xs text-[var(--foreground-subtle)]">Educational workspace · Synthetic data only</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-1">Sign in</h2>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">Access your clinical workspace</p>

          <div className="mb-5 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">Use a provisioned workspace account. Hosted demo access is not yet configured.</p>
          </div>

          <form onSubmit={(ev) => { ev.preventDefault(); doLogin(email, password); }} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
                <input id="email" autoComplete="username" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="doctor@hospital.com"
                  className="w-full pl-10 pr-4 py-2.5 text-base bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
                <input id="password" autoComplete="current-password" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-base bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
                <button type="button" aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw} onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--foreground)] text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
