"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Search, Plus, Edit3, Shield, UserCheck, UserX,
    Mail, Phone, Calendar, X, Check, Stethoscope, User,
    FlaskConical, HeartPulse
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/utils";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USERS = [
    { id: "u1", name: "Dr. Arjun Sharma", email: "arjun.sharma@nexusmd.app", role: "doctor" as const, department: "Internal Medicine", status: "active" as const, last_active: "2 min ago", consultations: 342, joined: "Jan 2024" },
    { id: "u2", name: "Dr. Neha Patel", email: "neha.patel@nexusmd.app", role: "doctor" as const, department: "General Medicine", status: "active" as const, last_active: "15 min ago", consultations: 287, joined: "Mar 2024" },
    { id: "u3", name: "Dr. Rajesh Gupta", email: "rajesh.gupta@nexusmd.app", role: "doctor" as const, department: "Cardiology", status: "active" as const, last_active: "1 hr ago", consultations: 156, joined: "Jun 2024" },
    { id: "u4", name: "Dr. Priya Desai", email: "priya.desai@nexusmd.app", role: "doctor" as const, department: "Endocrinology", status: "inactive" as const, last_active: "3 days ago", consultations: 89, joined: "Sep 2024" },
    { id: "u5", name: "Nurse Kavita", email: "kavita@nexusmd.app", role: "nurse" as const, department: "General Ward", status: "active" as const, last_active: "5 min ago", consultations: 0, joined: "Feb 2024" },
    { id: "u6", name: "Nurse Rajan", email: "rajan@nexusmd.app", role: "nurse" as const, department: "ICU", status: "active" as const, last_active: "30 min ago", consultations: 0, joined: "Apr 2024" },
    { id: "u7", name: "Priya Sharma", email: "priya.sharma@email.com", role: "patient" as const, department: "—", status: "active" as const, last_active: "1 hr ago", consultations: 8, joined: "Oct 2025" },
    { id: "u8", name: "Rajesh Kumar", email: "rajesh.kumar@email.com", role: "patient" as const, department: "—", status: "active" as const, last_active: "2 days ago", consultations: 3, joined: "Dec 2025" },
    { id: "u9", name: "Dr. Meera Nair", email: "meera.nair@nexusmd.app", role: "research" as const, department: "Clinical Research", status: "active" as const, last_active: "4 hr ago", consultations: 0, joined: "Jul 2024" },
    { id: "u10", name: "Admin User", email: "admin@nexusmd.app", role: "admin" as const, department: "Administration", status: "active" as const, last_active: "Just now", consultations: 0, joined: "Jan 2024" },
];

const ROLE_CONFIG = {
    doctor: { icon: Stethoscope, color: "text-blue-400", bg: "bg-blue-500/10", label: "Doctor" },
    nurse: { icon: HeartPulse, color: "text-teal-400", bg: "bg-teal-500/10", label: "Nurse" },
    patient: { icon: User, color: "text-green-400", bg: "bg-green-500/10", label: "Patient" },
    admin: { icon: Shield, color: "text-purple-400", bg: "bg-purple-500/10", label: "Admin" },
    research: { icon: FlaskConical, color: "text-amber-400", bg: "bg-amber-500/10", label: "Researcher" },
};

interface AdminUsersClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function AdminUsersClient({ user }: AdminUsersClientProps) {
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUser, setNewUser] = useState({ name: "", email: "", role: "doctor", department: "" });

    const filtered = useMemo(() => {
        return MOCK_USERS.filter((u) => {
            const matchesSearch =
                u.name.toLowerCase().includes(search.toLowerCase()) ||
                u.email.toLowerCase().includes(search.toLowerCase());
            const matchesRole = roleFilter === "all" || u.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [search, roleFilter]);

    const roleCounts = useMemo(() => {
        const counts: Record<string, number> = { all: MOCK_USERS.length };
        MOCK_USERS.forEach((u) => { counts[u.role] = (counts[u.role] || 0) + 1; });
        return counts;
    }, []);

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">User Management</h1>
                    <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                        Manage doctors, nurses, patients, and administrators
                    </p>
                </div>
                <Button size="sm" className="gap-1.5" onClick={() => setShowAddUser(true)}>
                    <Plus className="w-3.5 h-3.5" /> Add User
                </Button>
            </div>

            {/* Add User Form */}
            <AnimatePresence>
                {showAddUser && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        <Card className="border-blue-500/30">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2"><Plus className="w-4 h-4 text-blue-400" />Add New User</span>
                                    <button onClick={() => setShowAddUser(false)}><X className="w-4 h-4 text-[var(--foreground-subtle)]" /></button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Full Name</label>
                                        <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Dr. Jane Doe" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Email</label>
                                        <input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="jane@nexusmd.app" className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase">Role</label>
                                        <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                            <option value="doctor">Doctor</option>
                                            <option value="nurse">Nurse</option>
                                            <option value="patient">Patient</option>
                                            <option value="admin">Admin</option>
                                            <option value="research">Researcher</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <Button size="sm" className="w-full gap-1"><Check className="w-3.5 h-3.5" />Create User</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Role tabs + Search */}
            <div className="flex items-center gap-3">
                <div className="flex bg-[var(--surface)] rounded-lg p-0.5 border border-[var(--border)] overflow-x-auto">
                    {[
                        { key: "all", label: "All" },
                        { key: "doctor", label: "Doctors" },
                        { key: "nurse", label: "Nurses" },
                        { key: "patient", label: "Patients" },
                        { key: "admin", label: "Admins" },
                        { key: "research", label: "Researchers" },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setRoleFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${roleFilter === tab.key
                                    ? "bg-blue-600 text-white shadow"
                                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                }`}
                        >
                            {tab.label} ({roleCounts[tab.key] || 0})
                        </button>
                    ))}
                </div>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50" />
                </div>
            </div>

            {/* Users Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="grid grid-cols-[1fr_1fr_100px_100px_100px_80px] gap-2 px-4 py-2.5 border-b border-[var(--border)] text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider font-semibold">
                        <span>User</span>
                        <span>Email</span>
                        <span>Role</span>
                        <span>Last Active</span>
                        <span>Consults</span>
                        <span>Status</span>
                    </div>
                    {filtered.map((u, i) => {
                        const roleCfg = ROLE_CONFIG[u.role];
                        const RoleIcon = roleCfg.icon;
                        return (
                            <motion.div
                                key={u.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.02 }}
                                className="grid grid-cols-[1fr_1fr_100px_100px_100px_80px] gap-2 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-colors items-center"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <Avatar className="w-7 h-7 shrink-0">
                                        <AvatarFallback className="text-[10px]">{getInitials(u.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-[var(--foreground)] truncate">{u.name}</p>
                                        <p className="text-[10px] text-[var(--foreground-subtle)]">{u.department}</p>
                                    </div>
                                </div>
                                <span className="text-xs text-[var(--foreground-muted)] truncate">{u.email}</span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${roleCfg.color}`}>
                                    <RoleIcon className="w-3 h-3" /> {roleCfg.label}
                                </span>
                                <span className="text-[10px] text-[var(--foreground-subtle)]">{u.last_active}</span>
                                <span className="text-xs text-[var(--foreground)]">{u.consultations > 0 ? u.consultations : "—"}</span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${u.status === "active" ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
                                    }`}>
                                    {u.status === "active" ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                    {u.status}
                                </span>
                            </motion.div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
