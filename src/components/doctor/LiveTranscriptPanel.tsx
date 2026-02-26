"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Square, RotateCcw, Clock, Hash, Globe } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptSegment } from "@/lib/types";

// ─── Duration formatter ───────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ─── Language badge ───────────────────────────────────────────────────────────
function LanguageBadge({ lang }: { lang: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    en: { label: "EN", color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
    hi: { label: "HI", color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
    Hinglish: { label: "Hinglish", color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
    "hi-Latn": { label: "Hinglish", color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  };
  const meta = labels[lang] ?? { label: lang.toUpperCase(), color: "text-[var(--foreground-muted)] border-[var(--border)] bg-[var(--surface)]" };

  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold border rounded px-1.5 py-0.5", meta.color)}>
      <Globe className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

// ─── Recording pulse indicator ────────────────────────────────────────────────
function RecordingIndicator({ isRecording, isConnecting }: { isRecording: boolean; isConnecting: boolean }) {
  if (isConnecting) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-3 h-3">
          <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
        </div>
        <span className="text-xs text-amber-400 font-medium">Connecting...</span>
      </div>
    );
  }

  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center w-3 h-3">
        {/* Outer ripple */}
        <span className="absolute w-3 h-3 rounded-full bg-red-500 animate-ripple" />
        {/* Inner dot */}
        <span className="relative w-2 h-2 rounded-full bg-red-500 animate-pulse-record" />
      </div>
      <span className="text-xs text-red-400 font-semibold tracking-wider uppercase">
        Live
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LiveTranscriptPanelProps {
  isRecording: boolean;
  isConnecting: boolean;
  segments: TranscriptSegment[];
  interimText: string;
  detectedLanguage: string;
  wordCount: number;
  durationMs: number;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveTranscriptPanel({
  isRecording,
  isConnecting,
  segments,
  interimText,
  detectedLanguage,
  wordCount,
  durationMs,
  error,
  onStart,
  onStop,
  onReset,
  className,
}: LiveTranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new segments
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments.length, interimText]);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden",
        className
      )}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg",
            isRecording ? "bg-red-500/15" : "bg-[var(--surface-elevated)]"
          )}>
            <Mic className={cn("w-3.5 h-3.5", isRecording ? "text-red-400" : "text-[var(--foreground-muted)]")} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[var(--foreground)]">
              Ambient Scribe
            </h3>
            <p className="text-[10px] text-[var(--foreground-subtle)]">
              Multilingual · Medical-Optimized
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RecordingIndicator isRecording={isRecording} isConnecting={isConnecting} />
          {isRecording && (
            <LanguageBadge lang={detectedLanguage} />
          )}
        </div>
      </div>

      {/* ─── Stats bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[var(--background)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-subtle)]">
          <Clock className="w-3 h-3" />
          <span className={cn("font-mono", isRecording && "text-[var(--foreground-muted)]")}>
            {formatDuration(durationMs)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-subtle)]">
          <Hash className="w-3 h-3" />
          <span className="font-mono">{wordCount} words</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-subtle)]">
          <span>{segments.length} segments</span>
        </div>
      </div>

      {/* ─── Transcript area ────────────────────────────────────── */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-1 min-h-full">
          {/* Empty state */}
          {segments.length === 0 && !interimText && !isConnecting && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--surface-elevated)]">
                <Mic className="w-5 h-5 text-[var(--foreground-subtle)]" />
              </div>
              <p className="text-xs text-[var(--foreground-subtle)] text-center max-w-[200px] leading-relaxed">
                Press <strong className="text-[var(--foreground-muted)]">Start Recording</strong> to begin ambient scribing
              </p>
              <p className="text-[10px] text-[var(--foreground-subtle)]/60 text-center">
                Supports English, Hindi, and Hinglish
              </p>
            </div>
          )}

          {/* Connecting state */}
          {isConnecting && (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-xs text-[var(--foreground-muted)]">
                Connecting to Deepgram...
              </p>
            </div>
          )}

          {/* Transcript segments */}
          <AnimatePresence initial={false}>
            {segments.map((segment) => (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="group relative"
              >
                <p className="text-sm text-[var(--foreground)] leading-relaxed py-0.5">
                  {segment.text}
                </p>
                <span className="absolute right-0 top-1 text-[9px] text-[var(--foreground-subtle)]/0 group-hover:text-[var(--foreground-subtle)]/60 transition-all font-mono">
                  {formatDuration(segment.timestamp)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Interim/live text */}
          {interimText && (
            <motion.p
              key="interim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-[var(--foreground-subtle)] italic py-0.5"
            >
              {interimText}
              <span className="inline-block w-0.5 h-3.5 bg-blue-400 ml-0.5 animate-typing-cursor" />
            </motion.p>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ─── Error state ────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ─── Controls ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] bg-[var(--background-secondary)]">
        {!isRecording && !isConnecting ? (
          <Button
            onClick={onStart}
            size="sm"
            className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse-record" />
            Start Recording
          </Button>
        ) : (
          <Button
            onClick={onStop}
            size="sm"
            variant="outline"
            disabled={isConnecting}
            className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 gap-2"
          >
            <Square className="w-3 h-3" />
            Stop Recording
          </Button>
        )}

        <Button
          onClick={onReset}
          size="icon-sm"
          variant="ghost"
          title="Reset transcript"
          disabled={isRecording || isConnecting}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
