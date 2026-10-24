import { beforeAll, afterAll, it, expect, vi } from "vitest";
import {clinicalResponse} from '@/lib/client/workspace-response';
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { localConfiguration, root, sql } from "../../scripts/local-supabase.mjs";
import { GET as list, POST as mutate } from "@/app/api/clinical/route";
import { GET as detail } from "@/app/api/clinical/[id]/route";
import { GET as exportRecord } from "@/app/api/clinical/approved/[id]/route";
import { POST as proposalReview } from "@/app/api/clinical/proposals/[id]/route";
import { offerClinicalProposal } from "@/lib/server/clinical/service";
import { GET as operationLookup } from "@/app/api/clinical/operations/[id]/route";
import { emptySnapshot, type ClinicalSnapshot } from "@/lib/contracts/clinical";
const state = vi.hoisted(() => ({ jar: null as null | {
        getAll: () => {
            name: string;
            value: string;
        }[];
        set: (n: string, v: string) => void;
        delete: (n: string) => void;
    } }));
vi.mock("next/headers", () => ({ cookies: async () => state.jar }));
const config = localConfiguration();
const fixture = JSON.parse(readFileSync(root + "/tests/infra/.runtime/fixture.json", "utf8"));
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const actors: Record<string, {
    appId: string;
    authId: string;
    email: string;
    password: string;
}> = {};
const clients: Record<string, SupabaseClient> = {}, jars: Record<string, NonNullable<typeof state.jar>> = {};
const patientId = randomUUID(), workspace = fixture.ids.workspaceA;
let encounter = "", revision = 0;
let snapshot: ClinicalSnapshot = emptySnapshot();
const createKey = randomUUID();
const origin = "http://localhost:3000";
function make() { const values = new Map<string, string>(); const jar = { getAll: () => [...values].map(([name, value]) => ({ name, value })), set: (n: string, v: string) => { values.set(n, v); }, delete: (n: string) => { values.delete(n); } }; return { jar, client: createServerClient(config.API_URL, config.ANON_KEY, { cookies: { getAll: jar.getAll, setAll: items => items.forEach(x => jar.set(x.name, x.value)) } }) }; }
async function call(command: unknown, key = randomUUID(), actor = "doctor") {
    state.jar = jars[actor];
    const r=await mutate(new Request(origin + "/api/clinical", { method: "POST", headers: { origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(command) }));
    if(r.ok)expect(clinicalResponse(await r.clone().json(),'/api/clinical',true)).toBe(true);return r;
}
const creation = () => ({ action: "create", patientId, workspaceId: workspace });
const save = () => ({ action: "save", consultationId: encounter, expectedRevision: revision, snapshot });
const finalize = () => ({ action: "finalize", consultationId: encounter, expectedRevision: revision, reviewedDraftRevision: revision, confirmed: true, acknowledgements: {} });
async function current() { state.jar = jars.doctor; const r = await detail(new Request(origin), { params: Promise.resolve({ id: encounter }) }); expect(r.status).toBe(200);const b=await r.json();expect(clinicalResponse(b,'/api/clinical/'+encounter)).toBe(true);return b.data; }
beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", config.API_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", config.ANON_KEY);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", config.SERVICE_ROLE_KEY);
    vi.stubEnv("APP_ORIGIN", origin);
    for (const role of ["doctor", "patient"]) {
        const appId = randomUUID(), email = `m3.${role}.${randomUUID()}@synthetic.example.test`, password = randomUUID() + randomUUID();
        const a = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        expect(a.error).toBeNull();
        actors[role] = { appId, authId: a.data.user!.id, email, password };
        expect((await admin.from("users").insert({ id: appId, auth_user_id: a.data.user!.id, email, name: `Synthetic M3 ${role}`, role, is_active: true })).error).toBeNull();
    }
    expect((await admin.from("patients").insert({ id: patientId, user_id: actors.patient.appId, name: "Synthetic M3 patient", allergies: ["Synthetic allergen"] })).error).toBeNull();
    expect((await admin.from("workspace_memberships").insert({ workspace_id: workspace, user_id: actors.doctor.appId, role: "doctor", status: "active" })).error).toBeNull();
    expect((await admin.from("care_relationships").insert({ patient_id: patientId, provider_id: actors.doctor.appId, workspace_id: workspace, scope: "clinical", granted_by: actors.patient.appId })).error).toBeNull();
    for (const [name, a] of Object.entries({ ...fixture.actors, ...actors }) as [
        string,
        {
            email: string;
            password: string;
        }
    ][]) {
        const x = make();
        expect((await x.client.auth.signInWithPassword({ email: a.email, password: a.password })).error).toBeNull();
        clients[name] = x.client;
        jars[name] = x.jar;
    }
});
afterAll(() => vi.unstubAllEnvs());
it('accepting a medication delta preserves other saved medicines and unchanged per-field clinician provenance',async()=>{
 const created=await clients.doctor.rpc('clinical_mutate',{k:randomUUID(),command:{action:'create',patientId,workspaceId:workspace}});expect(created.error).toBeNull();const cid=created.data.consultationId;
 const first={id:randomUUID(),name:'Synthetic Drug A',dose:'1.25 mg',frequency:null,duration:null,route:null,instructions:null,unknownFields:['frequency','duration','route']};
 const second={...first,id:randomUUID(),name:'Synthetic Drug B',dose:'5 mg'};
 const saved=await clients.doctor.rpc('clinical_mutate',{k:randomUUID(),command:{action:'save',consultationId:cid,expectedRevision:0,snapshot:{...emptySnapshot(),chief_complaint:'Synthetic medication review',medications:[first,second]}}});expect(saved.error).toBeNull();
 const sid=randomUUID();const transcript=await clients.doctor.rpc('clinical_mutate',{k:randomUUID(),command:{action:'transcript',consultationId:cid,expectedRevision:1,segment:{id:sid,sequence:0,text:'Synthetic Drug A 2.5 mg',speaker:'clinician',language:'en',startMs:null,endMs:null}}});expect(transcript.error).toBeNull();
 const pid=await offerClinicalProposal(admin,actors.doctor.appId,cid,{baseRevision:2,throughSegmentId:sid,operations:[{op:'update_fact',path:'medications',value:[{...first,dose:'2.5 mg'}],evidence_segment_ids:[sid]}]});
 state.jar=jars.doctor;const r=await proposalReview(new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({decision:'accept',expectedRevision:2})}),{params:Promise.resolve({id:pid})});expect(r.status).toBe(200);
 const draft=await clients.doctor.from('clinical_drafts').select('snapshot,provenance').eq('consultation_id',cid).single();expect(draft.error).toBeNull();expect(draft.data!.snapshot.medications).toEqual([{...first,dose:'2.5 mg'},second]);
 expect(draft.data!.provenance.medications.items[first.id].dose.sourceType).toBe('generated_proposal');
 expect(draft.data!.provenance.medications.items[first.id].name.sourceType).toBe('clinician_observation');
 expect(draft.data!.provenance.medications.items[second.id].dose.sourceType).toBe('clinician_observation');
});
it("creates a real encounter/draft/audit once through authenticated handler and concurrent operation retries", async () => {
    const command = creation();
    const responses = await Promise.all([call(command, createKey), call(command, createKey)]);
    const bodies = await Promise.all(responses.map(async (r) => { expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store'); return (await r.json()).data; }));
    expect(bodies[0]).toEqual(bodies[1]);
    encounter = bodies[0].consultationId;
    expect(encounter).toMatch(/^[a-f0-9-]{36}$/);
    expect(bodies[0].revision).toBe(0);
    const d = await current();
    expect(d.patient.id).toBe(patientId);
    expect(d.patient.allergies).toEqual(['Synthetic allergen']);
    expect(d.draft.snapshot).toEqual(emptySnapshot());
    expect((await admin.from('audit_log').select('id').eq('consultation_id', encounter)).data).toHaveLength(1);
    expect((await call({ ...command, patientId: fixture.ids.patientB }, createKey)).status).toBe(409);
    state.jar = jars.doctor;
    const found = await operationLookup(new Request(origin), { params: Promise.resolve({ id: createKey }) });
    expect(found.status).toBe(200);
    expect((await found.json()).data.consultationId).toBe(encounter);
    state.jar = jars.patientB;
    const foreign = await operationLookup(new Request(origin), { params: Promise.resolve({ id: createKey }) });
    expect(foreign.status).toBe(200);
    expect((await foreign.json()).data).toBeNull();
});
it("denies patient, reception, admin, unassigned and cross-workspace creation; rejects forged actor fields", async () => {
    for (const name of ['patient', 'reception', 'admin', 'doctorU', 'doctorB'])
        expect((await call(creation(), randomUUID(), name)).status).toBe(name.startsWith('doctor') ? 404 : 403);
    expect((await call({ ...creation(), actorId: fixture.actors.doctorA.appId })).status).toBe(400);
    expect((await call({ ...creation(), workspaceId: fixture.ids.workspaceB })).status).toBe(404);
});
it("persists stable typed transcript segments and deduplicates request replays without invented timing/speaker", async () => {
    const command = { action: 'transcript', consultationId: encounter, expectedRevision: revision, segment: { id: randomUUID(), sequence: 0, text: 'बुखार नहीं। Dose 2.5 mg, not 25 mg. Synthetic text.', speaker: 'unknown', language: 'Hinglish', startMs: null, endMs: null } };
    const key = randomUUID();
    const r = await call(command, key);
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
    expect((await call(command, key)).status).toBe(200);
    const d = await current();
    expect(d.segments).toHaveLength(1);
    expect(d.segments[0].text).toBe(command.segment.text);
    expect(d.segments[0].speaker).toBe('unknown');
    expect((await call({ ...command, expectedRevision: revision })).status).toBe(409);
    expect((await call({ ...command, expectedRevision: revision, segment: { ...command.segment, id: randomUUID(), sequence: 1, startMs: 10, endMs: 20 } })).status).toBe(422);
});
it("saves exact clinician values and rejects stale tabs, prototype keys and silently unitless measurements", async () => {
    snapshot = { ...emptySnapshot(), chief_complaint: 'Synthetic review; denies fever.', symptoms: ['No fever'], medications: [{ id: randomUUID(), name: 'Synthetic medicine', dose: '2.5 mg', frequency: 'once daily', duration: '3 days', route: 'oral', instructions: null, unknownFields: [] }], vitals: [{ name: 'temperature', value: 98.6, unit: '°F', observedAt: null }] };
    const command = save();
    const r = await call(command);
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
    expect((await call(command)).status).toBe(409);
    expect((await call({ ...save(), snapshot: { ...snapshot, constructor: { prototype: { isAdmin: true } } } })).status).toBe(422);
    expect((await call({ ...save(), snapshot: { ...snapshot, vitals: [{ name: 'temperature', value: 98.6, unit: '', observedAt: null }] } })).status).toBe(422);
    const d = await current();
    expect(d.draft.snapshot).toEqual(snapshot);
    expect(d.draft.provenance.medications.sourceType).toBe('clinician_observation');
    expect(d.draft.revision).toBe(revision);
});
it("returning clinician session rehydrates committed draft and transcript through the actual route adapter", async () => {
    expect((await clients.doctor.auth.signOut()).error).toBeNull();
    const x = make();
    expect((await x.client.auth.signInWithPassword(actors.doctor)).error).toBeNull();
    clients.doctor = x.client;
    jars.doctor = x.jar;
    const d = await current();
    expect(d.draft.snapshot.medications[0].dose).toBe('2.5 mg');
    expect(d.segments).toHaveLength(1);
    expect(d.visit.revision).toBe(revision);
});
it("concurrent independent stale edits have one winner and a signed-out session cannot save", async () => {
    const command = save(), other = { ...command, snapshot: { ...snapshot, chief_complaint: 'Concurrent synthetic observation — no fever' } };
    const r = await Promise.all([call(command), call(other)]);
    expect(r.map(x => x.status).sort()).toEqual([200, 409]);
    const d = await current();
    revision = d.visit.revision;
    snapshot = structuredClone(d.draft.snapshot);
    const oldJar = jars.doctor;
    expect((await clients.doctor.auth.signOut()).error).toBeNull();
    state.jar = oldJar;
    const denied = await mutate(new Request(origin, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify(save()) }));
    expect([401, 403]).toContain(denied.status);
    const x = make();
    expect((await x.client.auth.signInWithPassword(actors.doctor)).error).toBeNull();
    clients.doctor = x.client;
    jars.doctor = x.jar;
    expect((await current()).visit.revision).toBe(revision);
});
it("durably retains stale proposals without replacing manual dose and accepts only current reviewed source-bound changes", async () => {
    const d = await current(), source = d.segments[0];
    const raw = { baseRevision: revision, throughSegmentId: source.id, operations: [{ op: 'set_fact', path: 'clinical_summary', value: source.text, evidence_segment_ids: [source.id] }] };
    const staleId = await offerClinicalProposal(admin, actors.doctor.appId, encounter, raw);
    snapshot.medications[0].dose = '1.25 mg';
    let r = await call(save());
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
    const review = async (id: string, key = randomUUID(), actor = 'doctor') => { state.jar = jars[actor]; return proposalReview(new Request(origin, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify({ decision: 'accept', expectedRevision: revision }) }), { params: Promise.resolve({ id }) }); };
    expect((await review(staleId)).status).toBe(409);
    let now = await current();
    expect(now.draft.snapshot.medications[0].dose).toBe('1.25 mg');
    const offeredAfterEdit = await offerClinicalProposal(admin, actors.doctor.appId, encounter, raw);
    expect((await current()).proposals.find((p: {
        id: string;
    }) => p.id === offeredAfterEdit).state).toBe('stale');
    const currentId = await offerClinicalProposal(admin, actors.doctor.appId, encounter, { ...raw, baseRevision: revision });
    expect((await review(currentId, randomUUID(), 'patient')).status).toBe(403);
    expect((await review(currentId, randomUUID(), 'doctorU')).status).toBe(404);
    const key = randomUUID();
    r = await review(currentId, key);
    expect(r.status).toBe(200);
    const accepted = (await r.json()).data;
    expect((await review(currentId, key)).status).toBe(200);
    revision = accepted.revision;
    now = await current();
    expect(now.draft.snapshot.clinical_summary).toBe(source.text);
    expect(now.draft.snapshot.medications[0].dose).toBe('1.25 mg');
    expect(now.draft.provenance.clinical_summary).toMatchObject({ sourceType: 'generated_proposal', proposalId: currentId, resultKind: 'offline_fixture', evidenceSegmentIds: [source.id] });
    expect((await clients.patient.from('clinical_proposals').select('*')).data).toEqual([]);
    expect((await clients.doctor.rpc('clinical_offer', { a: actors.doctor.appId, c: encounter, p: raw, mode: 'offline_fixture' })).error?.code).toBe('42501');
    await expect(offerClinicalProposal(admin, actors.doctor.appId, encounter, { ...raw, operations: [{ ...raw.operations[0], evidence_segment_ids: [randomUUID()] }] })).rejects.toThrow();
    snapshot = structuredClone(now.draft.snapshot);
    snapshot.medications[0].dose = '2.5 mg';
    r = await call(save());
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
});
it("patient has no draft, transcript or unapproved prescription visibility", async () => {
    for (const table of ['clinical_drafts', 'clinical_segments', 'emr_versions', 'prescriptions']) {
        const r = await clients.patient.from(table).select('*');
        expect(r.error).toBeNull();
        expect(r.data).toEqual([]);
    }
    state.jar = jars.patient;
    expect((await detail(new Request(origin), { params: Promise.resolve({ id: encounter }) })).status).toBe(403);
});
it("direct authenticated table writes cannot fabricate clinical approval, audit, notification or prescriptions", async () => {
    for (const table of ['clinical_drafts', 'clinical_segments', 'emr_versions', 'clinical_operations', 'prescriptions', 'notifications', 'audit_log']) {
        const r = await clients.doctor.from(table).insert({});
        expect(r.error?.code, table).toBe('42501');
    }
});
it("care revocation immediately blocks reads, saves, finalize and operation replay", async () => {
    const care = await admin.from('care_relationships').select('id').eq('patient_id', patientId).eq('provider_id', actors.doctor.appId).single();
    expect(care.error).toBeNull();
    try {
        expect((await admin.from('care_relationships').update({ revoked_at: new Date().toISOString() }).eq('id', care.data!.id)).error).toBeNull();
        expect((await call(save())).status).toBe(404);
        expect((await call(finalize())).status).toBe(404);
        expect((await call(creation(), createKey)).status).toBe(404);
        state.jar = jars.doctor;
        expect((await detail(new Request(origin), { params: Promise.resolve({ id: encounter }) })).status).toBe(404);
    }
    finally {
        expect((await admin.from('care_relationships').update({ revoked_at: null }).eq('id', care.data!.id)).error).toBeNull();
    }
});
it("requires the current saved review revision and explicit medication unknown reasons", async () => {
    expect((await call({ ...finalize(), reviewedDraftRevision: 0 })).status).toBe(422);
    expect((await call({ ...finalize(), confirmed: false })).status).toBe(422);
    const original = structuredClone(snapshot);
    snapshot.medications[0].dose = null;
    let r = await call(save());
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
    expect((await call(finalize())).status).toBe(422);
    snapshot.medications[0].unknownFields = ['dose'];
    r = await call(save());
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
    expect((await call(finalize())).status).toBe(422);
    snapshot = original;
    r = await call(save());
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
});
it.each(['prescriptions', 'audit_log', 'notifications'])("rolls back every authoritative write when %s rejects finalization", async (table) => {
    const trigger = 'm3_test_fail_' + table;
    sql(`CREATE FUNCTION private.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_ROLLBACK'; END $$; CREATE TRIGGER ${trigger} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION private.${trigger}();`);
    const key = randomUUID(), command = finalize();
    try {
        const r = await call(command, key);
        expect(r.status).toBe(503);
        expect((await admin.from('emr_versions').select('id').eq('consultation_id', encounter)).data).toEqual([]);
        expect((await admin.from('prescriptions').select('id').eq('consultation_id', encounter)).data).toEqual([]);
        expect((await admin.from('clinical_operations').select('operation_key').eq('actor_id', actors.doctor.appId).eq('operation_key', key)).data).toEqual([]);
        const d = await current();
        expect(d.visit.status).toBe('active');
        expect(d.visit.revision).toBe(revision);
        expect(d.draft.snapshot).toEqual(snapshot);
    }
    finally {
        sql(`DROP TRIGGER ${trigger} ON public.${table}; DROP FUNCTION private.${trigger}();`);
    }
});
it("finalizes once under concurrent clicks, produces prescriptions/audit/notification and scoped queue completion", async () => {
    expect((await admin.from('patient_queue').insert({ patient_id: patientId, patient_ref: patientId, doctor_ref: actors.doctor.appId, consultation_ref: encounter, workspace_id: workspace, status: 'in-consultation' })).error).toBeNull();
    const command = finalize(), key = randomUUID();
    const r = await Promise.all([call(command, key), call(command, key)]);
    const data = await Promise.all(r.map(async (r) => { expect(r.status).toBe(200); return (await r.json()).data; }));
    expect(data[0]).toEqual(data[1]);
    expect((await call(command)).status).toBe(409);
    const approved = (await admin.from('emr_versions').select('*').eq('consultation_id', encounter));
    expect(approved.error).toBeNull();
    expect(approved.data).toHaveLength(1);
    expect(approved.data![0].snapshot).toEqual(snapshot);
    const rx = await clients.patient.from('prescriptions').select('dosage,route,approved_emr_version_id').eq('consultation_id', encounter);
    expect(rx.error).toBeNull();
    expect(rx.data).toEqual([{ dosage: '2.5 mg', route: 'oral', approved_emr_version_id: data[0].approvedVersionId }]);
    expect((await clients.patient.from('notifications').select('kind').eq('resource_id', data[0].approvedVersionId)).data).toEqual([{ kind: 'approved_record' }]);
    expect((await admin.from('patient_queue').select('status').eq('consultation_ref', encounter)).data).toEqual([{ status: 'completed' }]);
    const a = await admin.from('audit_log').select('sequence_no,hash,previous_hash').eq('consultation_id', encounter).order('sequence_no');
    expect(a.error).toBeNull();
    for (let i = 1; i < a.data!.length; i++)
        expect(a.data![i].previous_hash).toBe(a.data![i - 1].hash);
    expect((await call(save())).status).toBe(409);
    expect((await admin.from('emr_versions').update({ snapshot: {} }).eq('id', data[0].approvedVersionId)).error?.message).toBe('APPROVED_IMMUTABLE');
});
it("returning patient sees only their approved authoritative record; foreign users cannot enumerate it", async () => {
    expect((await clients.patient.auth.signOut()).error).toBeNull();
    const x = make();
    expect((await x.client.auth.signInWithPassword(actors.patient)).error).toBeNull();
    jars.patient = x.jar;
    clients.patient = x.client;
    state.jar = x.jar;
    const r = await list();
    expect(r.status).toBe(200);
    const d = (await r.json()).data;
    expect(d.approved).toHaveLength(1);
    expect(d.approved[0].snapshot).toEqual(snapshot);
    for (const name of ['patientA', 'patientB', 'doctorU', 'doctorB', 'reception', 'admin']) {
        const r = await clients[name].from('emr_versions').select('*').eq('consultation_id', encounter);
        expect(r.error).toBeNull();
        expect(r.data).toEqual([]);
    }
});
it("linked amendments retain the original approval, exact changed dose and patient-visible version lineage", async () => {
    const old = await clients.patient.from('emr_versions').select('*').eq('consultation_id', encounter).single();
    expect(old.error).toBeNull();
    const key = randomUUID(), command = { action: 'amend', approvedVersionId: old.data!.id };
    let r = await call(command, key);
    expect(r.status).toBe(200);
    const result = (await r.json()).data;
    expect((await call(command, key)).status).toBe(200);
    expect((await call(command)).status).toBe(409);
    encounter = result.consultationId;
    revision = 0;
    const d = await current();
    expect(d.draft.snapshot).toEqual(old.data!.snapshot);
    snapshot = structuredClone(d.draft.snapshot);
    snapshot.medications[0].dose = '1.25 mg';
    snapshot.clinical_summary = '<script>alert("synthetic")</script> & no fever';
    r = await call(save());
    expect(r.status).toBe(200);
    revision = (await r.json()).data.revision;
    r = await call(finalize());
    expect(r.status).toBe(200);
    const amendedId = (await r.json()).data.approvedVersionId;
    const currentVersion = await clients.patient.from('emr_versions').select('*').eq('id', amendedId).single();
    expect(currentVersion.error).toBeNull();
    expect(currentVersion.data!.amended_from_id).toBe(old.data!.id);
    expect(currentVersion.data!.snapshot.medications[0].dose).toBe('1.25 mg');
    expect((await clients.patient.from('emr_versions').select('*').eq('id', old.data!.id).single()).data).toEqual(old.data);
    state.jar = jars.patient;
    const printed = await exportRecord(new Request(origin), { params: Promise.resolve({ id: amendedId }) });
    expect(printed.status).toBe(200);
    expect(printed.headers.get('content-security-policy')).toContain("default-src 'none'");
    const html = await printed.text();
    expect(html).toContain('1.25 mg');
    expect(html).toContain('98.6');
    expect(html).toContain('°F');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain(old.data!.id);
    state.jar = jars.patientB;
    expect((await exportRecord(new Request(origin), { params: Promise.resolve({ id: amendedId }) })).status).toBe(404);
});
