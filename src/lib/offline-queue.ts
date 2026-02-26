/**
 * NexusMD Offline Queue — Rural Mode
 *
 * When the browser is offline, consultation transcripts are stored in
 * localStorage. When connectivity returns, queued items are synced to
 * Supabase via the /api/extract endpoint.
 *
 * Storage key: nexusmd_offline_queue
 * Each entry is self-contained so it can be synced independently.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineQueueEntry {
  id: string;
  consultationId: string;
  patientName: string;
  transcript: string;
  durationMs: number;
  savedAt: string;      // ISO timestamp when saved offline
  syncedAt?: string;    // ISO timestamp when successfully synced
  synced: boolean;
  syncError?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  synced: number;
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const QUEUE_KEY = "nexusmd_offline_queue";
const MAX_QUEUE_SIZE = 50; // prevent unbounded localStorage growth

// ─── Core helpers ─────────────────────────────────────────────────────────────

function readQueue(): OfflineQueueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueueEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: OfflineQueueEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage quota exceeded — drop oldest synced entries and retry
    const trimmed = entries.filter((e) => !e.synced).slice(-MAX_QUEUE_SIZE);
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
    } catch {
      // silently fail — rural mode best-effort
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Push a new transcript to the offline queue.
 * Returns the entry ID.
 */
export function enqueueOfflineEntry(params: {
  consultationId: string;
  patientName: string;
  transcript: string;
  durationMs: number;
}): string {
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: OfflineQueueEntry = {
    id,
    consultationId: params.consultationId,
    patientName: params.patientName,
    transcript: params.transcript,
    durationMs: params.durationMs,
    savedAt: new Date().toISOString(),
    synced: false,
  };

  const queue = readQueue();
  // Deduplicate by consultationId — update if exists
  const existingIdx = queue.findIndex((e) => e.consultationId === params.consultationId);
  if (existingIdx >= 0) {
    queue[existingIdx] = { ...queue[existingIdx], ...entry, id: queue[existingIdx].id };
  } else {
    queue.unshift(entry);
  }

  writeQueue(queue.slice(0, MAX_QUEUE_SIZE));
  return id;
}

/** Get all queue entries (pending + synced) */
export function getOfflineQueue(): OfflineQueueEntry[] {
  return readQueue();
}

/** Get only unsynced entries that need uploading */
export function getPendingEntries(): OfflineQueueEntry[] {
  return readQueue().filter((e) => !e.synced);
}

/** Mark an entry as successfully synced */
export function markSynced(id: string): void {
  const queue = readQueue().map((e) =>
    e.id === id ? { ...e, synced: true, syncedAt: new Date().toISOString(), syncError: undefined } : e
  );
  writeQueue(queue);
}

/** Mark an entry with a sync error (stays in queue for retry) */
export function markSyncError(id: string, error: string): void {
  const queue = readQueue().map((e) =>
    e.id === id ? { ...e, syncError: error } : e
  );
  writeQueue(queue);
}

/** Remove all synced entries (cleanup) */
export function clearSyncedEntries(): void {
  writeQueue(readQueue().filter((e) => !e.synced));
}

/** Returns queue statistics */
export function getQueueStats(): QueueStats {
  const queue = readQueue();
  return {
    total: queue.length,
    pending: queue.filter((e) => !e.synced).length,
    synced: queue.filter((e) => e.synced).length,
  };
}

// ─── Sync a single entry via /api/extract ────────────────────────────────────

export async function syncEntry(entry: OfflineQueueEntry): Promise<boolean> {
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: entry.transcript,
        consultationId: entry.consultationId,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    markSynced(entry.id);
    return true;
  } catch (err) {
    markSyncError(entry.id, err instanceof Error ? err.message : "Unknown error");
    return false;
  }
}

/** Sync all pending entries sequentially. Returns count of successfully synced. */
export async function syncAllPending(onProgress?: (done: number, total: number) => void): Promise<number> {
  const pending = getPendingEntries();
  let successCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const ok = await syncEntry(pending[i]);
    if (ok) successCount++;
    onProgress?.(i + 1, pending.length);
  }

  return successCount;
}
