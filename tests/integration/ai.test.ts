import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import {evidenceResponse} from '@/lib/client/workspace-response';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { jsPDF } from 'jspdf';
import { randomUUID } from 'node:crypto';
import { localConfiguration, root, sql } from '../../scripts/local-supabase.mjs';
import { uploadDocument, changeDocument } from '@/lib/server/documents/service';
import { runDocumentJob } from '@/lib/server/jobs/runner';
import { createThread, admitAI, jobView, threadView } from '@/lib/server/ai/service';
import { runAIJob } from '@/lib/server/ai/runner';
import { HISTORICAL_TEXT_MODEL } from '@/lib/server/ai/provider';
import { POST as threadRoute } from '@/app/api/ai/threads/route';
import { POST as admitRoute } from '@/app/api/ai/threads/[id]/route';
import { GET as jobRoute } from '@/app/api/jobs/[id]/route';
import type { OfflineProvider, Evidence } from '@/lib/contracts/ai';
import { ProviderFailure } from '@/lib/server/ai/failure';
const state = vi.hoisted(() => ({ jar: null as null | {
        getAll: () => {
            name: string;
            value: string;
        }[];
        set: (n: string, v: string) => void;
        delete: (n: string) => void;
    } }));
vi.mock('next/headers', () => ({ cookies: async () => state.jar }));
const cfg = localConfiguration(), base = JSON.parse(readFileSync(root + '/tests/infra/.runtime/fixture.json', 'utf8'));
const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const clients: Record<string, SupabaseClient> = {}, jars: Record<string, NonNullable<typeof state.jar>> = {}, actors: Record<string, {
    id: string;
    patientId?: string;
    authId: string;
    email: string;
    password: string;
}> = {};
let docId = '', versionId = '', revision = 0, threadId = '', providerThread = '', encounter = '', otherDoc = '', otherThread = '';
type ProviderInput = Parameters<OfflineProvider['execute']>[0];
const source = 'Synthetic CBC: haemoglobin 12.4 g/dL; reference range 12.0–16.0 g/dL.';
const denialCounts = { before: 0, after: 0 };
const observed: Record<string, string> = {};
const proof: Record<string, string> = {}, evaluation: {
    id: string;
    expected: string;
    actual: string;
    passed: boolean;
}[] = [];
const cases = JSON.parse(readFileSync(root + '/tests/fixtures/ai/EVAL_CASES.json', 'utf8')).cases as {
    id: string;
    source: string;
    question: string;
    required_tokens: string[];
    expected_state: string;
}[];
const origin = 'http://localhost:3000';
const authRef = 'offline-synthetic-' + randomUUID();
function make() { const map = new Map<string, string>(); const jar = { getAll: () => [...map].map(([name, value]) => ({ name, value })), set: (n: string, v: string) => { map.set(n, v); }, delete: (n: string) => { map.delete(n); } }; return { jar, client: createServerClient(cfg.API_URL, cfg.ANON_KEY, { cookies: { getAll: jar.getAll, setAll: items => items.forEach(x => jar.set(x.name, x.value)) } }) }; }
async function upload(name: string, text = source) { const r = await uploadDocument(clients[name], admin, { key: randomUUID(), title: 'Synthetic AI evidence', fileName: 'evidence.txt', mime: 'text/plain', bytes: new TextEncoder().encode(text) }); const d = await admin.from('documents').select('id,current_version_id,revision').eq('id', r.document_id).single(); expect(d.error).toBeNull(); const job = await admin.from('document_jobs').select('id').eq('document_id', r.document_id).eq('kind', 'ingest_document').order('created_at', { ascending: false }).limit(1).single(); expect(job.error).toBeNull(); expect((await runDocumentJob(admin, job.data!.id)).status).toBe('text_ready'); return d.data!; }
async function admit(question = 'haemoglobin', docs = [docId], name = 'patient', thread = threadId) { return admitAI(clients[name], randomUUID(), thread, { kind: 'answer_question', question, documentIds: docs }); }
const quoteReply = (sources: Evidence[], text = source) => { const s = sources.find(s => s.text.includes(text)); if (!s)
    throw new Error('Synthetic expected evidence absent'); return JSON.stringify({ schemaVersion: '1', answerKind: 'grounded', answer: text, facts: [{ text, evidenceIds: [s.evidenceId], quotedSupport: [{ evidenceId: s.evidenceId, quote: text }] }], definitions: [], uncertainties: [], citedSourceIds: [s.evidenceId] }); };
