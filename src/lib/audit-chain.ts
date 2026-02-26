/**
 * NexusMD Audit Chain
 * Generates SHA-256 hashes for tamper-evident audit trails.
 * Each entry hashes: (previous_hash + event_type + payload_json + timestamp)
 * forming an append-only blockchain-style log.
 */

import type { AuditEntry, AuditEventType, UserRole } from "./types";

// ─── Genesis hash (fixed anchor for chain start) ─────────────────────────────

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

// ─── SHA-256 via Web Crypto (browser) or Node crypto (server) ────────────────

async function sha256(message: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    // Browser / Edge runtime
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    // Node.js runtime (API routes with Node runtime)
    const { createHash } = await import("crypto");
    return createHash("sha256").update(message).digest("hex");
  }
}

// ─── Core hash function ───────────────────────────────────────────────────────

export async function hashAuditEntry(
  previousHash: string,
  eventType: AuditEventType,
  payload: Record<string, unknown>,
  timestamp: string
): Promise<string> {
  const raw = `${previousHash}|${eventType}|${JSON.stringify(payload)}|${timestamp}`;
  return sha256(raw);
}

// ─── Build a new audit entry ──────────────────────────────────────────────────

export interface BuildAuditEntryInput {
  consultationId: string;
  eventType: AuditEventType;
  actorId: string;
  actorRole: UserRole;
  payload: Record<string, unknown>;
  previousHash: string;
}

export async function buildAuditEntry(input: BuildAuditEntryInput): Promise<AuditEntry> {
  const timestamp = new Date().toISOString();
  const hash = await hashAuditEntry(
    input.previousHash,
    input.eventType,
    input.payload,
    timestamp
  );

  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    consultation_id: input.consultationId,
    event_type: input.eventType,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    payload: input.payload,
    timestamp,
    hash,
    previous_hash: input.previousHash,
  };
}

// ─── Verify chain integrity ───────────────────────────────────────────────────

export async function verifyChain(entries: AuditEntry[]): Promise<boolean> {
  if (entries.length === 0) return true;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? GENESIS_HASH : entries[i - 1].hash;

    if (entry.previous_hash !== expectedPrevHash) return false;

    const recomputed = await hashAuditEntry(
      entry.previous_hash,
      entry.event_type,
      entry.payload,
      entry.timestamp
    );
    if (recomputed !== entry.hash) return false;
  }

  return true;
}

// ─── Format hash for display (truncated) ─────────────────────────────────────

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

// ─── Generate a consultation summary for hashing ────────────────────────────

export function buildConsultationSummaryPayload(params: {
  consultationId: string;
  patientName: string;
  diagnosis: string[];
  medications: Array<{ name: string }>;
  icdCodes: Array<{ code: string; description: string }>;
  durationMs: number;
}): Record<string, unknown> {
  return {
    consultation_id: params.consultationId,
    patient_name: params.patientName,
    diagnosis: params.diagnosis,
    medications: params.medications.map((m) => m.name),
    icd_codes: params.icdCodes.map((c) => c.code),
    duration_seconds: Math.floor(params.durationMs / 1000),
    finalized_at: new Date().toISOString(),
  };
}
