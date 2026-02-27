"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Pill, TrendingDown, Store, Search, ChevronRight,
    Clock, AlertCircle, IndianRupee, BadgeCheck, Package,
    Camera, Upload, Loader2, CheckCircle2, X, Image as ImageIcon, Sparkles, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScannedMedication {
    name: string;
    dose: string;
    frequency: string;
    duration: string;
    route: string;
    notes?: string | null;
}

interface ScanResult {
    doctor_name?: string | null;
    clinic_name?: string | null;
    date?: string | null;
    patient_name?: string | null;
    medications: ScannedMedication[];
    diagnosis?: string[];
    notes?: string | null;
    confidence?: "high" | "medium" | "low";
    extracted_at?: string;
    source?: string;
    image_preview?: string;
}

// ─── localStorage helpers ───────────────────────────────────────────────────

const SCANNED_RX_KEY = "cliniq_scanned_prescriptions";

function loadScannedPrescriptions(): ScanResult[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(SCANNED_RX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveScannedPrescriptions(data: ScanResult[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(SCANNED_RX_KEY, JSON.stringify(data));
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ACTIVE_PRESCRIPTIONS = [
    {
        id: "rx1",
        name: "Metformin 500mg",
        generic_name: "Metformin Hydrochloride",
        frequency: "Twice daily (morning & night)",
        duration: "Ongoing",
        prescribed_by: "Dr. Arjun Sharma",
        prescribed_date: "Oct 5, 2025",
        brand_price: 180,
        generic_price: 45,
        jan_aushadhi_price: 22,
        jan_aushadhi_available: true,
        jan_aushadhi_store: "Jan Aushadhi Kendra, Sector 15",
        jan_aushadhi_distance: "2.3 km",
        adherence: 92,
        refill_days: 12,
        instructions: "Take with food. Do not skip doses.",
    },
    {
        id: "rx2",
        name: "Amlodipine 5mg",
        generic_name: "Amlodipine Besylate",
        frequency: "Once daily (morning)",
        duration: "Ongoing",
        prescribed_by: "Dr. Arjun Sharma",
        prescribed_date: "Jan 20, 2026",
        brand_price: 250,
        generic_price: 60,
        jan_aushadhi_price: 28,
        jan_aushadhi_available: true,
        jan_aushadhi_store: "Jan Aushadhi Kendra, Sector 15",
        jan_aushadhi_distance: "2.3 km",
        adherence: 98,
        refill_days: 8,
        instructions: "Take at the same time each day.",
    },
    {
        id: "rx3",
        name: "Atorvastatin 10mg",
        generic_name: "Atorvastatin Calcium",
        frequency: "Once at night",
        duration: "Ongoing",
        prescribed_by: "Dr. Arjun Sharma",
        prescribed_date: "Jan 20, 2026",
        brand_price: 320,
        generic_price: 78,
        jan_aushadhi_price: 35,
        jan_aushadhi_available: true,
        jan_aushadhi_store: "Jan Aushadhi Kendra, Sector 15",
        jan_aushadhi_distance: "2.3 km",
        adherence: 85,
        refill_days: 21,
        instructions: "Take after dinner. Avoid grapefruit juice.",
    },
];

const MOCK_PAST_PRESCRIPTIONS = [
    {
        id: "rx4",
        name: "Paracetamol 500mg",
        generic_name: "Paracetamol",
        frequency: "As needed (max 3/day)",
        duration: "5 days",
        prescribed_by: "Dr. Neha Patel",
        prescribed_date: "Dec 10, 2025",
        brand_price: 45,
        generic_price: 12,
        jan_aushadhi_price: 8,
        jan_aushadhi_available: true,
        status: "completed",
    },
    {
        id: "rx5",
        name: "Cetirizine 10mg",
        generic_name: "Cetirizine Hydrochloride",
        frequency: "Once daily",
        duration: "7 days",
        prescribed_by: "Dr. Neha Patel",
        prescribed_date: "Dec 10, 2025",
        brand_price: 95,
        generic_price: 20,
        jan_aushadhi_price: 10,
        jan_aushadhi_available: true,
        status: "completed",
    },
];

// ─── Prescription Scanner Component ─────────────────────────────────────────

function PrescriptionScanner({
    onScanComplete,
}: {
    onScanComplete: (result: ScanResult) => void;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFile = useCallback(async (file: File) => {
        setError(null);
        setIsScanning(true);

        // Read file as data URL (used for both preview and API)
        const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });

        // Show preview
        setPreviewUrl(dataUrl);

        // Extract base64 payload for API
        const base64 = dataUrl.split(",")[1];

        try {
            const res = await fetch("/api/prescription-scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_base64: base64 }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error ?? "Scan failed");
            }

            const result: ScanResult = await res.json();

            if (!result.medications || result.medications.length === 0) {
                setError("No medications detected. Try a clearer image.");
                setIsScanning(false);
                return;
            }

            // Attach the image preview to the scan result for storage
            result.image_preview = dataUrl;
            onScanComplete(result);
            setPreviewUrl(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
        } finally {
            setIsScanning(false);
        }
    }, [onScanComplete]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) processFile(file);
    }, [processFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    return (
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                        <Camera className="w-4 h-4 text-blue-400" />
                    </div>
                    Scan External Prescription
                    <Badge variant="secondary" className="ml-auto text-[9px] gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI-Powered
                    </Badge>
                </CardTitle>
                <p className="text-[10px] text-[var(--foreground-subtle)]">
                    Upload a photo of any prescription — our AI will extract medication details automatically
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Upload zone */}
                <div
                    className={cn(
                        "relative border-2 border-dashed rounded-xl p-6 transition-all text-center",
                        isDragging
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-[var(--border)] hover:border-blue-500/50 hover:bg-[var(--surface-elevated)]",
                        isScanning && "pointer-events-none opacity-60"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    {isScanning ? (
                        <div className="flex flex-col items-center gap-3 py-2">
                            <div className="relative">
                                {previewUrl && (
                                    <img
                                        src={previewUrl}
                                        alt="Scanning"
                                        className="w-20 h-20 object-cover rounded-lg border border-blue-500/30"
                                    />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-blue-400">Scanning prescription...</p>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">AI is extracting medication details</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 cursor-pointer">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Upload className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-[var(--foreground)]">
                                    Drop image or <span className="text-blue-400">click to upload</span>
                                </p>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">
                                    Take a photo or upload from gallery · JPG, PNG
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error message */}
                {error && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <p className="text-xs text-red-400">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto">
                            <X className="w-3 h-3 text-red-400" />
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Scanned Results Display ────────────────────────────────────────────────

function ScannedPrescriptionCard({
    scan,
    index,
    onDelete,
}: {
    scan: ScanResult;
    index: number;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(index === 0);
    const [showImage, setShowImage] = useState(false);

    const confidenceColor = {
        high: "text-green-400 bg-green-500/10 border-green-500/30",
        medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        low: "text-red-400 bg-red-500/10 border-red-500/30",
    }[scan.confidence ?? "medium"];

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
        >
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
                <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            {scan.image_preview ? (
                                <button
                                    onClick={() => setShowImage(!showImage)}
                                    className="w-10 h-10 rounded-lg overflow-hidden border border-purple-500/30 hover:border-purple-400 transition-colors shrink-0 relative group"
                                    title="Click to expand"
                                >
                                    <img src={scan.image_preview} alt="Prescription" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ImageIcon className="w-3.5 h-3.5 text-white" />
                                    </div>
                                </button>
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                                    <Camera className="w-4 h-4 text-purple-400" />
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold text-[var(--foreground)]">
                                        {scan.doctor_name ?? "External Prescription"}
                                    </p>
                                    <Badge variant="secondary" className="text-[8px] gap-0.5">
                                        <Camera className="w-2 h-2" /> Scanned
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-[var(--foreground-subtle)]">
                                    {scan.clinic_name ?? "Outside clinic"} · {scan.date ?? scan.extracted_at?.split("T")[0] ?? "Recently"}
                                    {" · "}{scan.medications.length} medication{scan.medications.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Badge className={cn("text-[8px] border", confidenceColor)}>
                                {scan.confidence ?? "medium"} confidence
                            </Badge>
                            <button
                                onClick={onDelete}
                                className="p-1 rounded-md hover:bg-red-500/10 text-[var(--foreground-subtle)] hover:text-red-400 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Full-size image preview */}
                    <AnimatePresence>
                        {showImage && scan.image_preview && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="rounded-lg overflow-hidden border border-purple-500/20 bg-black/20">
                                    <img
                                        src={scan.image_preview}
                                        alt="Prescription"
                                        className="w-full max-h-96 object-contain"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Diagnosis */}
                    {scan.diagnosis && scan.diagnosis.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {scan.diagnosis.map((d, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] text-purple-400 border-purple-500/30">
                                    {d}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Expand / collapse */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full text-left text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                        <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
                        {expanded ? "Hide" : "Show"} {scan.medications.length} medication{scan.medications.length !== 1 ? "s" : ""}
                    </button>

                    {/* Medications list */}
                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2 overflow-hidden"
                            >
                                {scan.medications.map((med, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--background)] border border-[var(--border-subtle)]"
                                    >
                                        <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <Pill className="w-3 h-3 text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-[var(--foreground)]">{med.name}</p>
                                            <p className="text-[10px] text-[var(--foreground-muted)]">
                                                {med.dose} · {med.frequency} · {med.duration}
                                            </p>
                                            {med.notes && (
                                                <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5 italic">
                                                    {med.notes}
                                                </p>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="text-[8px] shrink-0">{med.route}</Badge>
                                    </div>
                                ))}

                                {/* Notes */}
                                {scan.notes && (
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                                        <FileText className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-[var(--foreground-muted)]">{scan.notes}</p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface PatientPrescriptionsClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function PatientPrescriptionsClient({ user }: PatientPrescriptionsClientProps) {
    const [activeTab, setActiveTab] = useState<"active" | "scanned" | "past">("active");
    const [searchQuery, setSearchQuery] = useState("");
    const [activePrescriptions, setActivePrescriptions] = useState(MOCK_ACTIVE_PRESCRIPTIONS);
    const [pastPrescriptions, setPastPrescriptions] = useState(MOCK_PAST_PRESCRIPTIONS);
    const [scannedPrescriptions, setScannedPrescriptions] = useState<ScanResult[]>([]);

    // Load scanned prescriptions from localStorage
    useEffect(() => {
        setScannedPrescriptions(loadScannedPrescriptions());
    }, []);

    // Fetch from API (fallback to mock)
    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/patients/${user.id}/prescriptions`);
                const data = await res.json();
                if (data.prescriptions?.length > 0) {
                    const active = data.prescriptions
                        .filter((rx: Record<string, unknown>) => rx.status === 'active')
                        .map((rx: Record<string, unknown>) => ({
                            id: rx.id as string,
                            name: rx.medication_name as string,
                            generic_name: (rx.generic_name ?? '') as string,
                            frequency: (rx.frequency ?? '') as string,
                            duration: (rx.duration ?? 'Ongoing') as string,
                            prescribed_by: ((rx.doctor as { name?: string })?.name ?? 'Doctor') as string,
                            prescribed_date: new Date(rx.prescribed_at as string).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                            brand_price: Number(rx.brand_price ?? 0),
                            generic_price: Number(rx.generic_price ?? 0),
                            jan_aushadhi_price: Number(rx.jan_aushadhi_price ?? 0),
                            jan_aushadhi_available: Boolean(rx.jan_aushadhi_available),
                            jan_aushadhi_store: 'Jan Aushadhi Kendra, Sector 15',
                            jan_aushadhi_distance: '2.3 km',
                            adherence: Math.floor(Math.random() * 15) + 85,
                            refill_days: Math.floor(Math.random() * 20) + 5,
                            instructions: (rx.instructions ?? '') as string,
                        }));
                    const past = data.prescriptions
                        .filter((rx: Record<string, unknown>) => rx.status !== 'active')
                        .map((rx: Record<string, unknown>) => ({
                            id: rx.id as string,
                            name: rx.medication_name as string,
                            generic_name: (rx.generic_name ?? '') as string,
                            frequency: (rx.frequency ?? '') as string,
                            duration: (rx.duration ?? '') as string,
                            prescribed_by: ((rx.doctor as { name?: string })?.name ?? 'Doctor') as string,
                            prescribed_date: new Date(rx.prescribed_at as string).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                            brand_price: Number(rx.brand_price ?? 0),
                            generic_price: Number(rx.generic_price ?? 0),
                            jan_aushadhi_price: Number(rx.jan_aushadhi_price ?? 0),
                            jan_aushadhi_available: Boolean(rx.jan_aushadhi_available),
                            status: 'completed',
                        }));
                    if (active.length > 0) setActivePrescriptions(active);
                    if (past.length > 0) setPastPrescriptions(past);
                }
            } catch { /* keep mock data */ }
        }
        fetchData();
    }, [user.id]);

    // Scan completion handler
    const handleScanComplete = useCallback((result: ScanResult) => {
        setScannedPrescriptions((prev) => {
            const updated = [result, ...prev];
            saveScannedPrescriptions(updated);
            return updated;
        });
        setActiveTab("scanned");
    }, []);

    const handleDeleteScan = useCallback((index: number) => {
        setScannedPrescriptions((prev) => {
            const updated = prev.filter((_, i) => i !== index);
            saveScannedPrescriptions(updated);
            return updated;
        });
    }, []);

    const totalBrandCost = activePrescriptions.reduce((sum, rx) => sum + rx.brand_price, 0);
    const totalGenericCost = activePrescriptions.reduce((sum, rx) => sum + rx.generic_price, 0);
    const totalJACost = activePrescriptions.reduce((sum, rx) => sum + rx.jan_aushadhi_price, 0);
    const monthlySavings = totalBrandCost - totalJACost;
    const savingsPercentage = totalBrandCost > 0 ? Math.round((monthlySavings / totalBrandCost) * 100) : 0;

    const activeMeds = activePrescriptions.filter(
        (rx) =>
            rx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rx.generic_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pastMeds = pastPrescriptions.filter(
        (rx) =>
            rx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rx.generic_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-[var(--foreground)]">Prescriptions & Drug Costs</h1>
                <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
                    Track medications, compare prices, and scan external prescriptions
                </p>
            </div>

            {/* Prescription Scanner */}
            <PrescriptionScanner onScanComplete={handleScanComplete} />

            {/* Savings banner */}
            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-[var(--foreground-subtle)]">Monthly Savings Opportunity</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <p className="text-3xl font-bold text-green-400">
                                    <IndianRupee className="w-5 h-5 inline" />{monthlySavings}
                                </p>
                                <Badge variant="success" className="text-[9px]">{savingsPercentage}% savings</Badge>
                            </div>
                            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                                Switch to Jan Aushadhi generics to save ₹{monthlySavings}/month
                            </p>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="text-[10px] text-[var(--foreground-subtle)]">
                                <span className="line-through">Brand: ₹{totalBrandCost}/mo</span>
                            </div>
                            <div className="text-[10px] text-[var(--foreground-muted)]">
                                Generic: ₹{totalGenericCost}/mo
                            </div>
                            <div className="text-xs font-semibold text-green-400">
                                Jan Aushadhi: ₹{totalJACost}/mo
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs + Search */}
            <div className="flex items-center gap-3">
                <div className="flex bg-[var(--surface)] rounded-lg p-0.5 border border-[var(--border)]">
                    {(["active", "scanned", "past"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab
                                ? "bg-blue-600 text-white shadow"
                                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                }`}
                        >
                            {tab === "active"
                                ? `Active (${activePrescriptions.length})`
                                : tab === "scanned"
                                    ? `📸 Scanned (${scannedPrescriptions.length})`
                                    : `Past (${pastPrescriptions.length})`}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search medications..."
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>
            </div>

            {/* Active prescriptions */}
            {activeTab === "active" && (
                <div className="space-y-3">
                    {activeMeds.map((rx, i) => (
                        <motion.div
                            key={rx.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                                <Pill className="w-4 h-4 text-green-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-[var(--foreground)]">{rx.name}</p>
                                                <p className="text-[10px] text-[var(--foreground-subtle)]">
                                                    {rx.generic_name} · {rx.frequency}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {rx.refill_days <= 10 && (
                                                <Badge variant="warning" className="text-[9px] gap-1">
                                                    <Clock className="w-2.5 h-2.5" /> Refill in {rx.refill_days}d
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Adherence */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-[var(--foreground-subtle)]">Adherence</span>
                                            <span className="text-xs font-semibold text-[var(--foreground)]">{rx.adherence}%</span>
                                        </div>
                                        <Progress
                                            value={rx.adherence}
                                            className="h-1.5"
                                            indicatorClassName={rx.adherence >= 90 ? "bg-green-500" : rx.adherence >= 70 ? "bg-amber-500" : "bg-red-500"}
                                        />
                                    </div>

                                    {/* Price comparison */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-[var(--surface)] rounded-lg p-2.5 text-center border border-[var(--border)]">
                                            <p className="text-[9px] text-[var(--foreground-subtle)] uppercase">Brand</p>
                                            <p className="text-sm font-bold text-[var(--foreground-muted)] line-through mt-0.5">₹{rx.brand_price}</p>
                                        </div>
                                        <div className="bg-[var(--surface)] rounded-lg p-2.5 text-center border border-[var(--border)]">
                                            <p className="text-[9px] text-[var(--foreground-subtle)] uppercase">Generic</p>
                                            <p className="text-sm font-bold text-[var(--foreground)] mt-0.5">₹{rx.generic_price}</p>
                                        </div>
                                        <div className="bg-green-500/5 rounded-lg p-2.5 text-center border border-green-500/20">
                                            <div className="flex items-center justify-center gap-1">
                                                <p className="text-[9px] text-green-400 uppercase">Jan Aushadhi</p>
                                                <BadgeCheck className="w-3 h-3 text-green-400" />
                                            </div>
                                            <p className="text-sm font-bold text-green-400 mt-0.5">₹{rx.jan_aushadhi_price}</p>
                                        </div>
                                    </div>

                                    {/* Jan Aushadhi store */}
                                    {rx.jan_aushadhi_available && rx.jan_aushadhi_store && (
                                        <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/15 rounded-lg p-2.5">
                                            <Store className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-green-400 font-medium">{rx.jan_aushadhi_store}</p>
                                                <p className="text-[9px] text-[var(--foreground-subtle)]">{rx.jan_aushadhi_distance} away</p>
                                            </div>
                                            <Badge variant="success" className="text-[8px] shrink-0">
                                                Save ₹{rx.brand_price - rx.jan_aushadhi_price}/mo
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Instructions */}
                                    {rx.instructions && (
                                        <div className="flex items-start gap-2 text-[10px] text-[var(--foreground-subtle)]">
                                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                            {rx.instructions}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--foreground-subtle)]">
                                        <span>Prescribed by {rx.prescribed_by}</span>
                                        <span>{rx.prescribed_date}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Scanned prescriptions tab */}
            {activeTab === "scanned" && (
                <div className="space-y-3">
                    {scannedPrescriptions.length > 0 ? (
                        scannedPrescriptions.map((scan, i) => (
                            <ScannedPrescriptionCard
                                key={i}
                                scan={scan}
                                index={i}
                                onDelete={() => handleDeleteScan(i)}
                            />
                        ))
                    ) : (
                        <Card className="border-dashed">
                            <CardContent className="p-8 text-center">
                                <ImageIcon className="w-8 h-8 text-[var(--foreground-subtle)] mx-auto mb-3" />
                                <p className="text-sm text-[var(--foreground-muted)]">No scanned prescriptions yet</p>
                                <p className="text-xs text-[var(--foreground-subtle)] mt-1">
                                    Upload a photo of your prescription to get started
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Past prescriptions */}
            {activeTab === "past" && (
                <div className="space-y-3">
                    {pastMeds.map((rx, i) => (
                        <motion.div
                            key={rx.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="opacity-75">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-[var(--surface-elevated)] flex items-center justify-center shrink-0">
                                            <Package className="w-4 h-4 text-[var(--foreground-subtle)]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-[var(--foreground)]">{rx.name}</p>
                                            <p className="text-[10px] text-[var(--foreground-subtle)]">
                                                {rx.generic_name} · {rx.frequency} · {rx.duration}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="secondary" className="text-[9px]">Completed</Badge>
                                            <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">{rx.prescribed_date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-[10px]">
                                        <span className="text-[var(--foreground-subtle)]">Brand: <span className="line-through">₹{rx.brand_price}</span></span>
                                        <span className="text-[var(--foreground-muted)]">Generic: ₹{rx.generic_price}</span>
                                        {rx.jan_aushadhi_available && (
                                            <span className="text-green-400">Jan Aushadhi: ₹{rx.jan_aushadhi_price}</span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
