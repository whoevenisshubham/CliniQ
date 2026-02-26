import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// POST/PUT — Upsert EMR entry for a consultation
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: consultationId } = await params;
        const body = await request.json();

        const supabase = getSupabaseAdminClient();

        // Check if EMR entry already exists for this consultation
        const { data: existing } = await supabase
            .from("emr_entries")
            .select("id")
            .eq("consultation_id", consultationId)
            .maybeSingle();

        const emrData = {
            consultation_id: consultationId,
            chief_complaint: body.chief_complaint ?? "",
            symptoms: body.symptoms ?? [],
            diagnosis: body.diagnosis ?? [],
            icd_codes: body.icd_codes ?? [],
            medications: body.medications ?? [],
            lab_tests_ordered: body.lab_tests_ordered ?? [],
            physical_examination: body.physical_examination ?? "",
            vitals: body.vitals ?? {},
            clinical_summary: body.clinical_summary ?? "",
            patient_summary: body.patient_summary ?? "",
            missing_fields: body.missing_fields ?? [],
            gap_prompts: body.gap_prompts ?? [],
            updated_at: new Date().toISOString(),
        };

        let result;
        if (existing) {
            // Update existing
            const { data, error } = await supabase
                .from("emr_entries")
                .update(emrData)
                .eq("id", existing.id)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            result = data;
        } else {
            // Insert new
            const { data, error } = await supabase
                .from("emr_entries")
                .insert({ ...emrData, created_at: new Date().toISOString() })
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            result = data;
        }

        return NextResponse.json({ emr: result });
    } catch {
        return NextResponse.json({ error: "Failed to save EMR" }, { status: 500 });
    }
}

// GET — Fetch EMR entry for a consultation
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: consultationId } = await params;
        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from("emr_entries")
            .select("*")
            .eq("consultation_id", consultationId)
            .maybeSingle();

        if (error) return NextResponse.json({ emr: null, error: error.message });

        return NextResponse.json({ emr: data });
    } catch {
        return NextResponse.json({ emr: null });
    }
}
