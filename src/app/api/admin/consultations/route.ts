import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    try {
        let query = supabase
            .from("consultations")
            .select(`
        *,
        patient:patients!consultations_patient_id_fkey (name, abha_id, phone),
        doctor:users!consultations_doctor_id_fkey (name, department),
        emr_entries (*),
        billing:billing_drafts (total, status)
      `)
            .order("started_at", { ascending: false })
            .limit(limit);

        if (status) query = query.eq("status", status);
        if (type) query = query.eq("consultation_type", type);

        const { data, error } = await query;

        if (error) {
            console.error("[Admin API] consultations error:", error);
            return NextResponse.json({ consultations: [], error: error.message });
        }

        let results = data ?? [];

        // Client-side search filter (patient name or doctor name)
        if (search) {
            const s = search.toLowerCase();
            results = results.filter((c: Record<string, unknown>) => {
                const patient = c.patient as { name?: string } | null;
                const doctor = c.doctor as { name?: string } | null;
                const complaint = c.chief_complaint as string | null;
                return (
                    patient?.name?.toLowerCase().includes(s) ||
                    doctor?.name?.toLowerCase().includes(s) ||
                    complaint?.toLowerCase().includes(s)
                );
            });
        }

        return NextResponse.json({ consultations: results });
    } catch (err) {
        console.error("[Admin API] consultations error:", err);
        return NextResponse.json({ consultations: [], error: "Failed to fetch" });
    }
}
