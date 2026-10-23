import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { errorResponse,HttpError,privateJson } from "@/lib/server/http";
import { normalizeMedicationsArray } from "@/lib/clinical/normalizeMedications";
import { buildClinicalSummary } from "@/lib/clinical/summaries";
import { containLegacyRoute } from "@/lib/server/containment";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// POST/PUT — Upsert EMR entry for a consultation
async function legacyPOST(
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
// Repaired read path. Draft mutation remains contained below.
export async function GET(_request:Request, context:{params:Promise<{id:string}>}) {
    try {
        const client=await getSupabaseServerClient();
        await resolvePrincipal(client);
        const id=(await context.params).id;
        if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400,"INVALID_ID","A consultation UUID is required.");
        const {data:consultation,error:scopeError}=await client.from("consultations").select("id").eq("id",id).maybeSingle();
        if(scopeError) throw new HttpError(503,"RECORD_UNAVAILABLE","Clinical records are temporarily unavailable.");
        if(!consultation) throw new HttpError(404,"NOT_FOUND","Consultation unavailable.");
        const {data:rows,error}=await client.from("emr_entries").select("*").eq("consultation_id",id).order("created_at",{ascending:false}).limit(2);
        if(error) throw new HttpError(503,"RECORD_UNAVAILABLE","Clinical records are temporarily unavailable.");
        if(!rows?.length) throw new HttpError(404,"NOT_FOUND","Draft unavailable.");
        if(rows.length>1) throw new HttpError(409,"HISTORY_RECONCILIATION_REQUIRED","Multiple historical drafts require reconciliation.");
        const row=rows[0];
        const medications=normalizeMedicationsArray(row.medications);
        const snapshot={...row,medications};
        const summary=row.clinical_summary ?? buildClinicalSummary({chief_complaint:row.chief_complaint,diagnosis_text:row.diagnosis,lab_tests_ordered:row.lab_tests_ordered,medications});
        return privateJson({data:{snapshot,sourceMedications:row.medications,requiresReview:true,normalizationLimited:Array.isArray(row.medications)&&row.medications.length>50,clinicalSummary:summary,summaryKind:row.clinical_summary ? "persisted":"deterministic_source_format"},meta:{requestId:crypto.randomUUID()}});
    } catch(error) { return errorResponse(error); }
}

// Quarantined pending scoped service and database-policy verification.
export const POST = containLegacyRoute(legacyPOST);