function double(execute?: OfflineProvider['execute']): OfflineProvider { return { mode: 'offline_fixture', authorizationRef: authRef, model: HISTORICAL_TEXT_MODEL, execute: execute ?? (async (input: ProviderInput) => { const context = JSON.parse(input.messages[1].content); return { text: quoteReply(context.evidence), finishReason: 'stop', usage: { input: 100, output: 100 } }; }) }; }
async function allowance(ref: string, names: string[], kinds: string[], caps: {
    requests: number;
    day?: number;
    actor?: number;
}) {
    expect((await admin.from('provider_allowances').insert({ authorization_ref: ref, mode: 'offline_fixture', provider: 'groq', model: HISTORICAL_TEXT_MODEL, enabled: true, ends_at: new Date(Date.now() + 3600000).toISOString(), max_requests: caps.requests, max_input: 1000000, max_output: 200000, max_per_day: caps.day ?? 30, max_actor_day: caps.actor ?? 30 })).error).toBeNull();
    for (const kind of kinds)
        expect((await admin.from('provider_budgets').insert({ authorization_ref: ref, mode: 'offline_fixture', provider: 'groq', model: HISTORICAL_TEXT_MODEL, kind, enabled: true, allowed_actors: names.map(n => actors[n].id), ends_at: new Date(Date.now() + 3600000).toISOString(), max_requests: 30, max_input: 1000000, max_output: 200000 })).error).toBeNull();
    for (const name of names)
        expect((await admin.from('ai_budget_scope').insert({ actor_id: actors[name].id, patient_id: actors[name].patientId, authorization_ref: ref, expires_at: new Date(Date.now() + 3600000).toISOString() })).error).toBeNull();
    return { ...double(), authorizationRef: ref };
}
beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', cfg.API_URL);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', cfg.ANON_KEY);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', cfg.SERVICE_ROLE_KEY);
    vi.stubEnv('APP_ORIGIN', origin);
    vi.stubEnv('AI_ENABLED', 'false');
    for (const [name, role] of [['patient', 'patient'], ['other', 'patient'], ['doctor', 'doctor']]) {
        const id = randomUUID(), email = `m5.${name}.${randomUUID()}@synthetic.example.test`, password = randomUUID() + randomUUID();
        const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        expect(r.error).toBeNull();
        actors[name] = { id, authId: r.data.user!.id, email, password };
        expect((await admin.from('users').insert({ id, auth_user_id: r.data.user!.id, email, name: 'Synthetic M5 ' + name, role, is_active: true })).error).toBeNull();
        if (role === 'patient') {
            actors[name].patientId = randomUUID();
            expect((await admin.from('patients').insert({ id: actors[name].patientId, user_id: id, name: 'Synthetic M5 patient' })).error).toBeNull();
        }
        const c = make();
        expect((await c.client.auth.signInWithPassword({ email, password })).error).toBeNull();
        clients[name] = c.client;
        jars[name] = c.jar;
    }
    expect((await admin.from('workspace_memberships').insert({ workspace_id: base.ids.workspaceA, user_id: actors.doctor.id, role: 'doctor' })).error).toBeNull();
    expect((await admin.from('care_relationships').insert({ patient_id: actors.patient.patientId, workspace_id: base.ids.workspaceA, provider_id: actors.doctor.id, scope: 'clinical', granted_by: actors.patient.id })).error).toBeNull();
    const created = await clients.doctor.rpc('clinical_mutate', { k: randomUUID(), command: { action: 'create', patientId: actors.patient.patientId, workspaceId: base.ids.workspaceA } });
    expect(created.error).toBeNull();
    encounter = created.data.consultationId;
    const doc = await upload('patient');
    docId = doc.id;
    versionId = doc.current_version_id;
    revision = doc.revision;
    threadId = await createThread(clients.patient, randomUUID(), null);
    providerThread = await createThread(clients.doctor, randomUUID(), encounter);
    expect((await admin.from('provider_allowances').insert({ authorization_ref: authRef, mode: 'offline_fixture', provider: 'groq', model: HISTORICAL_TEXT_MODEL, enabled: true, ends_at: new Date(Date.now() + 3600000).toISOString(), max_requests: 30, max_input: 1000000, max_output: 200000, max_per_day: 60, max_actor_day: 60 })).error).toBeNull();
    for (const name of ['patient', 'doctor'])
        expect((await admin.from('ai_budget_scope').insert({ actor_id: actors[name].id, patient_id: actors.patient.patientId, authorization_ref: authRef, expires_at: new Date(Date.now() + 3600000).toISOString() })).error).toBeNull();
    for (const kind of ['answer_question', 'explain_document', 'extract_emr'])
        expect((await admin.from('provider_budgets').insert({ authorization_ref: authRef, mode: 'offline_fixture', provider: 'groq', model: HISTORICAL_TEXT_MODEL, kind, enabled: true, synthetic_only: true, allowed_actors: [actors.patient.id, actors.doctor.id], ends_at: new Date(Date.now() + 3600000).toISOString(), max_requests: 30, max_input: 1000000, max_output: 200000 })).error).toBeNull();
});
afterAll(() => { vi.unstubAllEnvs(); writeFileSync(root + '/tests/infra/.runtime/ai-evaluation-results.json', JSON.stringify({ version: '1', mode: 'offline_provider_doubles_real_auth_database_storage', liveCalls: 0, denialCounts, observations: observed, scenarioJobIds: proof, sampleSize: cases.length, completed: evaluation.length, passed: evaluation.filter(x => x.passed).length, fixturesSha256: createHash('sha256').update(readFileSync(root + '/tests/fixtures/ai/EVAL_CASES.json')).digest('hex'), cases: cases.map(c => evaluation.find(x => x.id === c.id) ?? { id: c.id, expected: c.expected_state, actual: 'not_run', passed: false }), limitations: ['Finite synthetic protocol/fidelity evaluation, not live model quality or clinical validation.', 'Exact-span gate is conservative; free paraphrase entailment is not established.', 'Authenticated browser and hosted worker acceptance remain separate.'] }, null, 2)); });
it('normal application admission persists a private thread/job and truthfully reports provider-disabled evidence-only state', async () => {
    state.jar = jars.patient;
    const t = await threadRoute(new Request(origin, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: '{}' }));
    expect(t.status).toBe(200);
    expect(evidenceResponse(await t.clone().json(),'/api/ai/threads',true)).toBe(true);
    const tid = (await t.json()).data.threadId;
    const r = await admitRoute(new Request(origin, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify({ kind: 'answer_question', question: 'haemoglobin', documentIds: [docId] }) }), { params: Promise.resolve({ id: tid }) });
    expect(r.status).toBe(202);
    expect(evidenceResponse(await r.clone().json(),'/api/ai/threads/'+tid,true)).toBe(true);
    const jobId = (await r.json()).data.jobId;
    const view = await jobRoute(new Request(origin), { params: Promise.resolve({ id: jobId }) });
    expect(view.status).toBe(200);
    expect(evidenceResponse(await view.clone().json(),'/api/jobs/'+jobId)).toBe(true);
    expect(view.headers.get('cache-control')).toBe('private, no-store');
    const data = (await view.json()).data;
    expect(data.state).toBe('unavailable');
    expect(data.resultKind).toBe('evidence_only');
    expect(data.sources[0].versionId).toBe(versionId);
    expect((await admin.from('provider_attempts').select('id').eq('job_id', jobId)).data).toEqual([]);
});
it('filters cross-owner and unshared provider sources before ranking; care alone never retrieves chunks', async () => {
    denialCounts.before = Number(sql(`select count(*) from public.provider_attempts p join public.document_jobs j on j.id=p.job_id where j.actor_id='${actors.other.id}'`));
    await expect(admit('haemoglobin', [docId], 'other', await createThread(clients.other, randomUUID(), null))).rejects.toMatchObject({ status: 404 });
    await expect(admit('haemoglobin', [docId], 'doctor', providerThread)).rejects.toMatchObject({ status: 404 });
    denialCounts.after = Number(sql(`select count(*) from public.provider_attempts p join public.document_jobs j on j.id=p.job_id where j.actor_id='${actors.other.id}'`));
    expect(denialCounts.after - denialCounts.before).toBe(0);
    proof.E06 = 'denied';
    const foreign = await clients.other.from('document_chunks').select('*').eq('document_id', docId);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
    const j = await admit('haemoglobin', [], 'doctor', providerThread);
    const raw = await admin.from('document_jobs').select('input_snapshot').eq('id', j).single();
    expect(raw.error).toBeNull();
    expect(raw.data!.input_snapshot.sources).toEqual([]);
    const execute = vi.fn(double().execute);
    await runAIJob(admin, j, double(execute));
    expect(execute).not.toHaveBeenCalled();
});
it('keeps a legitimate multi-workspace clinician inside the specifically shared workspace', async () => {
    expect((await admin.from('workspace_memberships').insert({ workspace_id: base.ids.workspaceB, user_id: actors.doctor.id, role: 'doctor' })).error).toBeNull();
    expect((await admin.from('care_relationships').insert({ patient_id: actors.patient.patientId, workspace_id: base.ids.workspaceB, provider_id: actors.doctor.id, scope: 'clinical', granted_by: actors.patient.id })).error).toBeNull();
    let r = await changeDocument(clients.patient, docId, { key: randomUUID(), action: 'share', revision, providerId: actors.doctor.id, workspaceId: base.ids.workspaceB });
    revision = r.revision;
    const parse = await admin.from('document_jobs').select('id').eq('document_id', docId).eq('input_revision', revision).single();
    expect(parse.error).toBeNull();
    await runDocumentJob(admin, parse.data!.id);
    await expect(admit('haemoglobin', [docId], 'doctor', providerThread)).rejects.toMatchObject({ status: 404 });
    const c = await clients.doctor.rpc('clinical_mutate', { k: randomUUID(), command: { action: 'create', patientId: actors.patient.patientId, workspaceId: base.ids.workspaceB } });
    expect(c.error).toBeNull();
    const t = await createThread(clients.doctor, randomUUID(), c.data.consultationId);
    const j = await admit('haemoglobin', [docId], 'doctor', t);
    const input = await admin.from('document_jobs').select('input_snapshot').eq('id', j).single();
    expect(input.error).toBeNull();
    expect(input.data!.input_snapshot.sources).toHaveLength(1);
    r = await changeDocument(clients.patient, docId, { key: randomUUID(), action: 'revoke', revision, providerId: actors.doctor.id, workspaceId: base.ids.workspaceB });
    revision = r.revision;
    expect((await jobView(clients.doctor, admin, j)).state).toBe('cancelled');
    const next = await admin.from('document_jobs').select('id').eq('document_id', docId).eq('input_revision', revision).single();
    expect(next.error).toBeNull();
    await runDocumentJob(admin, next.data!.id);
});
it('an unallowlisted synthetic actor cannot consume another actor’s verification allowance', async () => {
    const doc = await upload('other');
    otherDoc = doc.id;
    const tid = await createThread(clients.other, randomUUID(), null);
    otherThread = tid;
    const j = await admit('haemoglobin', [doc.id], 'other', tid);
    const execute = vi.fn(double().execute);
    await runAIJob(admin, j, double(execute));
    expect(execute).not.toHaveBeenCalled();
    expect((await jobView(clients.other, admin, j)).state).toBe('unavailable');
    for (const table of ['provider_budgets', 'provider_attempts', 'ai_budget_scope', 'provider_allowances', 'provider_daily_usage'])
        expect((await clients.patient.from(table).insert({})).error?.code).toBe('42501');
});
it('uses the same shared worker with a bounded offline provider double and persists exact citations and usage', async () => {
    const key = randomUUID(), input = { kind: 'answer_question', question: 'haemoglobin', documentIds: [docId] };
    const j = await admitAI(clients.patient, key, threadId, input);
    expect(await admitAI(clients.patient, key, threadId, input)).toBe(j);
    await expect(admitAI(clients.patient, key, threadId, { ...input, question: 'different' })).rejects.toMatchObject({ status: 409 });
    const execute = vi.fn(double().execute);
    expect((await runAIJob(admin, j, double(execute))).status).toBe('succeeded');
    expect(execute).toHaveBeenCalledOnce();
    expect((await runAIJob(admin, j, double(execute))).status).toBe('idle');
    expect(execute).toHaveBeenCalledOnce();
    const view = await jobView(clients.patient, admin, j);
    expect(view.state).toBe('succeeded');
    expect(view.resultKind).toBe('offline_fixture');
    expect(view.result.answer).toBe(source);
    expect(view.sources[0].versionId).toBe(versionId);
    expect(view.sources[0].page).toBe(1);
    const p = await admin.from('provider_attempts').select('state,actual_input,actual_output').eq('job_id', j).single();
    expect(p.error).toBeNull();
    expect(p.data).toEqual({ state: 'completed', actual_input: 100, actual_output: 100 });
});
it('rejects wrong citations, altered numerical values and truncated output without treating rejection as a free attempt', async () => {
    for (const mode of ['citation', 'number', 'truncated', 'malformed']) {
        const j = await admit();
        proof[mode === 'citation' ? 'E08' : mode === 'truncated' ? 'E11' : 'numeric-rejection'] = j;
        const execute = vi.fn(async (input: ProviderInput) => { const c = JSON.parse(input.messages[1].content); let text = quoteReply(c.evidence); if (mode === 'citation')
            text = text.replaceAll(c.evidence[0].evidenceId, 'chunk:foreign-999'); if (mode === 'number')
            text = text.replace('12.4', '124'); if (mode === 'malformed')
            text = '{"answer":'; return { text, finishReason: mode === 'truncated' ? 'length' : 'stop', usage: { input: 100, output: 100 } }; });
        expect((await runAIJob(admin, j, double(execute))).status).toBe('rejected');
        expect((await jobView(clients.patient, admin, j)).state).toBe('rejected');
        observed[mode === 'citation' ? 'E08' : mode === 'truncated' ? 'E11' : 'numeric-rejection'] = 'rejected';
        expect(execute).toHaveBeenCalledOnce();
        expect((await admin.from('provider_attempts').select('state').eq('job_id', j)).data).toEqual([{ state: 'completed' }]);
    }
});
it('unknown outcome retains the full reservation and never automatically transmits again', async () => {
    const before = await admin.from('provider_allowances').select('requests,input_tokens,output_tokens').eq('authorization_ref', authRef).single();
    expect(before.error).toBeNull();
    const j = await admit();
    proof.E10 = j;
    const execute = vi.fn(async () => { throw new Error('Synthetic post-send disconnect'); });
    expect((await runAIJob(admin, j, double(execute))).status).toBe('outcome_unknown');
    const p = await admin.from('provider_attempts').select('state,reserved_input,reserved_output').eq('job_id', j).single();
    expect(p.error).toBeNull();
    expect(p.data!.state).toBe('outcome_unknown');
    observed.E10 = 'outcome_unknown';
    expect(p.data!.reserved_output).toBe(3000);
    const after = await admin.from('provider_allowances').select('requests,input_tokens,output_tokens').eq('authorization_ref', authRef).single();
    expect(after.error).toBeNull();
    expect(after.data!.requests).toBe(before.data!.requests + 1);
    expect(Number(after.data!.input_tokens)).toBe(Number(before.data!.input_tokens) + p.data!.reserved_input);
    expect(Number(after.data!.output_tokens)).toBe(Number(before.data!.output_tokens) + 3000);
    expect((await runAIJob(admin, j, double(execute))).status).toBe('idle');
    expect(execute).toHaveBeenCalledOnce();
});
it('recovery after a durable validated response uses the saved result without a second provider call', async () => {
    const j = await admit();
    sql(`CREATE FUNCTION private.m5_publication_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${j}' AND NEW.status='succeeded' THEN RAISE EXCEPTION 'SYNTHETIC_PUBLICATION_FAILURE';END IF;RETURN NEW;END $$;CREATE TRIGGER m5_publication_fault BEFORE UPDATE ON public.document_jobs FOR EACH ROW EXECUTE FUNCTION private.m5_publication_fault();`);
    const execute = vi.fn(double().execute);
    try {
        await expect(runAIJob(admin, j, double(execute))).rejects.toThrow('AI_DATABASE_UNAVAILABLE');
    }
    finally {
        sql('DROP TRIGGER m5_publication_fault ON public.document_jobs;DROP FUNCTION private.m5_publication_fault();');
    }
    const row = await admin.from('document_jobs').select('status,result').eq('id', j).single();
    expect(row.error).toBeNull();
    expect(row.data!.status).toBe('running');
    expect(row.data!.result.answer).toBe(source);
    sql(`UPDATE public.document_jobs SET lease_until=now()-interval '1 second' WHERE id='${j}'`);
    expect((await runAIJob(admin, j, double(execute))).status).toBe('recovered');
    expect(execute).toHaveBeenCalledOnce();
});
it('serializes the global provider reservation and enforces exact budget caps', async () => {
    const first = await admit(), second = await admit();
    let release!: (value: unknown) => void, enter!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const execute = vi.fn(async (input: ProviderInput) => { enter(); await new Promise(r => { release = r; }); const c = JSON.parse(input.messages[1].content); return { text: quoteReply(c.evidence), finishReason: 'stop', usage: { input: 100, output: 100 } }; });
    const running = runAIJob(admin, first, double(execute));
    await Promise.race([entered, running.then(() => { throw new Error('Synthetic expected send did not start'); })]);
    try {
        const blocked = vi.fn(double().execute);
        await runAIJob(admin, second, double(blocked));
        expect(blocked).not.toHaveBeenCalled();
        expect((await jobView(clients.patient, admin, second)).state).toBe('queued');
    }
    finally {
        release(null);
        await running;
    }
    const capRef = 'offline-cap-' + randomUUID();
    expect((await admin.from('provider_budgets').insert({ authorization_ref: capRef, mode: 'offline_fixture', provider: 'groq', model: HISTORICAL_TEXT_MODEL, kind: 'answer_question', enabled: true, allowed_actors: [actors.patient.id], ends_at: new Date(Date.now() + 60000).toISOString(), max_requests: 1, max_input: 50000, max_output: 3000 })).error).toBeNull();
    expect((await admin.from('provider_allowances').insert({ authorization_ref: capRef, mode: 'offline_fixture', provider: 'groq', model: HISTORICAL_TEXT_MODEL, enabled: true, ends_at: new Date(Date.now() + 60000).toISOString(), max_requests: 1, max_input: 50000, max_output: 3000 })).error).toBeNull();
    expect((await admin.from('ai_budget_scope').insert({ actor_id: actors.patient.id, patient_id: actors.patient.patientId, authorization_ref: capRef, expires_at: new Date(Date.now() + 60000).toISOString() })).error).toBeNull();
    const one = await admit(), two = await admit();
    const d = { ...double(), authorizationRef: capRef };
    expect((await runAIJob(admin, one, d)).status).toBe('succeeded');
    const call = vi.fn(d.execute);
    await runAIJob(admin, two, { ...d, execute: call });
    expect(call).not.toHaveBeenCalled();
    expect((await jobView(clients.patient, admin, two)).state).toBe('exhausted');
});
it('one aggregate allowance spans operation kinds and enforces per-actor UTC-day limits', async () => {
    const ref = 'offline-aggregate-' + randomUUID(), d = await allowance(ref, ['patient'], ['answer_question', 'explain_document'], { requests: 1 });
    const first = await admit();
    expect((await runAIJob(admin, first, d)).status).toBe('succeeded');
    const second = await admitAI(clients.patient, randomUUID(), threadId, { kind: 'explain_document', question: 'Explain haemoglobin', documentIds: [docId] });
    const execute = vi.fn(d.execute);
    await runAIJob(admin, second, { ...d, execute });
    expect(execute).not.toHaveBeenCalled();
    expect((await jobView(clients.patient, admin, second)).state).toBe('exhausted');
    const group = await admin.from('provider_allowances').select('requests').eq('authorization_ref', ref).single();
    expect(group.error).toBeNull();
    expect(group.data!.requests).toBe(1);
    const daily = await allowance('offline-actor-day-' + randomUUID(), ['other'], ['answer_question'], { requests: 5, day: 5, actor: 1 });
    const a = await admit('haemoglobin', [otherDoc], 'other', otherThread), b = await admit('haemoglobin', [otherDoc], 'other', otherThread);
    await runAIJob(admin, a, daily);
    const denied = vi.fn(daily.execute);
    await runAIJob(admin, b, { ...daily, execute: denied });
    expect(denied).not.toHaveBeenCalled();
    expect((await jobView(clients.other, admin, b)).state).toBe('exhausted');
});
it('recovers pre-send and post-transmission crashes with fences and no uncertain resend', async () => {
    const ref = 'offline-restart-' + randomUUID(), d = await allowance(ref, ['other'], ['answer_question'], { requests: 5 });
    const j = await admit('haemoglobin', [otherDoc], 'other', otherThread);
    const claim = await admin.rpc('ai_claim', { p_id: j });
    expect(claim.error).toBeNull();
    const old = claim.data[0];
    sql(`UPDATE public.document_jobs SET lease_until=now()-interval '1 second' WHERE id='${j}'`);
    const execute = vi.fn(d.execute);
    expect((await runAIJob(admin, j, { ...d, execute })).status).toBe('succeeded');
    expect(execute).toHaveBeenCalledOnce();
    expect((await admin.rpc('ai_publish', { jid: j, f: old.fence })).data).toBe(false);
    const unknown = await admit('haemoglobin', [otherDoc], 'other', otherThread), c = await admin.rpc('ai_claim', { p_id: unknown });
    expect(c.error).toBeNull();
    const job = c.data[0];
    const reserve = await admin.rpc('ai_reserve', { jid: unknown, f: job.fence, execution_mode: 'offline_fixture', model_name: HISTORICAL_TEXT_MODEL, input_bound: 1000, output_bound: 3000, budget_ref: ref });
    expect(reserve.error).toBeNull();
    expect(reserve.data).toBeTruthy();
    sql(`UPDATE public.document_jobs SET lease_until=now()-interval '1 second' WHERE id='${unknown}'`);
    expect((await admin.rpc('ai_reconcile')).error).toBeNull();
    expect((await jobView(clients.other, admin, unknown)).state).toBe('outcome_unknown');
    expect((await runAIJob(admin, unknown, { ...d, execute })).status).toBe('idle');
    expect(execute).toHaveBeenCalledOnce();
});
it('daily aggregate limits apply across actors and definite provider failures stay distinct from uncertainty', async () => {
    const d = await allowance('offline-global-day-' + randomUUID(), ['patient', 'other'], ['answer_question'], { requests: 5, day: 1, actor: 2 });
    const a = await admit('haemoglobin', [otherDoc], 'other', otherThread);
    await runAIJob(admin, a, d);
    const b = await admit();
    const blocked = vi.fn(d.execute);
    await runAIJob(admin, b, { ...d, execute: blocked });
    expect(blocked).not.toHaveBeenCalled();
    expect((await jobView(clients.patient, admin, b)).state).toBe('exhausted');
    const failing = await allowance('offline-known-failure-' + randomUUID(), ['other'], ['answer_question'], { requests: 2 }), j = await admit('haemoglobin', [otherDoc], 'other', otherThread);
    const execute = vi.fn(async () => { throw new ProviderFailure('RATE_LIMITED', true); });
    expect((await runAIJob(admin, j, { ...failing, execute })).status).toBe('unavailable');
    const v = await jobView(clients.other, admin, j);
    expect(v.state).toBe('unavailable');
    expect(v.errorCode).toBe('RATE_LIMITED');
    expect((await admin.from('provider_attempts').select('state').eq('job_id', j)).data).toEqual([{ state: 'completed' }]);
    await runAIJob(admin, j, { ...failing, execute });
    expect(execute).toHaveBeenCalledOnce();
});
it('revocation before transmission and during a response prevents publication and future result reads', async () => {
    let changed = await changeDocument(clients.patient, docId, { action: 'share', key: randomUUID(), revision, providerId: actors.doctor.id, workspaceId: base.ids.workspaceA });
    revision = changed.revision;
    const parse = await admin.from('document_jobs').select('id').eq('document_id', docId).eq('kind', 'ingest_document').eq('input_revision', revision).single();
    expect(parse.error).toBeNull();
    await runDocumentJob(admin, parse.data!.id);
    const pre = await admit('haemoglobin', [docId], 'doctor', providerThread);
    proof.E07 = pre;
    changed = await changeDocument(clients.patient, docId, { action: 'revoke', key: randomUUID(), revision, providerId: actors.doctor.id, workspaceId: base.ids.workspaceA });
    revision = changed.revision;
    const execute = vi.fn(double().execute);
    await runAIJob(admin, pre, double(execute));
    expect(execute).not.toHaveBeenCalled();
    expect((await jobView(clients.doctor, admin, pre)).state).toBe('cancelled');
    changed = await changeDocument(clients.patient, docId, { action: 'share', key: randomUUID(), revision, providerId: actors.doctor.id, workspaceId: base.ids.workspaceA });
    revision = changed.revision;
    const p = await admin.from('document_jobs').select('id').eq('document_id', docId).eq('kind', 'ingest_document').eq('input_revision', revision).single();
    expect(p.error).toBeNull();
    await runDocumentJob(admin, p.data!.id);
    const during = await admit('haemoglobin', [docId], 'doctor', providerThread);
    await runAIJob(admin, during, double(async (input: ProviderInput) => { const c = JSON.parse(input.messages[1].content); const r = await changeDocument(clients.patient, docId, { action: 'revoke', key: randomUUID(), revision, providerId: actors.doctor.id, workspaceId: base.ids.workspaceA }); revision = r.revision; return { text: quoteReply(c.evidence), finishReason: 'stop' }; }));
    const view = await jobView(clients.doctor, admin, during);
    expect(view.state).toBe('cancelled');
    expect(view.result).toBeNull();
    expect(view.sources).toEqual([]);
    const raw = await clients.doctor.from('document_jobs').select('*').eq('id', during);
    expect(raw.error).toBeNull();
    expect(raw.data).toEqual([]);
});
it.each(cases)('versioned offline evaluation $id ($expected_state)', async (c) => {
    let actual = '';
    try {
        if (['E01', 'E02', 'E04', 'E05', 'E16'].includes(c.id)) {
            const doc = await upload('patient', c.source);
            const j = await admit(c.question, [doc.id]);
            const text = c.id === 'E05' ? 'HbA1c 6.2%.' : c.id === 'E04' ? 'v2 dated2026-10-20: weight68kg.' : c.source;
            const execute = vi.fn(async (input: ProviderInput) => { const context = JSON.parse(input.messages[1].content); return { text: quoteReply(context.evidence, text), finishReason: 'stop', usage: { input: 100, output: 100 } }; });
            expect((await runAIJob(admin, j, double(execute))).status).toBe('succeeded');
            const view = await jobView(clients.patient, admin, j);
            expect(view.resultKind).toBe('offline_fixture');
            for (const token of c.required_tokens)
                expect(view.result.answer).toContain(token);
            expect(view.result.answerKind).toBe('grounded');
            actual = 'grounded';
        }
        else if (c.id === 'E03') {
            const doc = await upload('patient', c.source), j = await admit(c.question, [doc.id]);
            await runAIJob(admin, j, double(async () => ({ text: JSON.stringify({ schemaVersion: '1', answerKind: 'insufficient_evidence', answer: 'Insufficient evidence in the selected sources.', facts: [], definitions: [], uncertainties: ['Numerical result absent.'], citedSourceIds: [] }), finishReason: 'stop' })));
            const v = await jobView(clients.patient, admin, j);
            expect(v.result.answerKind).toBe('insufficient_evidence');
            actual = 'insufficient_evidence';
        }
        else if (c.id === 'E06') {
            expect(proof.E06).toBe('denied');
            expect(denialCounts.after - denialCounts.before).toBe(0);
            actual = 'denied';
        }
        else if (['E07', 'E08', 'E10', 'E11'].includes(c.id)) {
            expect(proof[c.id]).toMatch(/^[a-f0-9-]{36}$/);
            if (c.id === 'E07') {
                const view = await jobView(clients.doctor, admin, proof[c.id]);
                expect(view.state).toBe('cancelled');
                actual = view.state;
            }
            else {
                expect(observed[c.id]).toBe(c.expected_state);
                const ledger = await admin.from('provider_attempts').select('state').eq('job_id', proof[c.id]).single();
                expect(ledger.error).toBeNull();
                expect(ledger.data!.state).toBe(c.id === 'E10' ? 'outcome_unknown' : 'completed');
                actual = observed[c.id];
            }
        }
        else if (c.id === 'E09') {
            const scan = new jsPDF();
            const uploaded = await uploadDocument(clients.patient, admin, { key: randomUUID(), title: 'Synthetic unreadable scan', fileName: 'scan.pdf', mime: 'application/pdf', bytes: new Uint8Array(scan.output('arraybuffer')) });
            const parse = await admin.from('document_jobs').select('id').eq('document_id', uploaded.document_id).eq('kind', 'ingest_document').single();
            expect(parse.error).toBeNull();
            expect((await runDocumentJob(admin, parse.data!.id)).status).toBe('needs_transcription');
            const j = await admit(c.question, [uploaded.document_id]);
            const execute = vi.fn(double().execute);
            await runAIJob(admin, j, double(execute));
            expect(execute).not.toHaveBeenCalled();
            expect((await jobView(clients.patient, admin, j)).resultKind).toBe('evidence_only');
            actual = 'needs_transcription';
        }
        else if (c.id === 'E12') {
            const queued = await admin.from('document_jobs').select('id').eq('document_id', docId).eq('kind', 'ingest_document').eq('input_revision', revision).single();
            expect(queued.error).toBeNull();
            await runDocumentJob(admin, queued.data!.id);
            const j = await admit();
            await runAIJob(admin, j, double(async (input: ProviderInput) => { const context = JSON.parse(input.messages[1].content); await uploadDocument(clients.patient, admin, { key: randomUUID(), title: 'Replacement synthetic source', fileName: 'new.txt', mime: 'text/plain', bytes: new TextEncoder().encode(source.replace('12.4', '13.1')), documentId: docId, revision }); return { text: quoteReply(context.evidence), finishReason: 'stop' }; }));
            const v = await jobView(clients.patient, admin, j);
            expect(v.state).toBe('stale');
            expect(v.result).toBeNull();
            actual = 'stale';
        }
        else if (c.id === 'E13' || c.id === 'E14') {
            if (c.id === 'E13')
                for (const [i, text] of ['Penicillin V potassium', '500 milligram', 'four times daily for ten days.'].entries()) {
                    const r = await clients.doctor.rpc('clinical_mutate', { k: randomUUID(), command: { action: 'transcript', consultationId: encounter, expectedRevision: i, segment: { id: randomUUID(), sequence: i, text, speaker: 'clinician', language: 'en', startMs: null, endMs: null } } });
                    expect(r.error).toBeNull();
                }
            if (c.id === 'E14') {
                const d = await clients.doctor.from('clinical_drafts').select('revision,extraction_cursor').eq('consultation_id', encounter).single();
                expect(d.error).toBeNull();expect(d.data!.extraction_cursor).toBe(2);
                const r = await clients.doctor.rpc('clinical_mutate', { k: randomUUID(), command: { action: 'transcript', consultationId: encounter, expectedRevision: d.data!.revision, segment: { id: randomUUID(), sequence: 3, text: 'Penicillin V potassium 500 milligram four times daily for ten days.', speaker: 'clinician', language: 'en', startMs: null, endMs: null } } });
                expect(r.error).toBeNull();
            }
            const j = await admitAI(clients.doctor, randomUUID(), providerThread, { kind: 'extract_emr', question: 'Extract draft facts.' });
            const snap = await admin.from('document_jobs').select('input_snapshot').eq('id', j).single();expect(snap.error).toBeNull();
            expect(snap.data!.input_snapshot.sources.length).toBe(c.id === 'E14' ? 1 : 3);
            await expect(admitAI(clients.doctor, randomUUID(), providerThread, { kind: 'extract_emr', question: 'Concurrent extraction.' })).rejects.toMatchObject({code:'EXTRACTION_PENDING'});

            if (c.id === 'E14') {
                const d = await clients.doctor.from('clinical_drafts').select('revision,snapshot').eq('consultation_id', encounter).single();
                expect(d.error).toBeNull();
                const snapshot = structuredClone(d.data!.snapshot);
                snapshot.chief_complaint = 'Synthetic clinician correction';
                snapshot.medications = [{ id: randomUUID(), name: 'Penicillin V potassium', dose: '1.25 mg', frequency: 'four times daily', duration: 'ten days', route: null, instructions: null, unknownFields: ['route'] }];
                const r = await clients.doctor.rpc('clinical_mutate', { k: randomUUID(), command: { action: 'save', consultationId: encounter, expectedRevision: d.data!.revision, snapshot } });
                expect(r.error).toBeNull();
            }
            const medId = randomUUID();
            await runAIJob(admin, j, double(async (input: ProviderInput) => { const context = JSON.parse(input.messages[1].content); return { text: JSON.stringify({ operations: [{ op: 'set_fact', path: 'medications', value: [{ id: medId, name: 'Penicillin V potassium', dose: '500 milligram', frequency: 'four times daily', duration: 'ten days', route: null, instructions: null, unknownFields: ['route'] }], evidence_segment_ids: context.evidence.map((e: Evidence) => e.segmentId) }] }), finishReason: 'stop' }; }));
            const view = await jobView(clients.doctor, admin, j);
            expect(view.state).toBe('succeeded');
            expect(view.result.requiresReview).toBe(true);
            const p = await clients.doctor.from('clinical_proposals').select('state,operations').eq('id', view.result.proposalId).single();
            expect(p.error).toBeNull();
            expect(p.data!.state).toBe(c.id === 'E14' ? 'stale' : 'review_required');
            if (c.id === 'E14') {
                const d = await clients.doctor.from('clinical_drafts').select('snapshot').eq('consultation_id', encounter).single();
                expect(d.error).toBeNull();
                expect(d.data!.snapshot.medications[0].dose).toBe('1.25 mg');
            }
            expect((await clients.patient.from('prescriptions').select('*')).data).toEqual([]);
            actual = 'review_required';
        }
        else if (c.id === 'E15') {
            const j = await admit(c.question);
            const execute = vi.fn(double().execute);
            await runAIJob(admin, j, double(execute));
            expect(execute).not.toHaveBeenCalled();
            const v = await jobView(clients.patient, admin, j);
            expect(v.result.answerKind).toBe('insufficient_evidence');
            expect(v.result.reason).toBe('UNSUPPORTED_ADVICE');
            actual = 'insufficient_evidence';
        }
        else
            throw new Error('Unimplemented versioned evaluation case ' + c.id);
        expect(actual).toBe(c.expected_state);
        evaluation.push({ id: c.id, expected: c.expected_state, actual, passed: true });
    }
    catch (e) {
        evaluation.push({ id: c.id, expected: c.expected_state, actual: actual || 'failed', passed: false });
        throw e;
    }
});
it('a returning real Auth session reloads saved conversation state and deletion invalidates an accepted result', async () => {
    expect((await clients.patient.auth.signOut()).error).toBeNull();
    const x = make();
    expect((await x.client.auth.signInWithPassword({ email: actors.patient.email, password: actors.patient.password })).error).toBeNull();
    clients.patient = x.client;
    jars.patient = x.jar;
    const history = await threadView(x.client, threadId);
    expect(history.thread.id).toBe(threadId);
    expect(history.messages?.length).toBeGreaterThan(0);
    const doc = await upload('patient'), j = await admit('haemoglobin', [doc.id]);
    await runAIJob(admin, j, double());
    expect((await jobView(x.client, admin, j)).state).toBe('succeeded');
    await changeDocument(x.client, doc.id, { key: randomUUID(), action: 'delete', revision: doc.revision });
    const v = await jobView(x.client, admin, j);
    expect(v.state).toBe('stale');
    expect(v.result).toBeNull();
    expect(v.sources).toEqual([]);
    const raw = await admin.from('document_jobs').select('input_snapshot').eq('id', j).single();
    expect(raw.error).toBeNull();
    expect(raw.data!.input_snapshot.sources.every((s: Record<string, unknown>) => !Object.hasOwn(s, 'text') && s.redacted === true)).toBe(true);
});
it('rejects a malformed structured extraction before it can become a saved clinical proposal', async () => {
    await expect(admitAI(clients.doctor, randomUUID(), providerThread, { kind:'extract_emr', question:'No new source.' })).rejects.toMatchObject({code:'NO_NEW_TRANSCRIPT'});
    const d = await clients.doctor.from('clinical_drafts').select('revision').eq('consultation_id', encounter).single();expect(d.error).toBeNull();
    const segment = await clients.doctor.rpc('clinical_mutate', {k:randomUUID(),command:{action:'transcript',consultationId:encounter,expectedRevision:d.data!.revision,segment:{id:randomUUID(),sequence:4,text:'Synthetic final source.',speaker:'clinician',language:'en',startMs:null,endMs:null}}});expect(segment.error).toBeNull();
    const j = await admitAI(clients.doctor, randomUUID(), providerThread, { kind: 'extract_emr', question: 'Extract saved transcript facts.' });
    const before = await clients.doctor.from('clinical_drafts').select('snapshot').eq('consultation_id', encounter).single();
    expect(before.error).toBeNull();
    const result = await runAIJob(admin, j, double(async (input: ProviderInput) => { const c = JSON.parse(input.messages[1].content); return { text: JSON.stringify({ operations: [{ op: 'set_fact', path: 'chief_complaint', value: { unsafe: 'Penicillin' }, evidence_segment_ids: [c.evidence[0].segmentId] }] }), finishReason: 'stop' }; }));
    expect(result.status).toBe('rejected');
    expect((await clients.doctor.from('clinical_drafts').select('snapshot').eq('consultation_id', encounter).single()).data).toEqual(before.data);
});


