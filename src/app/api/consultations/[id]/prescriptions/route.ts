import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// POST — Save prescriptions from a consultation
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: consultationId } = await params;
        const body = await request.json();
        const { prescriptions, doctor_id, patient_id } = body;

        if (!prescriptions || !Array.isArray(prescriptions) || prescriptions.length === 0) {
            return NextResponse.json({ error: "prescriptions array is required" }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();

        const rows = prescriptions.map((rx: Record<string, unknown>) => ({
            consultation_id: consultationId,
            patient_id: patient_id ?? "",
            doctor_id: doctor_id ?? "",
            medication_name: rx.name ?? rx.medication_name ?? "",
            generic_name: rx.generic_name ?? "",
            dosage: rx.dosage ?? "",
            frequency: rx.frequency ?? "",
            duration: rx.duration ?? "",
            route: rx.route ?? "oral",
            instructions: rx.instructions ?? "",
            status: "active",
            prescribed_at: new Date().toISOString(),
        }));

        const { data, error } = await supabase
            .from("prescriptions")
            .insert(rows)
            .select();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ prescriptions: data ?? [] });
    } catch {
        return NextResponse.json({ error: "Failed to save prescriptions" }, { status: 500 });
    }
}
