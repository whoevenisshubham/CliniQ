"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar, Clock, Video, MapPin, Stethoscope,
    Plus, X, Check, ChevronRight, AlertCircle, User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_UPCOMING = [
    {
        id: "a1",
        doctor: "Dr. Arjun Sharma",
        department: "Internal Medicine",
        date: "Mar 5, 2026",
        time: "10:00 AM",
        type: "followup" as const,
        mode: "in-person" as const,
        status: "confirmed" as const,
        reason: "Diabetes follow-up — HbA1c recheck",
    },
    {
        id: "a2",
        doctor: "Dr. Neha Patel",
        department: "General Medicine",
        date: "Mar 18, 2026",
        time: "2:30 PM",
        type: "general" as const,
        mode: "teleconsult" as const,
        status: "confirmed" as const,
        reason: "Annual health checkup",
    },
];

const MOCK_PAST_APPOINTMENTS = [
    { id: "a3", doctor: "Dr. Arjun Sharma", date: "Feb 15, 2026", time: "10:00 AM", type: "followup" as const, mode: "in-person" as const, status: "completed" as const, reason: "Diabetes follow-up" },
    { id: "a4", doctor: "Dr. Arjun Sharma", date: "Jan 20, 2026", time: "11:00 AM", type: "followup" as const, mode: "in-person" as const, status: "completed" as const, reason: "Hypertension management" },
    { id: "a5", doctor: "Dr. Neha Patel", date: "Dec 10, 2025", time: "3:00 PM", type: "general" as const, mode: "in-person" as const, status: "completed" as const, reason: "Seasonal flu" },
];

const AVAILABLE_DOCTORS = [
    { id: "d1", name: "Dr. Arjun Sharma", department: "Internal Medicine", available_slots: ["10:00 AM", "11:00 AM", "2:00 PM", "4:00 PM"] },
    { id: "d2", name: "Dr. Neha Patel", department: "General Medicine", available_slots: ["9:00 AM", "11:30 AM", "2:30 PM", "5:00 PM"] },
    { id: "d3", name: "Dr. Rajesh Gupta", department: "Cardiology", available_slots: ["10:30 AM", "1:00 PM", "3:30 PM"] },
    { id: "d4", name: "Dr. Priya Desai", department: "Endocrinology", available_slots: ["9:30 AM", "12:00 PM", "3:00 PM"] },
];

const CONSULTATION_TYPES = [
    { value: "general", label: "General Consultation" },
    { value: "followup", label: "Follow-up Visit" },
    { value: "emergency", label: "Emergency" },
    { value: "teleconsult", label: "Teleconsultation" },
];

