"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    Settings, Save, Building2, Globe, Clock, Languages,
    Brain, Mic, Shield, Link2, Bell, MessageSquare,
    Database, Trash2, HardDrive, RefreshCw, Check,
    ChevronRight, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ─── Settings state ────────────────────────────────────────────────────────────

interface ToggleItem {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    icon: typeof Shield;
    color: string;
}

interface AdminSettingsClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function AdminSettingsClient({ user }: AdminSettingsClientProps) {
    const [saved, setSaved] = useState(false);
    const [hospital, setHospital] = useState({
        name: "NexusMD City Hospital",
        address: "Sector 15, Gurugram, Haryana 122001",
        timezone: "Asia/Kolkata",
        language: "en",
        phone: "+91 124 456 7890",
        license: "NABH-2024-GUR-001",
    });

    const [aiConfig, setAiConfig] = useState({
        groq_model: "llama-3.3-70b-versatile",
        temperature: "0.3",
        max_tokens: "1024",
        deepgram_model: "nova-2-medical",
        deepgram_language: "multi",
    });

    const [compliance, setCompliance] = useState<ToggleItem[]>([
        { id: "abdm", label: "ABDM Integration", description: "Ayushman Bharat Digital Mission — ABHA ID verification and health record exchange", enabled: true, icon: Shield, color: "text-green-400" },
        { id: "hipaa", label: "HIPAA Compliance Mode", description: "Enable HIPAA-grade encryption and access controls for all patient data", enabled: true, icon: Shield, color: "text-blue-400" },
        { id: "audit_chain", label: "Audit Chain (Append-only)", description: "Blockchain-like immutable audit log for all system events", enabled: true, icon: Database, color: "text-purple-400" },
        { id: "consent_esign", label: "OTP-based eSign Consent", description: "Legally valid digital consent using IT Act-compliant eSign via OTP", enabled: true, icon: Shield, color: "text-amber-400" },
        { id: "voice_consent", label: "Voice Consent Recording", description: "Record and cryptographically link voice consent to patient records", enabled: true, icon: Mic, color: "text-cyan-400" },
    ]);

    const [integrations, setIntegrations] = useState<ToggleItem[]>([
        { id: "insurance", label: "Insurance API", description: "Auto-submit claims to insurance providers with ICD codes and reports", enabled: false, icon: Link2, color: "text-blue-400" },
        { id: "pharmacy", label: "Pharmacy Inventory Link", description: "Real-time stock check and alternative suggestion for prescriptions", enabled: true, icon: Link2, color: "text-green-400" },
        { id: "whatsapp", label: "WhatsApp Notifications", description: "Send patient summaries, reminders, and reports via WhatsApp Business API", enabled: true, icon: MessageSquare, color: "text-green-400" },
        { id: "jan_aushadhi", label: "Jan Aushadhi Price Feed", description: "Fetch real-time Jan Aushadhi generic drug prices for cost comparison", enabled: true, icon: Link2, color: "text-emerald-400" },
    ]);

    const [notifications, setNotifications] = useState({
        safety_alerts: true,
        consent_reminders: true,
        billing_summary: false,
        system_health: true,
        weekly_report: true,
    });