it('raw provider receipts are service-only, bounded, immutable and separate from reviewed results',async()=>{
 const document=await upload('patient'),thread=await createThread(clients.patient,randomUUID(),null),j=await admit('haemoglobin',[document.id],'patient',thread),ref='raw-receipt-'+randomUUID();await allowance(ref,['patient'],['answer_question'],{requests:1});
 const claim=await admin.rpc('ai_claim',{p_id:j});expect(claim.error).toBeNull();const f=claim.data[0].fence;
 const reservation=await admin.rpc('ai_reserve',{jid:j,f,execution_mode:'offline_fixture',model_name:HISTORICAL_TEXT_MODEL,input_bound:100,output_bound:100,budget_ref:ref});expect(reservation.error).toBeNull();const aid=reservation.data;expect(aid).toBeTruthy();
 expect((await clients.patient.rpc('ai_retain_raw',{aid,raw:'synthetic raw response'})).error?.code).toBe('42501');expect((await admin.rpc('ai_retain_raw',{aid,raw:'x'.repeat(65537)})).error).not.toBeNull();
 expect((await admin.rpc('ai_retain_raw',{aid,raw:'synthetic raw response'})).data).toBe(true);expect((await admin.rpc('ai_retain_raw',{aid,raw:'replacement'})).data).toBe(false);
 const saved=await admin.from('provider_attempts').select('raw_response').eq('id',aid).single();expect(saved.error).toBeNull();expect(saved.data!.raw_response).toBe('synthetic raw response');expect((await clients.patient.from('provider_attempts').select('raw_response')).error?.code).toBe('42501');expect((await admin.rpc('ai_unknown',{jid:j,f})).error).toBeNull();
});
