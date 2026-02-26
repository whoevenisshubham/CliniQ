import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    try {
        const { data: patient } = await supabase
            .from("patients")
            .select("id")
            .eq("user_id", id)
            .single();

        if (!patient) {
            return NextResponse.json({ upcoming: [], past: [] });
        }

        const today = new Date().toISOString().split("T")[0];

        const { data: upcoming } = await supabase
            .from("appointments")
            .select(`*, doctor:users!appointments_doctor_id_fkey (name, department)`)
            .eq("patient_id", patient.id)
            .gte("date", today)
            .in("status", ["confirmed"])
            .order("date", { ascending: true });

        const { data: past } = await supabase
            .from("appointments")
            .select(`*, doctor:users!appointments_doctor_id_fkey (name, department)`)
            .eq("patient_id", patient.id)
            .or(`date.lt.${today},status.eq.completed,status.eq.cancelled`)
            .order("date", { ascending: false })
            .limit(10);

        return NextResponse.json({
            upcoming: upcoming ?? [],
            past: past ?? [],
        });
    } catch (err) {
        console.error("[API] appointments error:", err);
        return NextResponse.json({ upcoming: [], past: [], error: "Failed to fetch" });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    try {
        const body = await request.json();
        const { doctor_id, date, time_slot, type, mode, reason } = body;

        const { data: patient } = await supabase
            .from("patients")
            .select("id")
            .eq("user_id", id)
            .single();

        if (!patient) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        const { data, error } = await supabase
            .from("appointments")
            .insert({
                patient_id: patient.id,
                doctor_id,
                date,
                time_slot,
                type: type ?? "general",
                mode: mode ?? "in-person",
                reason,
                status: "confirmed",
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ appointment: data });
    } catch (err) {
        console.error("[API] appointment create error:", err);
        return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }
}
