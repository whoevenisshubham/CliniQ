import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePrincipal } from '../auth/context';
import { HttpError } from '../http';
import { id } from '../documents/service';
function check(error: {
    message: string;
    code: string;
} | null) { if (!error)
    return; const map: Record<string, number> = { AUTH_REQUIRED: 401, NOT_FOUND: 404, IDEMPOTENCY_CONFLICT: 409, INVALID_COMMAND: 400, OPERATION_LIMIT: 429, CONTEXT_LIMIT: 422, EXTRACTION_PENDING: 409, NO_NEW_TRANSCRIPT: 422 }; if (map[error.message])
    throw new HttpError(map[error.message], error.message, error.message === 'CONTEXT_LIMIT' ? 'The saved transcript exceeds the bounded extraction context. Continue manual review.' : 'This request is unavailable or conflicts with its current state.'); throw new HttpError(503, 'AI_UNAVAILABLE', 'Evidence services are temporarily unavailable.'); }
export async function createThread(client: SupabaseClient, key: string, consultationId: string | null) { await resolvePrincipal(client); id(key); if (consultationId)
    id(consultationId); const r = await client.rpc('ai_thread_create', { k: key, cid: consultationId }); check(r.error); return r.data as string; }
export async function admitAI(client: SupabaseClient, key: string, threadId: string, input: unknown) {
    await resolvePrincipal(client);
    id(key);
    id(threadId);
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new HttpError(400, 'INVALID_COMMAND', 'A bounded evidence request is required.');
    const b = input as Record<string, unknown>;
    if (Object.keys(b).some(k => !['kind', 'question', 'documentIds', 'approvedVersionIds'].includes(k)) || !['answer_question', 'explain_document', 'extract_emr'].includes(String(b.kind)) || typeof b.question !== 'string' || b.question.trim().length < 2 || b.question.length > 500)
        throw new HttpError(400, 'INVALID_COMMAND', 'Check the question and source selection.');
    const ids = (v: unknown) => { if (v === undefined)
        return []; if (!Array.isArray(v) || v.length > 6)
        throw new HttpError(400, 'INVALID_COMMAND', 'Choose at most six sources.'); return v.map(id); };
    const r = await client.rpc('ai_admit', { k: key, tid: threadId, job_kind: b.kind, q: b.question, documents: ids(b.documentIds), versions: ids(b.approvedVersionIds) });
    check(r.error);
    return r.data as string;
}
export async function threadView(client: SupabaseClient, threadId: string, admin?: SupabaseClient) {
    const actor = await resolvePrincipal(client);
    id(threadId);
    const t = await client.from('ai_threads').select('id,patient_id,consultation_id,created_at').eq('id', threadId).maybeSingle();
    check(t.error);
    if (!t.data)
        throw new HttpError(404, 'NOT_FOUND', 'Conversation unavailable.');
    const metadata = admin ? await admin.from('document_jobs').select('id,kind,status,error_code,created_at').eq('thread_id', threadId).eq('actor_id', actor.id).order('created_at', { ascending: false }).limit(30) : null;
    if (metadata)
        check(metadata.error);
    let query = client.from('document_jobs').select('id,kind,status,error_code,request,result,result_kind,source_hash,input_snapshot,created_at').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(30);
    if (metadata?.data?.length)
        query = query.in('id', metadata.data.map(r => r.id));
    const j = await query;
    check(j.error);
    const fresh = j.data?.length ? await client.from('document_jobs').select('id').in('id', j.data.map(r => r.id)) : { data: [], error: null };
    check(fresh.error);
    const allowed = new Set(fresh.data?.map(r => r.id));
    const visible = new Map((j.data ?? []).filter(r => allowed.has(r.id)).map(r => [r.id, r] as const));
    const choices = await client.rpc('ai_source_choices', { tid: threadId });
    check(choices.error);
    const rows = metadata?.data ?? j.data ?? [];
    return { thread: t.data, availableSources: choices.data, messages: rows.map(m => { const r = visible.get(m.id); return r ? { id: r.id, kind: r.kind, state: r.status, errorCode: r.error_code, question: r.request.question, result: r.result, resultKind: r.result_kind, sourceHash: r.source_hash, sources: r.input_snapshot.sources, createdAt: r.created_at } : { id: m.id, kind: m.kind, state: m.status === 'cancelled' ? 'cancelled' : 'stale', errorCode: 'SOURCE_STALE', question: 'Source access changed', result: null, resultKind: null, sources: [], createdAt: m.created_at }; }).reverse() };
}
export async function jobView(client: SupabaseClient, admin: SupabaseClient, jobId: string) {
    const p = await resolvePrincipal(client);
    id(jobId);
    // Caller RLS determines source availability. A separate minimal owner lookup
    // can report stale/cancelled status without revealing revoked text/results.
    const owned = await admin.from('document_jobs').select('id,actor_id,thread_id,status,error_code').eq('id', jobId).eq('actor_id', p.id).maybeSingle();
    check(owned.error);
    if (!owned.data?.thread_id)
        throw new HttpError(404, 'NOT_FOUND', 'Job unavailable.');
    const r = await client.from('document_jobs').select('id,kind,status,result,result_kind,error_code,input_snapshot,source_hash,result_model,result_provider,execution_mode,prompt_version,retrieval_version,schema_version').eq('id', jobId).maybeSingle();
    check(r.error);
    if (!r.data)
        return { id: jobId, state: owned.data.status === 'cancelled' ? 'cancelled' : 'stale', errorCode: owned.data.status === 'cancelled' ? 'ACCESS_REVOKED' : 'SOURCE_STALE', result: null, sources: [] };
    const current = await client.from('document_jobs').select('id').eq('id', jobId).maybeSingle();
    check(current.error);
    if (!current.data)
        return { id: jobId, state: 'stale', errorCode: 'SOURCE_STALE', result: null, sources: [] };
    return { id: jobId, kind: r.data.kind, state: r.data.status, result: r.data.result, resultKind: r.data.result_kind, errorCode: r.data.error_code, sources: r.data.input_snapshot.sources, sourceHash: r.data.source_hash, provenance: { model: r.data.result_model, provider: r.data.result_provider, executionMode: r.data.execution_mode, promptVersion: r.data.prompt_version, retrievalVersion: r.data.retrieval_version, schemaVersion: r.data.schema_version } };
}
