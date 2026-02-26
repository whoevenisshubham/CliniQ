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
            .select("*")
            .eq("user_id", id)
            .single();

        if (!patient) {
            return NextResponse.json({ profile: null });
        }

        // Get health score
        const { data: healthScore } = await supabase
            .from("health_scores")
            .select("*")
            .eq("patient_id", patient.id)
            .order("computed_at", { ascending: false })
            .limit(1)
            .single();

        // Get data consents
        const { data: consents } = await supabase
            .from("data_consents")
            .select("*")
            .eq("patient_id", patient.id);

        return NextResponse.json({
            profile: patient,
            health_score: healthScore ?? null,
            consents: consents ?? [],
        });
    } catch (err) {
        console.error("[API] profile error:", err);
        return NextResponse.json({ profile: null, error: "Failed to fetch" });
    }
}
