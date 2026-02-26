import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// POST — Start a new consultation
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { patient_id, doctor_id, consultation_type, chief_complaint } = body;

        if (!patient_id || !doctor_id) {
            return NextResponse.json({ error: "patient_id and doctor_id are required" }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from("consultations")
            .insert({
                patient_id,
                doctor_id,
                consultation_type: consultation_type ?? "general",
                chief_complaint: chief_complaint ?? "",
                status: "active",
                started_at: new Date().toISOString(),
                consent_recorded: false,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ consultation: data });
    } catch {
        return NextResponse.json({ error: "Failed to create consultation" }, { status: 500 });
    }
}

// GET — List consultations (optionally filter by doctor_id, patient_id, status)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const doctor_id = searchParams.get("doctor_id");
        const patient_id = searchParams.get("patient_id");
        const status = searchParams.get("status");

        const supabase = getSupabaseAdminClient();
        let query = supabase.from("consultations").select("*, patients(name, dob, gender, blood_group, allergies, chronic_conditions)").order("started_at", { ascending: false });

        if (doctor_id) query = query.eq("doctor_id", doctor_id);
        if (patient_id) query = query.eq("patient_id", patient_id);
        if (status) query = query.eq("status", status);

        const { data, error } = await query.limit(50);

        if (error) {
            return NextResponse.json({ consultations: [], error: error.message });
        }

        return NextResponse.json({ consultations: data ?? [] });
    } catch {
        return NextResponse.json({ consultations: [] });
    }
}

// PATCH — Update consultation (status change, finalize)
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, status, ended_at, chief_complaint, consent_recorded, consent_timestamp } = body;

        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();

        const update: Record<string, unknown> = {};
        if (status) update.status = status;
        if (ended_at) update.ended_at = ended_at;
        if (chief_complaint !== undefined) update.chief_complaint = chief_complaint;
        if (consent_recorded !== undefined) update.consent_recorded = consent_recorded;
        if (consent_timestamp) update.consent_timestamp = consent_timestamp;

        const { data, error } = await supabase
            .from("consultations")
            .update(update)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ consultation: data });
    } catch {
        return NextResponse.json({ error: "Failed to update consultation" }, { status: 500 });
    }
}
