"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, CloudUpload, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RuralModeIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  onSyncNow: () => void;
  /** Compact pill vs expanded banner. Default: pill */
  variant?: "pill" | "banner";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RuralModeIndicator({
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncAt,
  onSyncNow,
  variant = "pill",
}: RuralModeIndicatorProps) {
  if (variant === "pill") {
    return (
      <div className="flex items-center gap-1.5">
        <AnimatePresence mode="wait">
          {!isOnline ? (
            <motion.div
              key="offline"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30"
            >
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-medium text-amber-300">Rural Mode</span>
              {pendingCount > 0 && (
                <span className="text-[9px] bg-amber-500/25 text-amber-400 px-1 rounded font-bold">
                  {pendingCount} queued
                </span>
              )}
            </motion.div>
          ) : isSyncing ? (
            <motion.div
              key="syncing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30"
            >
              <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
              <span className="text-[10px] font-medium text-blue-300">Syncing…</span>
            </motion.div>
          ) : pendingCount > 0 ? (
            <motion.button
              key="pending"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={onSyncNow}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/25 transition-colors"
            >
              <CloudUpload className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] font-medium text-purple-300">
                Sync {pendingCount} offline record{pendingCount > 1 ? "s" : ""}
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="online"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20"
            >
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400/80">Connected</span>
              {lastSyncAt && (
                <span className="text-[9px] text-[var(--foreground-subtle)]">
                  synced {formatSyncTime(lastSyncAt)}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Banner variant ────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {(!isOnline || pendingCount > 0) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 border-b",
            !isOnline
              ? "bg-amber-500/10 border-amber-500/25"
              : "bg-purple-500/10 border-purple-500/20"
          )}
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-300">Rural Mode — Working Offline</p>
                <p className="text-[10px] text-amber-400/70">
                  Transcript auto-saved locally.
                  {pendingCount > 0 ? ` ${pendingCount} record${pendingCount > 1 ? "s" : ""} will sync when connected.` : " Sync will happen automatically when connected."}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25">
                <span className="text-[9px] font-bold text-amber-400">{pendingCount} QUEUED</span>
              </div>
            </>
          ) : (
            <>
              <CloudUpload className={cn("w-4 h-4 text-purple-400 shrink-0", isSyncing && "animate-pulse")} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-purple-300">
                  {isSyncing ? "Syncing offline records…" : "Offline records ready to sync"}
                </p>
                <p className="text-[10px] text-purple-400/70">
                  {pendingCount} consultation{pendingCount > 1 ? "s" : ""} saved during offline session
                </p>
              </div>
              {!isSyncing && (
                <button
                  onClick={onSyncNow}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-[10px] text-purple-300 font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sync Now
                </button>
              )}
              {isSyncing && (
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <RefreshCw className="w-3 h-3 text-purple-400 animate-spin" />
                  <span className="text-[10px] text-purple-400">Syncing…</span>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
