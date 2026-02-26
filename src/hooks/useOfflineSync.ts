"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  enqueueOfflineEntry,
  getPendingEntries,
  getQueueStats,
  syncAllPending,
  type QueueStats,
} from "@/lib/offline-queue";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseOfflineSyncOptions {
  consultationId: string;
  patientName?: string;
  transcript: string;
  durationMs: number;
  /** Auto-save to queue when going offline. Default: true */
  autoSave?: boolean;
  /** Auto-sync when coming back online. Default: true */
  autoSync?: boolean;
}

interface UseOfflineSyncResult {
  isOnline: boolean;
  isSyncing: boolean;
  stats: QueueStats;
  syncNow: () => Promise<void>;
  saveOffline: () => void;
  lastSyncAt: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineSync({
  consultationId,
  patientName = "Patient",
  transcript,
  durationMs,
  autoSave = true,
  autoSync = true,
}: UseOfflineSyncOptions): UseOfflineSyncResult {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<QueueStats>({ total: 0, pending: 0, synced: 0 });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const wasOfflineRef = useRef(false);
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  // Refresh stats helper
  const refreshStats = useCallback(() => {
    setStats(getQueueStats());
  }, []);

  // Save current transcript to offline queue
  const saveOffline = useCallback(() => {
    if (!transcriptRef.current || transcriptRef.current.length < 20) return;
    enqueueOfflineEntry({
      consultationId,
      patientName,
      transcript: transcriptRef.current,
      durationMs,
    });
    refreshStats();
  }, [consultationId, patientName, durationMs, refreshStats]);

  // Sync all pending entries
  const syncNow = useCallback(async () => {
    const pending = getPendingEntries();
    if (pending.length === 0) return;

    setIsSyncing(true);
    try {
      await syncAllPending((done, total) => {
        // Could be wired to a progress bar in the future
        void done;
        void total;
      });
      setLastSyncAt(new Date().toISOString());
      refreshStats();
    } finally {
      setIsSyncing(false);
    }
  }, [refreshStats]);

  // Listen to online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current && autoSync) {
        // Came back online — trigger sync
        syncNow();
        wasOfflineRef.current = false;
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      if (autoSave) {
        // Going offline — save current state
        saveOffline();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    refreshStats();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [autoSave, autoSync, saveOffline, syncNow, refreshStats]);

  // Periodically save transcript to queue while offline (every 30s)
  useEffect(() => {
    if (isOnline) return;
    const interval = setInterval(() => {
      if (autoSave) saveOffline();
    }, 30_000);
    return () => clearInterval(interval);
  }, [isOnline, autoSave, saveOffline]);

  return { isOnline, isSyncing, stats, syncNow, saveOffline, lastSyncAt };
}
