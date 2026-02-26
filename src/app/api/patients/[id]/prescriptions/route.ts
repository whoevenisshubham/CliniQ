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
            return NextResponse.json({ prescriptions: [] });
        }

        const { data, error } = await supabase
            .from("prescriptions")
            .select(`
        *,
        doctor:users!prescriptions_doctor_id_fkey (name)
      `)
            .eq("patient_id", patient.id)
            .order("prescribed_at", { ascending: false });

        if (error) {
            console.error("[API] prescriptions error:", error);
            return NextResponse.json({ prescriptions: [], error: error.message });
        }

        return NextResponse.json({ prescriptions: data ?? [] });
    } catch (err) {
        console.error("[API] prescriptions error:", err);
        return NextResponse.json({ prescriptions: [], error: "Failed to fetch" });
    }
}
