import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

/**
 * POST /api/consent
 * Receives base64-encoded audio blob and stores it in Supabase Storage.
 * Returns the public URL linked to the consultation.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get("audio") as Blob | null;
    const consultationId = formData.get("consultationId") as string;
    const actorId = formData.get("actorId") as string | null;

    if (!audioBlob || !consultationId) {
      return NextResponse.json({ error: "audio and consultationId are required" }, { status: 400 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `consent_${consultationId}_${timestamp}.webm`;

    try {
      const supabase = getSupabaseAdminClient();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data, error } = await supabase.storage
        .from("consent-recordings")
        .upload(filename, buffer, {
          contentType: "audio/webm",
          upsert: false,
        });

      if (error) {
        // Storage bucket may not exist in demo — return simulated URL
        console.warn("[Consent] Storage upload failed:", error.message);
        const simulatedUrl = `consent://${consultationId}/${filename}`;
        return NextResponse.json({
          ok: true,
          persisted: false,
          consent_url: simulatedUrl,
          filename,
          warning: "Storage bucket not available in demo mode",
        });
      }

      const { data: publicData } = supabase.storage
        .from("consent-recordings")
        .getPublicUrl(data.path);

      return NextResponse.json({
        ok: true,
        persisted: true,
        consent_url: publicData.publicUrl,
        filename,
      });
    } catch (storageErr) {
      console.warn("[Consent] Storage skipped:", storageErr);
      const simulatedUrl = `consent://${consultationId}/${filename}`;
      return NextResponse.json({
        ok: true,
        persisted: false,
        consent_url: simulatedUrl,
        filename,
      });
    }
  } catch (error) {
    console.error("[Consent API] Error:", error);
    return NextResponse.json(
      { error: "Consent upload failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
