import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    try {
        // Get patient UUID from user_id (demo-auth id)
        const { data: patient } = await supabase
            .from("patients")
            .select("id")
            .eq("user_id", id)
            .single();

        if (!patient) {
            return NextResponse.json({ consultations: [], error: "Patient not found" });
        }

        // Get consultations with EMR data and doctor name
        const { data: consultations, error } = await supabase
            .from("consultations")
            .select(`
        *,
        emr_entries (*),
        doctor:users!consultations_doctor_id_fkey (name, department)
      `)
            .eq("patient_id", patient.id)
            .order("started_at", { ascending: false });

        if (error) {
            console.error("[API] consultations fetch error:", error);
            return NextResponse.json({ consultations: [], error: error.message });
        }

        return NextResponse.json({ consultations: consultations ?? [] });
    } catch (err) {
        console.error("[API] consultations error:", err);
        return NextResponse.json({ consultations: [], error: "Failed to fetch" });
    }
}
