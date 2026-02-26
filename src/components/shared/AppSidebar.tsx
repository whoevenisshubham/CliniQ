"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Users,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Shield,
  FlaskConical,
  HeartPulse,
  CreditCard,
  Bell,
  ClipboardList,
  Globe,
  User,
  BriefcaseMedical,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { UserRole } from "@/lib/types";

// ─── Nav item definition ──────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "default" | "destructive" | "warning";
  description?: string;
}

// ─── Role-specific nav configs ─────────────────────────────────────────────────

const NAV_CONFIG: Record<UserRole, NavItem[]> = {
  doctor: [
    {
      label: "Dashboard",
      href: "/doctor",
      icon: Activity,
      description: "Today's schedule & alerts",
    },
    {
      label: "Patients",
      href: "/doctor/patients",
      icon: Users,
      description: "Patient records",
    },
    {
      label: "Active Consult",
      href: "/doctor/consultation",
      icon: Stethoscope,
      description: "Live scribing engine",
    },
    {
      label: "EMR Records",
      href: "/doctor/emr",
      icon: ClipboardList,
      description: "All medical records",
    },
    {
      label: "Safety Alerts",
      href: "/doctor/alerts",
      icon: Shield,
      badge: "3",
      badgeVariant: "destructive",
      description: "Drug & allergy alerts",
    },
    {
      label: "Billing",
      href: "/doctor/billing",
      icon: CreditCard,
      description: "Live billing drafts",
    },
  ],
  nurse: [
    { label: "Dashboard", href: "/doctor", icon: Activity },
    { label: "Patients", href: "/doctor/patients", icon: Users },
    { label: "Vitals Entry", href: "/doctor/vitals", icon: HeartPulse },
    { label: "Safety Alerts", href: "/doctor/alerts", icon: Shield, badge: "3", badgeVariant: "destructive" },
  ],
  patient: [
    { label: "My Health", href: "/patient", icon: HeartPulse },
    { label: "My Reports", href: "/patient/reports", icon: FileText },
    { label: "Prescriptions", href: "/patient/prescriptions", icon: BriefcaseMedical },
    { label: "Ask Questions", href: "/patient/chat", icon: Activity },
    { label: "My Account", href: "/patient/account", icon: User },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: BarChart3 },
    { label: "All Consultations", href: "/admin/consultations", icon: ClipboardList },
    { label: "User Management", href: "/admin/users", icon: Users },
    { label: "Audit Trail", href: "/admin/audit", icon: Shield },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
  research: [
    { label: "Insights", href: "/research", icon: FlaskConical },
    { label: "Epidemiology", href: "/research/epidemiology", icon: Globe },
    { label: "Case Repository", href: "/research/cases", icon: FileText },
    { label: "Analytics", href: "/research/analytics", icon: BarChart3 },
  ],
};

// ─── Role labels & colors ─────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; color: string; dot: string }> = {
  doctor: { label: "Physician", color: "text-blue-400", dot: "bg-blue-400" },
  nurse: { label: "Nurse", color: "text-teal-400", dot: "bg-teal-400" },
  patient: { label: "Patient", color: "text-green-400", dot: "bg-green-400" },
  admin: { label: "Administrator", color: "text-purple-400", dot: "bg-purple-400" },
  research: { label: "Researcher", color: "text-amber-400", dot: "bg-amber-400" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar_url?: string;
  };
  alertCount?: number;
  onSignOut?: () => void;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function AppSidebar({ user, alertCount = 0, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = NAV_CONFIG[user.role] ?? NAV_CONFIG.patient;
  const roleMeta = ROLE_META[user.role];

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="relative flex flex-col h-screen bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-hidden shrink-0"
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <span className="text-sm font-bold text-white tracking-tight">
                Nexus<span className="text-blue-400">MD</span>
              </span>
              <p className="text-[10px] text-[var(--foreground-subtle)] -mt-0.5 font-mono">
                Smart EMR v1.0
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── User card ─────────────────────────────────────────── */}
      <div className="px-3 py-3 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.avatar_url} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            {/* Online dot */}
            <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--sidebar-bg)]", roleMeta.dot)} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden min-w-0"
              >
                <p className="text-xs font-semibold text-[var(--foreground)] truncate">
                  {user.name}
                </p>
                <p className={cn("text-[10px] font-medium", roleMeta.color)}>
                  {roleMeta.label}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 2 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group",
                  isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-600/25"
                    : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-blue-400" : "text-[var(--foreground-subtle)] group-hover:text-[var(--foreground-muted)]"
                  )}
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="flex-1 truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!collapsed && item.badge && (
                  <Badge
                    variant={item.badgeVariant === "destructive" ? "destructive" : "default"}
                    className="text-[9px] px-1.5 py-0 h-4"
                  >
                    {item.badge}
                  </Badge>
                )}
                {collapsed && item.badge && (
                  <span className="absolute right-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* ─── Footer actions ─────────────────────────────────────── */}
      <div className="px-2 py-3 space-y-0.5">
        <button
          className={cn(
            "flex w-full items-center gap-3 px-2.5 py-2 rounded-lg text-xs text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition-colors"
          )}
          title={collapsed ? "Notifications" : undefined}
        >
          <Bell className="w-4 h-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 text-left"
              >
                Notifications
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && alertCount > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              {alertCount}
            </Badge>
          )}
        </button>

        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 px-2.5 py-2 rounded-lg text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ─── Collapse toggle ────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] flex items-center justify-center w-6 h-6 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors z-10 shadow-md"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </motion.aside>
  );
}