interface PatientAppointmentsClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function PatientAppointmentsClient({ user }: PatientAppointmentsClientProps) {
    const [showBooking, setShowBooking] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedSlot, setSelectedSlot] = useState("");
    const [selectedType, setSelectedType] = useState("general");
    const [reason, setReason] = useState("");
    const [bookingSuccess, setBookingSuccess] = useState(false);

    const selectedDoctorData = AVAILABLE_DOCTORS.find((d) => d.id === selectedDoctor);

    const handleBook = () => {
        setBookingSuccess(true);
        setTimeout(() => {
            setShowBooking(false);
            setBookingSuccess(false);
            setSelectedDoctor("");
            setSelectedDate("");
            setSelectedSlot("");
            setSelectedType("general");
            setReason("");
        }, 2000);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed": return "text-green-400 bg-green-500/10";
            case "completed": return "text-blue-400 bg-blue-500/10";
            case "cancelled": return "text-red-400 bg-red-500/10";
            default: return "text-amber-400 bg-amber-500/10";
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">Appointments</h1>
                    <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                        Manage your consultations and book new appointments
                    </p>
                </div>
                <Button size="sm" className="gap-1.5" onClick={() => setShowBooking(true)}>
                    <Plus className="w-3.5 h-3.5" /> Book Appointment
                </Button>
            </div>

            {/* Booking Form (Modal-like overlay) */}
            <AnimatePresence>
                {showBooking && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                    >
                        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                        Book New Appointment
                                    </span>
                                    <button onClick={() => setShowBooking(false)}>
                                        <X className="w-4 h-4 text-[var(--foreground-subtle)] hover:text-[var(--foreground)]" />
                                    </button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {bookingSuccess ? (
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="flex flex-col items-center py-8 gap-3"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                            <Check className="w-6 h-6 text-green-400" />
                                        </div>
                                        <p className="text-sm font-semibold text-green-400">Appointment Booked Successfully!</p>
                                        <p className="text-xs text-[var(--foreground-muted)]">You will receive a confirmation shortly.</p>
                                    </motion.div>
                                ) : (
                                    <>
                                        {/* Doctor selection */}
                                        <div>
                                            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Select Doctor</label>
                                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                                                {AVAILABLE_DOCTORS.map((doc) => (
                                                    <button
                                                        key={doc.id}
                                                        onClick={() => { setSelectedDoctor(doc.id); setSelectedSlot(""); }}
                                                        className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all ${selectedDoctor === doc.id
                                                                ? "border-blue-500/50 bg-blue-500/5"
                                                                : "border-[var(--border)] hover:border-[var(--border)]/80"
                                                            }`}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                            <User className="w-3.5 h-3.5 text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-medium text-[var(--foreground)]">{doc.name}</p>
                                                            <p className="text-[10px] text-[var(--foreground-subtle)]">{doc.department}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Consultation type */}
                                        <div>
                                            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Consultation Type</label>
                                            <div className="flex gap-2 mt-1.5">
                                                {CONSULTATION_TYPES.map((ct) => (
                                                    <button
                                                        key={ct.value}
                                                        onClick={() => setSelectedType(ct.value)}
                                                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${selectedType === ct.value
                                                                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                                                                : "border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                                            }`}
                                                    >
                                                        {ct.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <div>
                                            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Preferred Date</label>
                                            <input
                                                type="date"
                                                value={selectedDate}
                                                onChange={(e) => setSelectedDate(e.target.value)}
                                                min={new Date().toISOString().split("T")[0]}
                                                className="w-full mt-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500/50"
                                            />
                                        </div>

                                        {/* Time slots */}
                                        {selectedDoctorData && (
                                            <div>
                                                <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Available Slots</label>
                                                <div className="flex flex-wrap gap-2 mt-1.5">
                                                    {selectedDoctorData.available_slots.map((slot) => (
                                                        <button
                                                            key={slot}
                                                            onClick={() => setSelectedSlot(slot)}
                                                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${selectedSlot === slot
                                                                    ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                                                                    : "border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                                                }`}
                                                        >
                                                            <Clock className="w-3 h-3 inline mr-1" />
                                                            {slot}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Reason */}
                                        <div>
                                            <label className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Reason for Visit</label>
                                            <textarea
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                placeholder="Briefly describe your concern..."
                                                rows={2}
                                                className="w-full mt-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 resize-none"
                                            />
                                        </div>

                                        <Button
                                            onClick={handleBook}
                                            disabled={!selectedDoctor || !selectedDate || !selectedSlot}
                                            className="w-full gap-1.5"
                                            size="sm"
                                        >
                                            <Check className="w-3.5 h-3.5" /> Confirm Booking
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upcoming appointments */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        Upcoming Appointments
                        <Badge variant="secondary" className="ml-auto text-[9px]">{MOCK_UPCOMING.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {MOCK_UPCOMING.map((appt, i) => (
                        <motion.div
                            key={appt.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-blue-500/20 transition-colors"
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${appt.mode === "teleconsult" ? "bg-purple-500/10" : "bg-blue-500/10"
                                }`}>
                                {appt.mode === "teleconsult" ? (
                                    <Video className="w-4 h-4 text-purple-400" />
                                ) : (
                                    <MapPin className="w-4 h-4 text-blue-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold text-[var(--foreground)]">{appt.doctor}</p>
                                    <Badge variant={appt.mode === "teleconsult" ? "default" : "secondary"} className="text-[8px]">
                                        {appt.mode === "teleconsult" ? "Video" : "In-person"}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">{appt.department}</p>
                                <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">{appt.reason}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs font-medium text-[var(--foreground)]">{appt.date}</p>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">{appt.time}</p>
                                <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium ${getStatusColor(appt.status)}`}>
                                    <Check className="w-2.5 h-2.5" />
                                    {appt.status}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </CardContent>
            </Card>

            {/* Past appointments */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--foreground-subtle)]" />
                        Past Appointments
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {MOCK_PAST_APPOINTMENTS.map((appt, i) => (
                        <motion.div
                            key={appt.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors opacity-75"
                        >
                            <div className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center shrink-0">
                                <Stethoscope className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[var(--foreground)]">{appt.doctor}</p>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">{appt.reason}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-[var(--foreground-muted)]">{appt.date}</p>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">{appt.time}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                        </motion.div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
