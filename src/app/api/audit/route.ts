import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { AuditEntry } from "@/lib/types";

/**
 * POST /api/audit
 * Commits an audit entry (with SHA-256 chain hash) to Supabase audit_logs table.
 * Uses service-role client to bypass RLS — audit logs are write-only from server.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entry }: { entry: AuditEntry } = body;

    if (!entry || !entry.hash || !entry.consultation_id) {
      return NextResponse.json({ error: "Invalid audit entry" }, { status: 400 });
    }

    // Try to persist to Supabase; fall back gracefully if table not yet created
    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from("audit_logs").insert({
        id: entry.id,
        consultation_id: entry.consultation_id,
        event_type: entry.event_type,
        actor_id: entry.actor_id,
        actor_role: entry.actor_role,
        payload: entry.payload,
        timestamp: entry.timestamp,
        hash: entry.hash,
        previous_hash: entry.previous_hash,
      });

      if (error) {
        // Table may not exist in demo Supabase; return success with warning
        console.warn("[Audit] Supabase insert failed (table may not exist):", error.message);
        return NextResponse.json({ ok: true, persisted: false, warning: error.message, entry });
      }

      return NextResponse.json({ ok: true, persisted: true, entry });
    } catch (dbErr) {
      // Network or config error — still return the entry so client can store locally
      console.warn("[Audit] DB write skipped:", dbErr);
      return NextResponse.json({ ok: true, persisted: false, entry });
    }
  } catch (error) {
    console.error("[Audit API] Error:", error);
    return NextResponse.json(
      { error: "Audit commit failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/audit?consultationId=xxx
 * Retrieves the audit chain for a consultation.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const consultationId = searchParams.get("consultationId");

  if (!consultationId) {
    return NextResponse.json({ error: "consultationId required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("consultation_id", consultationId)
      .order("timestamp", { ascending: true });

    if (error) {
      return NextResponse.json({ entries: [], warning: error.message });
    }

    return NextResponse.json({ entries: data ?? [] });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}
