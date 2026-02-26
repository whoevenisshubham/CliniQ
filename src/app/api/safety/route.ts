import { NextResponse } from "next/server";
import { checkSafetyConsistencies, DEMO_PATIENT_ALLERGIES } from "@/lib/safety-guard";

export async function POST(request: Request) {
  try {
    const { medications, patientAllergies, consultationId } = await request.json();

    if (!Array.isArray(medications) || medications.length === 0) {
      return NextResponse.json({ alerts: [] });
    }

    // Extract medication names (handle both string[] and Medication[])
    const medNames: string[] = medications.map((m: string | { name: string }) =>
      typeof m === "string" ? m : m.name
    );

    // Use provided allergies or fall back to demo patient profile
    const allergies: string[] = Array.isArray(patientAllergies) && patientAllergies.length > 0
      ? patientAllergies
      : DEMO_PATIENT_ALLERGIES;

    const alerts = checkSafetyConsistencies({
      prescribedMeds: medNames,
      patientAllergies: allergies,
      consultationId: consultationId ?? "unknown",
    });

    return NextResponse.json({ alerts, checked_at: new Date().toISOString() });
  } catch (error) {
    console.error("[Safety API]", error);
    return NextResponse.json(
      { error: "Safety check failed", alerts: [] },
      { status: 500 }
    );
  }
}
