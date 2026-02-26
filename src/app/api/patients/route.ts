import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// POST — Register a new patient
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, phone, dob, gender, blood_group, abha_id, allergies, chronic_conditions, emergency_contact, address } = body;

        if (!name || !phone) {
            return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();

        // Generate a user ID
        const userId = `patient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Create user entry
        const { error: userError } = await supabase.from("users").insert({
            id: userId,
            email: `${phone.replace(/\D/g, "")}@patient.nexusmd.app`,
            name,
            role: "patient",
            is_active: true,
        });

        if (userError) {
            return NextResponse.json({ error: userError.message }, { status: 500 });
        }

        // Create patient entry
        const { data: patient, error: patientError } = await supabase.from("patients").insert({
            user_id: userId,
            name,
            phone: phone ?? "",
            dob: dob ?? null,
            gender: gender ?? "Other",
            blood_group: blood_group ?? "",
            abha_id: abha_id ?? null,
            allergies: allergies ?? [],
            chronic_conditions: chronic_conditions ?? [],
            emergency_contact: emergency_contact ?? "",
            address: address ?? "",
        }).select().single();

        if (patientError) {
            return NextResponse.json({ error: patientError.message }, { status: 500 });
        }

        return NextResponse.json({ patient: { ...patient, user_id: userId } });
    } catch {
        return NextResponse.json({ error: "Failed to register patient" }, { status: 500 });
    }
}

// GET — Search patients by phone, name, or ABHA ID
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q") ?? "";
        const doctor_id = searchParams.get("doctor_id");

        const supabase = getSupabaseAdminClient();

        let dbQuery = supabase.from("patients").select("*, users(email, role, is_active)").order("created_at", { ascending: false });

        if (query.length > 0) {
            // Search across name, phone, abha_id
            dbQuery = dbQuery.or(`name.ilike.%${query}%,phone.ilike.%${query}%,abha_id.ilike.%${query}%`);
        }

        if (doctor_id) {
            // Filter patients who have had consultations with this doctor
            // For now, return all patients (doctor filter would need a join)
        }

        const { data, error } = await dbQuery.limit(50);

        if (error) {
            return NextResponse.json({ patients: [], error: error.message });
        }

        return NextResponse.json({ patients: data ?? [] });
    } catch {
        return NextResponse.json({ patients: [] });
    }
}
