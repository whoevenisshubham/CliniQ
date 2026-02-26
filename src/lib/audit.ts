import { getSupabaseAdminClient } from "./supabase-server";
import type { AuditEventType, UserRole, AuditEntry } from "./types";

// Simple hash chain — simulates blockchain append-only immutability
function chainHash(previousHash: string, timestamp: string, payload: string): string {
  const raw = previousHash + timestamp + payload;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function logAuditEvent({
  consultationId,
  eventType,
  actorId,
  actorRole,
  payload,
}: {
  consultationId: string;
  eventType: AuditEventType;
  actorId: string;
  actorRole: UserRole;
  payload: Record<string, unknown>;
}): Promise<AuditEntry | null> {
  const supabase = getSupabaseAdminClient();

  // Get the last hash in the chain for this consultation
  const { data: lastEntry } = await supabase
    .from("audit_log")
    .select("hash")
    .eq("consultation_id", consultationId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  const previousHash = lastEntry?.hash ?? "0000000000000000";
  const timestamp = new Date().toISOString();
  const hash = chainHash(previousHash, timestamp, JSON.stringify(payload));

  const { data, error } = await supabase
    .from("audit_log")
    .insert({
      consultation_id: consultationId,
      event_type: eventType,
      actor_id: actorId,
      actor_role: actorRole,
      payload,
      timestamp,
      hash,
      previous_hash: previousHash,
    })
    .select()
    .single();

  if (error) {
    console.error("[Audit] Failed to log event:", error);
    return null;
  }

  return data as AuditEntry;
}

export async function verifyAuditChain(consultationId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  const { data: entries } = await supabase
    .from("audit_log")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("timestamp", { ascending: true });

  if (!entries || entries.length === 0) return true;

  let expectedPrevHash = "0000000000000000";
  for (const entry of entries) {
    if (entry.previous_hash !== expectedPrevHash) return false;
    const recomputed = chainHash(
      entry.previous_hash,
      entry.timestamp,
      JSON.stringify(entry.payload)
    );
    if (recomputed !== entry.hash) return false;
    expectedPrevHash = entry.hash;
  }

  return true;
}