    const toggleItem = (list: ToggleItem[], setList: React.Dispatch<React.SetStateAction<ToggleItem[]>>, id: string) => {
        setList((prev) => prev.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">Settings</h1>
                    <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                        System configuration, compliance, and integrations
                    </p>
                </div>
                <Button size="sm" className="gap-1.5" onClick={handleSave}>
                    {saved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : <><Save className="w-3.5 h-3.5" /> Save All</>}
                </Button>
            </div>

            {/* Hospital Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        Hospital Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <SettingsInput label="Hospital Name" value={hospital.name} onChange={(v) => setHospital({ ...hospital, name: v })} />
                        <SettingsInput label="License Number" value={hospital.license} onChange={(v) => setHospital({ ...hospital, license: v })} />
                        <SettingsInput label="Phone" value={hospital.phone} onChange={(v) => setHospital({ ...hospital, phone: v })} />
                        <div>
                            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Timezone</label>
                            <select value={hospital.timezone} onChange={(e) => setHospital({ ...hospital, timezone: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">America/New_York (EST)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Address</label>
                        <input value={hospital.address} onChange={(e) => setHospital({ ...hospital, address: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
                    </div>
                </CardContent>
            </Card>

            {/* AI Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Brain className="w-4 h-4 text-purple-400" />
                        AI & Speech Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">LLM Model (Groq)</label>
                            <select value={aiConfig.groq_model} onChange={(e) => setAiConfig({ ...aiConfig, groq_model: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
                                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                                <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">STT Model (Deepgram)</label>
                            <select value={aiConfig.deepgram_model} onChange={(e) => setAiConfig({ ...aiConfig, deepgram_model: e.target.value })} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50">
                                <option value="nova-2-medical">Nova 2 Medical</option>
                                <option value="nova-2-general">Nova 2 General</option>
                                <option value="whisper-large">Whisper Large</option>
                            </select>
                        </div>
                        <SettingsInput label="Temperature" value={aiConfig.temperature} onChange={(v) => setAiConfig({ ...aiConfig, temperature: v })} />
                        <SettingsInput label="Max Tokens" value={aiConfig.max_tokens} onChange={(v) => setAiConfig({ ...aiConfig, max_tokens: v })} />
                    </div>
                </CardContent>
            </Card>

            {/* Compliance */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-green-400" />
                        Compliance & Security
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {compliance.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-colors">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color.replace("text-", "bg-").replace("-400", "-500/10")}`}>
                                    <Icon className={`w-4 h-4 ${item.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-[var(--foreground)]">{item.label}</p>
                                    <p className="text-[10px] text-[var(--foreground-subtle)]">{item.description}</p>
                                </div>
                                <ToggleSwitch enabled={item.enabled} onToggle={() => toggleItem(compliance, setCompliance, item.id)} />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Integrations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Link2 className="w-4 h-4 text-blue-400" />
                        Integrations
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {integrations.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-colors">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color.replace("text-", "bg-").replace("-400", "-500/10")}`}>
                                    <Icon className={`w-4 h-4 ${item.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium text-[var(--foreground)]">{item.label}</p>
                                        {item.enabled && <Badge variant="success" className="text-[8px]">Connected</Badge>}
                                    </div>
                                    <p className="text-[10px] text-[var(--foreground-subtle)]">{item.description}</p>
                                </div>
                                <ToggleSwitch enabled={item.enabled} onToggle={() => toggleItem(integrations, setIntegrations, item.id)} />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Bell className="w-4 h-4 text-amber-400" />
                        Notification Preferences
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(notifications).map(([key, enabled]) => (
                            <div key={key} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)]">
                                <span className="text-xs text-[var(--foreground-muted)] capitalize">
                                    {key.replace(/_/g, " ")}
                                </span>
                                <ToggleSwitch
                                    enabled={enabled}
                                    onToggle={() => setNotifications((prev) => ({ ...prev, [key]: !enabled }))}
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* System Maintenance */}
            <Card className="border-red-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <HardDrive className="w-4 h-4 text-red-400" />
                        System Maintenance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <RefreshCw className="w-3.5 h-3.5" /> Clear Cache
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <Database className="w-3.5 h-3.5" /> Backup DB
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs text-red-400 hover:text-red-300 border-red-500/30">
                            <Trash2 className="w-3.5 h-3.5" /> Purge Logs
                        </Button>
                    </div>
                    <div className="flex items-start gap-2 mt-3 text-[9px] text-[var(--foreground-subtle)]">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                        Purging logs is irreversible. Audit chain entries are exempt and cannot be deleted.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Helper Components ─────────────────────────────────────────────────────────

function SettingsInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">{label}</label>
            <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50" />
        </div>
    );
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${enabled ? "bg-green-600" : "bg-[var(--surface)]"}`}
        >
            <motion.div
                animate={{ x: enabled ? 20 : 2 }}
                transition={{ duration: 0.15 }}
                className="w-4 h-4 rounded-full bg-white absolute top-0.5"
            />
        </button>
    );
}
