"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    User, Mail, Phone, Shield, Heart, Globe, Users,
    Edit3, Save, X, AlertCircle, Fingerprint, MapPin,
    Languages, Bell, Lock, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_PROFILE = {
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    phone: "+91 98765 43210",
    dob: "1981-03-15",
    gender: "Female",
    blood_group: "B+",
    abha_id: "14-5678-9012-3456",
    address: "42, Sector 15, Gurugram, Haryana, 122001",
    allergies: ["Sulfonamides", "Penicillin"],
    chronic_conditions: ["Type 2 Diabetes", "Hypertension"],
    emergency_contact: { name: "Rajesh Sharma", relation: "Spouse", phone: "+91 98765 43211" },
    language_pref: "en" as "en" | "hi" | "hinglish",
};

const MOCK_FAMILY = [
    { name: "Rajesh Sharma", relation: "Spouse", age: 48, conditions: ["Hypertension"] },
    { name: "Aarav Sharma", relation: "Son", age: 18, conditions: [] },
    { name: "Kamla Devi", relation: "Mother", age: 72, conditions: ["Type 2 Diabetes", "Osteoarthritis"] },
];

const MOCK_CONSENTS = [
    { id: "c1", purpose: "Research Data Sharing", description: "Allow anonymized health data to be used for medical research", enabled: true },
    { id: "c2", purpose: "Government Epidemiology", description: "Share aggregated data with public health authorities for disease tracking", enabled: true },
    { id: "c3", purpose: "Insurance Claims", description: "Allow automated sharing of reports with your insurance provider", enabled: false },
    { id: "c4", purpose: "WhatsApp Notifications", description: "Receive appointment reminders and reports via WhatsApp", enabled: true },
];

interface PatientAccountClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function PatientAccountClient({ user }: PatientAccountClientProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState(MOCK_PROFILE);
    const [consents, setConsents] = useState(MOCK_CONSENTS);

    const toggleConsent = (id: string) => {
        setConsents((prev) =>
            prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
        );
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">My Account</h1>
                    <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                        Profile, family health, and privacy settings
                    </p>
                </div>
                <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setIsEditing(!isEditing)}
                >
                    {isEditing ? (
                        <>
                            <Save className="w-3.5 h-3.5" /> Save Changes
                        </>
                    ) : (
                        <>
                            <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                        </>
                    )}
                </Button>
            </div>

            {/* Profile Card */}
            <Card className="border-blue-500/20">
                <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20 shrink-0">
                            <User className="w-7 h-7 text-blue-400" />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Full Name</label>
                                    {isEditing ? (
                                        <input
                                            value={profile.name}
                                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50 mt-0.5"
                                        />
                                    ) : (
                                        <p className="text-xs font-semibold text-[var(--foreground)] mt-0.5">{profile.name}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">ABHA ID</label>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Fingerprint className="w-3 h-3 text-blue-400" />
                                        <p className="text-xs font-mono text-blue-400">{profile.abha_id}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> Email
                                    </label>
                                    <p className="text-xs text-[var(--foreground)] mt-0.5">{profile.email}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> Phone
                                    </label>
                                    {isEditing ? (
                                        <input
                                            value={profile.phone}
                                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50 mt-0.5"
                                        />
                                    ) : (
                                        <p className="text-xs text-[var(--foreground)] mt-0.5">{profile.phone}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Date of Birth</label>
                                    <p className="text-xs text-[var(--foreground)] mt-0.5">{new Date(profile.dob).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Gender</label>
                                    <p className="text-xs text-[var(--foreground)] mt-0.5">{profile.gender}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Blood Group</label>
                                    <p className="text-xs font-bold text-red-400 mt-0.5">{profile.blood_group}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Address
                                </label>
                                <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{profile.address}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Allergies & Conditions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            Allergies & Conditions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-1.5">Known Allergies</p>
                            <div className="flex flex-wrap gap-1.5">
                                {profile.allergies.map((a) => (
                                    <Badge key={a} variant="destructive" className="text-[10px]">{a}</Badge>
                                ))}
                            </div>
                        </div>
                        <Separator />
                        <div>
                            <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-1.5">Chronic Conditions</p>
                            <div className="flex flex-wrap gap-1.5">
                                {profile.chronic_conditions.map((c) => (
                                    <Badge key={c} variant="warning" className="text-[10px]">{c}</Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Emergency Contact */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-green-400" />
                            Emergency Contact
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-elevated)]">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-green-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-[var(--foreground)]">{profile.emergency_contact.name}</p>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">{profile.emergency_contact.relation}</p>
                                <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">{profile.emergency_contact.phone}</p>
                            </div>
                        </div>

                        <Separator className="my-3" />

                        <div>
                            <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Languages className="w-3 h-3" /> Language Preference
                            </p>
                            <div className="flex gap-2">
                                {(["en", "hi", "hinglish"] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => setProfile({ ...profile, language_pref: lang })}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${profile.language_pref === lang
                                                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                                                : "border-[var(--border)] text-[var(--foreground-muted)]"
                                            }`}
                                    >
                                        {lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : "Hinglish"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Family Health Graph */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-400" />
                            Family Health Graph
                            <Badge variant="secondary" className="ml-auto text-[9px]">{MOCK_FAMILY.length} linked</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {MOCK_FAMILY.map((member, i) => (
                            <motion.div
                                key={member.name}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--surface-elevated)]"
                            >
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                    <Heart className="w-3.5 h-3.5 text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium text-[var(--foreground)]">{member.name}</p>
                                        <Badge variant="secondary" className="text-[8px]">{member.relation}</Badge>
                                    </div>
                                    <p className="text-[10px] text-[var(--foreground-subtle)]">
                                        Age {member.age} · {member.conditions.length > 0 ? member.conditions.join(", ") : "No known conditions"}
                                    </p>
                                </div>
                                {member.conditions.length > 0 && (
                                    <div className="flex gap-1">
                                        {member.conditions.some((c) => profile.chronic_conditions.includes(c)) && (
                                            <Badge variant="warning" className="text-[8px]">Shared Risk</Badge>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                        <p className="text-[9px] text-[var(--foreground-subtle)] pt-1">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Family history helps identify hereditary risk factors. Shared conditions are highlighted.
                        </p>
                    </CardContent>
                </Card>

                {/* Data Consent */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-amber-400" />
                            Data & Privacy
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {consents.map((consent) => (
                            <div
                                key={consent.id}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)]"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-[var(--foreground)]">{consent.purpose}</p>
                                    <p className="text-[10px] text-[var(--foreground-subtle)]">{consent.description}</p>
                                </div>
                                <button
                                    onClick={() => toggleConsent(consent.id)}
                                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${consent.enabled ? "bg-green-600" : "bg-[var(--surface)]"
                                        }`}
                                >
                                    <motion.div
                                        animate={{ x: consent.enabled ? 20 : 2 }}
                                        className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                                    />
                                </button>
                            </div>
                        ))}
                        <div className="flex items-start gap-2 pt-2 text-[9px] text-[var(--foreground-subtle)]">
                            <Lock className="w-3 h-3 shrink-0 mt-0.5" />
                            Your data is protected with zero-knowledge proofs. Personal identifying information is never shared directly. HIPAA & ABDM compliant.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
