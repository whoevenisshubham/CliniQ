"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, Send, Bot, User, Loader2,
    Sparkles, AlertCircle, Heart, Pill, FileText, HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
    { icon: Pill, text: "What are the side effects of Metformin?", color: "text-green-400 bg-green-500/10" },
    { icon: Heart, text: "Explain my latest blood pressure readings", color: "text-red-400 bg-red-500/10" },
    { icon: FileText, text: "Summarize my last consultation", color: "text-blue-400 bg-blue-500/10" },
    { icon: HelpCircle, text: "When is my next follow-up due?", color: "text-amber-400 bg-amber-500/10" },
];

const PATIENT_CONTEXT = {
    name: "Priya Sharma",
    age: 45,
    conditions: ["Type 2 Diabetes", "Hypertension"],
    medications: [
        { name: "Metformin 500mg", frequency: "Twice daily" },
        { name: "Amlodipine 5mg", frequency: "Once daily" },
        { name: "Atorvastatin 10mg", frequency: "Once at night" },
    ],
    recent_vitals: { bp: "138/88", blood_sugar_fasting: 142, hba1c: 7.2, weight: "68 kg" },
    recent_diagnosis: "Type 2 Diabetes - Follow-up, Hypertension Management",
    allergies: ["Sulfonamides"],
    last_visit: "Feb 15, 2026",
    doctor: "Dr. Arjun Sharma",
};

interface PatientChatClientProps {
    user: { id: string; name: string; email: string; role: string };
}

export function PatientChatClient({ user }: PatientChatClientProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `Hello ${user.name.split(" ")[0]}! 👋 I'm your NexusMD Health Assistant. I can help you understand your diagnoses, medications, lab reports, and treatment plans.\n\nI have access to your medical records to give you personalized answers. What would you like to know?\n\n⚕️ This is AI-generated guidance based on your records. Always consult your doctor for medical decisions.`,
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: text.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const apiMessages = [...messages, userMsg]
                .filter((m) => m.id !== "welcome")
                .map((m) => ({ role: m.role, content: m.content }));

            const res = await fetch("/api/patient-bot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: apiMessages,
                    patientContext: PATIENT_CONTEXT,
                }),
            });

            const data = await res.json();

            const assistantMsg: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.reply || "I'm sorry, I couldn't process that. Please try again.",
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "⚠️ I'm having trouble connecting right now. Please try again in a moment.",
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <MessageSquare className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-[var(--foreground)]">Ask Your Doctor</h1>
                        <p className="text-xs text-[var(--foreground-muted)]">
                            AI-powered assistant with access to your medical records
                        </p>
                    </div>
                    <Badge variant="secondary" className="ml-auto text-[9px] gap-1">
                        <Sparkles className="w-3 h-3" /> EMR-Aware
                    </Badge>
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-hidden px-6">
                <Card className="h-full flex flex-col">
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-4">
                            <AnimatePresence initial={false}>
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        {msg.role === "assistant" && (
                                            <div className="flex items-start">
                                                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Bot className="w-3.5 h-3.5 text-blue-400" />
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[80%] rounded-xl px-4 py-3 text-xs leading-relaxed ${msg.role === "user"
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[var(--surface-elevated)] text-[var(--foreground)]"
                                                }`}
                                        >
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
                                            <p className={`text-[9px] mt-2 ${msg.role === "user" ? "text-blue-200" : "text-[var(--foreground-subtle)]"}`}>
                                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        {msg.role === "user" && (
                                            <div className="flex items-start">
                                                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <User className="w-3.5 h-3.5 text-green-400" />
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-3"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Bot className="w-3.5 h-3.5 text-blue-400" />
                                    </div>
                                    <div className="bg-[var(--surface-elevated)] rounded-xl px-4 py-3 flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                        <span className="text-xs text-[var(--foreground-muted)]">Analyzing your records...</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Suggested questions (show when no user messages) */}
                            {messages.length <= 1 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="pt-2"
                                >
                                    <p className="text-[10px] text-[var(--foreground-subtle)] mb-2 uppercase tracking-wider">Suggested Questions</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {SUGGESTED_QUESTIONS.map((q) => {
                                            const Icon = q.icon;
                                            return (
                                                <button
                                                    key={q.text}
                                                    onClick={() => sendMessage(q.text)}
                                                    className="flex items-center gap-2.5 p-3 rounded-lg border border-[var(--border)] hover:border-blue-500/30 hover:bg-[var(--surface-elevated)] transition-all text-left group"
                                                >
                                                    <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${q.color}`}>
                                                        <Icon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-xs text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors">
                                                        {q.text}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-4 border-t border-[var(--border)]">
                        <div className="flex items-center gap-1 mb-2">
                            <AlertCircle className="w-3 h-3 text-[var(--foreground-subtle)]" />
                            <span className="text-[9px] text-[var(--foreground-subtle)]">
                                AI responses are based on your EMR records. Not a substitute for professional medical advice.
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about your medications, diagnosis, or treatment..."
                                rows={1}
                                className="flex-1 resize-none bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-blue-500/50 transition-colors"
                            />
                            <Button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                                size="sm"
                                className="px-3 self-end"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Context indicator */}
            <div className="px-6 py-3">
                <div className="flex items-center gap-4 text-[10px] text-[var(--foreground-subtle)]">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Connected to your EMR
                    </span>
                    <span>Doctor: {PATIENT_CONTEXT.doctor}</span>
                    <span>Last visit: {PATIENT_CONTEXT.last_visit}</span>
                </div>
            </div>
        </div>
    );
}
