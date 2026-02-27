import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// GET — Fetch family members for a patient
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const patient_id = searchParams.get("patient_id");

        if (!patient_id) {
            return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from("family_members")
            .select("*")
            .eq("patient_id", patient_id)
            .order("generation", { ascending: true });

        if (error) {
            return NextResponse.json({ members: [], error: error.message });
        }

        return NextResponse.json({ members: data ?? [] });
    } catch {
        return NextResponse.json({ members: [] });
    }
}

// POST — Add a new family member
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { patient_id, name, relation, age, gender, conditions, deceased, is_patient, parent_id, generation } = body;

        if (!patient_id || !name || !relation) {
            return NextResponse.json({ error: "patient_id, name, and relation are required" }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from("family_members")
            .insert({
                patient_id,
                name,
                relation,
                age: age ?? null,
                gender: gender ?? null,
                conditions: conditions ?? [],
                deceased: deceased ?? false,
                is_patient: is_patient ?? false,
                parent_id: parent_id ?? null,
                generation: generation ?? 0,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ member: data });
    } catch {
        return NextResponse.json({ error: "Failed to add family member" }, { status: 500 });
    }
}
