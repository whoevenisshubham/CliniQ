import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// GET — Today's queue (optionally filter by doctor)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const doctor_id = searchParams.get("doctor_id");
        const status = searchParams.get("status");

        const supabase = getSupabaseAdminClient();

        // Get today's start
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let query = supabase
            .from("patient_queue")
            .select("*")
            .gte("created_at", todayStart.toISOString())
            .order("queue_number", { ascending: true });

        if (doctor_id) query = query.eq("doctor_id", doctor_id);
        if (status) query = query.eq("status", status);

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ queue: [], error: error.message });
        }

        return NextResponse.json({ queue: data ?? [] });
    } catch {
        return NextResponse.json({ queue: [] });
    }
}

// POST — Add patient to queue
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { patient_id, patient_name, doctor_id, doctor_name, priority, reason, visit_type, registered_by } = body;

        if (!patient_id || !patient_name) {
            return NextResponse.json({ error: "patient_id and patient_name are required" }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();

        // Get next queue number for this doctor today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: existing } = await supabase
            .from("patient_queue")
            .select("queue_number")
            .eq("doctor_id", doctor_id ?? "")
            .gte("created_at", todayStart.toISOString())
            .order("queue_number", { ascending: false })
            .limit(1);

        const nextNumber = (existing && existing.length > 0 ? existing[0].queue_number : 0) + 1;

        const { data, error } = await supabase.from("patient_queue").insert({
            patient_id,
            patient_name,
            doctor_id: doctor_id ?? "",
            doctor_name: doctor_name ?? "",
            queue_number: nextNumber,
            priority: priority ?? "normal",
            reason: reason ?? "",
            visit_type: visit_type ?? "walk-in",
            registered_by: registered_by ?? "",
            status: "waiting",
        }).select().single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ entry: data });
    } catch {
        return NextResponse.json({ error: "Failed to add to queue" }, { status: 500 });
    }
}

// PATCH — Update queue status
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, consultation_id, status, vitals_recorded } = body;

        const supabase = getSupabaseAdminClient();

        const update: Record<string, unknown> = {};
        if (status) update.status = status;
        if (vitals_recorded) update.vitals_recorded = vitals_recorded;
        if (consultation_id) update.consultation_id = consultation_id;

        if (status === "in-consultation") {
            update.start_time = new Date().toISOString();
        } else if (status === "completed") {
            update.end_time = new Date().toISOString();
        }

        // Update by ID or by consultation_id
        let query;
        if (id) {
            query = supabase.from("patient_queue").update(update).eq("id", id);
        } else if (consultation_id) {
            query = supabase.from("patient_queue").update(update).eq("consultation_id", consultation_id);
        } else {
            return NextResponse.json({ error: "id or consultation_id required" }, { status: 400 });
        }

        const { data, error } = await query.select().single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ entry: data });
    } catch {
        return NextResponse.json({ error: "Failed to update queue" }, { status: 500 });
    }
}
