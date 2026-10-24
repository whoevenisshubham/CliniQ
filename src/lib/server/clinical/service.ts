import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { resolvePrincipal } from "../auth/context";
import { HttpError } from "../http";
import { id } from "../documents/service";
import { validateProposal } from "@/lib/clinical/proposals";
function check(error: PostgrestError | null) {
    if (!error)
        return;
    const codes: Record<string, [
        number,
        string
    ]> = {
        AUTH_REQUIRED: [401, "Sign in to continue."], NOT_FOUND: [404, "Consultation unavailable."],
        REVISION_CONFLICT: [409, "This encounter changed. Reload before saving. Your unsaved input has been retained."],
        IDEMPOTENCY_CONFLICT: [409, "This operation key was used for different content."],
        ENCOUNTER_CLOSED: [409, "This encounter is closed. Approved records cannot be edited."],
        LEGACY_RECONCILIATION_REQUIRED: [409, "This historical encounter requires explicit reconciliation."],
        REVIEW_REQUIRED: [422, "Review the current saved draft and confirm it before finalizing."],
        MEDICATION_REVIEW_REQUIRED: [422, "Complete medication fields or explicitly record unknown values with a reason."],
        INVALID_SNAPSHOT: [422, "Check the bounded clinical fields."], INVALID_MEDICATION: [422, "Check the medication fields."],
        INVALID_VITALS: [422, "Check measurement values and explicit units."], INVALID_SEGMENT: [422, "Check transcript sequence and text bounds."],
        INVALID_COMMAND: [400, "Invalid clinical request."], SEGMENT_CONFLICT: [409, "This transcript segment is already saved. Reload to reconcile."],
        OPERATION_LIMIT: [429, "Clinical operation allowance reached."],
        AMENDMENT_EXISTS: [409, "A correction for this version already exists. Open the existing encounter."],
        ALLERGY_REVIEW_REQUIRED: [422, "A medicine name exactly matches a recorded allergy. Record a reasoned review acknowledgement."],
        UNIT_REVIEW_REQUIRED: [422, "Review conflicting recorded measurement units and record a reason."],
        STALE_PROPOSAL: [409, "This suggestion predates a clinician edit. It cannot replace the current findings. Review its source and edit manually if appropriate."],
    };
    const c = Object.keys(codes).find(k => error.message === k);
    if (c)
        throw new HttpError(codes[c][0], c, codes[c][1]);
    if (["22P02", "23514", "23505", "22003", "22007", "22008"].includes(error.code))
        throw new HttpError(422, "INVALID_CLINICAL_INPUT", "Check identifiers, values and transcript order.");
    throw new HttpError(503, "CLINICAL_UNAVAILABLE", "Clinical records are temporarily unavailable.");
}
export async function mutateClinical(client: SupabaseClient, key: string, command: unknown) {
    const principal = await resolvePrincipal(client);
    if (principal.role !== "doctor")
        throw new HttpError(403, "PROVIDER_REQUIRED", "A treating clinician is required.");
    id(key);
    const r = await client.rpc("clinical_mutate", { k: key, command });
    check(r.error);
    return r.data;
}
export async function clinicalList(client: SupabaseClient) {
    const p = await resolvePrincipal(client);
    if (p.role === "patient") {
        const [r, rx] = await Promise.all([client.from("emr_versions").select("id,consultation_id,version_no,reviewed_at,snapshot,content_sha256,source_revision,amended_from_id").order("reviewed_at", { ascending: false }).limit(50), client.from("prescriptions").select("id,approved_emr_version_id,medication_name,dosage,frequency,duration,route,instructions,unknown_fields").order("created_at", { ascending: false }).limit(200)]);
        check(r.error);
        check(rx.error);
        return { approved: r.data, prescriptions: rx.data, role: p.role };
    }
    if (p.role !== "doctor")
        throw new HttpError(403, "PROVIDER_REQUIRED", "A treating clinician is required.");
    const [visits, patients, care] = await Promise.all([
        client.from("consultations").select("id,patient_id,workspace_id,revision,status,started_at").order("started_at", { ascending: false }).limit(50),
        client.from("patients").select("id,name,allergies").limit(50),
        client.from("care_relationships").select("patient_id,workspace_id").eq("provider_id", p.id).eq("scope", "clinical").is("revoked_at", null).limit(50),
    ]);
    for (const r of [visits, patients, care])
        check(r.error);
    return { visits: visits.data, patients: patients.data, care: care.data, role: p.role };
}
export async function clinicalDetail(client: SupabaseClient, encounterId: string) {
    const p = await resolvePrincipal(client);
    id(encounterId);
    if (p.role !== "doctor")
        throw new HttpError(403, "PROVIDER_REQUIRED", "Drafts are private to the treating clinician.");
    const visit = await client.from("consultations").select("id,patient_id,workspace_id,revision,status,started_at").eq("id", encounterId).maybeSingle();
    check(visit.error);
    if (!visit.data)
        throw new HttpError(404, "NOT_FOUND", "Consultation unavailable.");
    const [draft, segments, patient, approved, documents, history, prescriptions, proposals] = await Promise.all([
        client.from("clinical_drafts").select("*").eq("consultation_id", encounterId).maybeSingle(),
        client.from("clinical_segments").select("id,sequence,text,speaker,language,start_ms,end_ms,source_type,speech_provenance").eq("consultation_id", encounterId).order("sequence").limit(1000),
        client.from("patients").select("id,name,allergies").eq("id", visit.data.patient_id).maybeSingle(),
        client.from("emr_versions").select("id,snapshot,reviewed_at,version_no,source_revision,field_provenance,amended_from_id").eq("consultation_id", encounterId).order("version_no"),
        client.from("documents").select("id,title,current_version_id,created_at").eq("patient_id", visit.data.patient_id).eq("status", "ready").limit(20),
        client.from("emr_versions").select("id,consultation_id,snapshot,reviewed_at,amended_from_id,consultations!emr_versions_consultation_id_fkey!inner(patient_id)").eq("consultations.patient_id", visit.data.patient_id).order("reviewed_at", { ascending: false }).limit(5),
        client.from("prescriptions").select("id,approved_emr_version_id,medication_name,dosage,frequency,duration,route,instructions,status,prescribed_at").eq("patient_id", visit.data.patient_id).order("prescribed_at", { ascending: false }).limit(50),
        client.from("clinical_proposals").select("id,base_revision,operations,source_snapshot,result_kind,state,created_at").eq("consultation_id", encounterId).order("created_at", { ascending: false }).limit(100),
    ]);
    for (const r of [draft, segments, patient, approved, documents, history, prescriptions, proposals])
        check(r.error);
    if (!draft.data)
        throw new HttpError(409, "LEGACY_RECONCILIATION_REQUIRED", "This historical encounter requires explicit reconciliation.");
    // Recheck access and revision after assembling private detail.
    const current = await client.from("consultations").select("revision").eq("id", encounterId).maybeSingle();
    check(current.error);
    if (!current.data)
        throw new HttpError(404, "NOT_FOUND", "Consultation unavailable.");
    if (current.data.revision !== visit.data.revision)
        throw new HttpError(409, "REVISION_CONFLICT", "This encounter changed. Reload to read current content.");
    return { visit: visit.data, draft: draft.data, segments: segments.data, patient: patient.data, approved: approved.data, history: history.data, prescriptions: prescriptions.data, documents: documents.data, proposals: proposals.data };
}
export async function offerClinicalProposal(admin: SupabaseClient, actorId: string, encounterId: string, raw: unknown) {
    id(actorId);
    id(encounterId);
    const sources = await admin.from("clinical_segments").select("id,sequence,text").eq("consultation_id", encounterId).order("sequence").limit(1000);
    check(sources.error);
    const p = validateProposal(raw, sources.data ?? []);
    const result = await admin.rpc("clinical_offer", { a: actorId, c: encounterId, p, mode: "offline_fixture" });
    check(result.error);
    return result.data as string;
}
export async function reviewClinicalProposal(client: SupabaseClient, proposalId: string, key: string, input: unknown) {
    const p = await resolvePrincipal(client);
    if (p.role !== "doctor")
        throw new HttpError(403, "PROVIDER_REQUIRED", "A treating clinician is required.");
    id(proposalId);
    id(key);
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw new HttpError(400, "INVALID_COMMAND", "A review decision is required.");
    const b = input as Record<string, unknown>;
    if (Object.keys(b).sort().join() !== "decision,expectedRevision" || !Number.isInteger(b.expectedRevision) || Number(b.expectedRevision) < 0 || !["accept", "reject"].includes(String(b.decision)))
        throw new HttpError(400, "INVALID_COMMAND", "A bounded review decision is required.");
    const result = await client.rpc("clinical_apply_proposal", { k: key, pid: proposalId, expected: b.expectedRevision, decision: b.decision });
    check(result.error);
    return result.data;
}
