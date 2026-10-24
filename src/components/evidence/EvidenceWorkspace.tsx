"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {SupportedAnswer} from './SupportedAnswer';
import { RecordLayout } from '../documents/DocumentSurface';
import type { Evidence, GroundedAnswer } from '@/lib/contracts/ai';
import {accessDenied,readJsonResponse} from '@/lib/client/http-response';
import {evidenceResponse} from '@/lib/client/workspace-response';
type Message = {
    id: string;
    kind: string;
    state: string;
    question: string;
    result: GroundedAnswer | {
        reason?: string;
        proposalId?: string;
        requiresReview?: boolean;
    } | null;
    resultKind: string | null;
    sources: Evidence[];
    sourceHash?: string;
    errorCode?: string;
    createdAt?: string;
};
type Thread = {
    id: string;
    consultation_id: string | null;
    created_at: string;
};
async function serverApi(path: string, init?: RequestInit) { const r = await fetch(path, { ...init, cache: 'no-store', signal: AbortSignal.any([AbortSignal.timeout(30000),...(init?.signal?[init.signal]:[])]) });return (await readJsonResponse(r,b=>evidenceResponse(b,path,!!init?.method))).data; }
const labels: Record<string, string> = { queued: 'Queued', running: 'Processing', succeeded: 'Saved result', unavailable: 'Generation unavailable', rejected: 'Output rejected', exhausted: 'Allowance exhausted', outcome_unknown: 'Provider outcome unknown', stale: 'Source changed', cancelled: 'Access revoked', failed: 'Processing failed' };
export function EvidenceWorkspace({ actorId, provider, initialThread = null, consultationId = null, initialDocumentId = null, fixture }: {
    actorId: string;
    provider: boolean;
    initialThread?: string | null;
    consultationId?: string | null;
    initialDocumentId?: string | null;
    fixture?: {
        thread: Thread;
        messages: Message[];
        documents: {
            id: string;
            title: string;
        }[];
    };
}) {
    const api = useCallback(async (path: string, init?: RequestInit) => { if (!fixture)
        return serverApi(path, init); if (init?.method)
        throw Object.assign(new Error('Visual fixture only: no question, proposal or explanation is generated or saved.'), { status: 409 }); if (path === '/api/ai/threads')
        return [fixture.thread]; return { thread: fixture.thread, messages: fixture.messages, availableSources: { documents: fixture.documents } }; }, [fixture]);
    const [threads, setThreads] = useState<Thread[]>([]), [thread, setThread] = useState<Thread | null>(null), [selected, setSelected] = useState<string | null>(initialThread), [messages, setMessages] = useState<Message[]>([]), [question, setQuestion] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [documents, setDocuments] = useState<{
        id: string;
        title: string;
    }[]>([]), [documentId, setDocumentId] = useState(initialDocumentId ?? ''), [kind, setKind] = useState('answer_question');
    const [active, setActive] = useState<string | null>(null), [expired, setExpired] = useState(false);
    const pending = useRef<{
        path: string;
        body: unknown;
        key: string;
    } | null>(null), serial = useRef(0), context=useRef(0),denied=useRef(false),reads=useRef<AbortController|null>(null), busyRef = useRef(false), live = useRef(true);
    const hideAccess=useCallback((e:unknown)=>{if(!accessDenied(e))return;denied.current=true;++serial.current;++context.current;reads.current?.abort();pending.current=null;setThreads([]);setThread(null);setMessages([]);setDocuments([]);setQuestion('');setDocumentId('');setActive(null);setExpired(true);},[]);
    const load = async () => { if(denied.current)return;const seq = ++serial.current;reads.current?.abort();const c=new AbortController();reads.current=c;setLoading(true);try {
        const list = await api('/api/ai/threads',{signal:c.signal});
        if (!live.current || seq !== serial.current)
            return;
        setThreads(list);
        if (selected) {
            const d = await api('/api/ai/threads/' + selected,{signal:c.signal});
            if (!live.current || seq !== serial.current)
                return;
            setThread(d.thread);
            setMessages(d.messages);
            setDocuments(d.availableSources?.documents ?? []);
            const waiting = d.messages.findLast((m: Message) => ['queued', 'running'].includes(m.state));
            setActive(waiting?.id ?? null);
        }
        else {
            setDocuments([]);
        }
    }
    catch (e) {
        if (live.current && seq===serial.current) {
            setError(e instanceof Error ? e.message : 'Unable to load source review.');
            hideAccess(e);
        }
    }
    finally {
        if (live.current && seq===serial.current)
            setLoading(false);
    } };
    const loadRef = useRef(load);
    loadRef.current = load;
    const invalidate=useCallback(()=>{++serial.current;++context.current;reads.current?.abort();},[]);
    useEffect(() => { live.current = true; void loadRef.current(); return () => { live.current = false;invalidate(); }; }, [selected, actorId,invalidate]);
    useEffect(() => { const focus = () => { if (!busyRef.current)
        void loadRef.current(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, []);
    useEffect(() => {
        if (!active)
            return;
        let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
        const generation=context.current,controller=new AbortController();
        const started = Date.now();
        let n = 0;
        const poll = async () => { if (stopped || !live.current || denied.current || generation!==context.current || document.hidden || Date.now() - started > 60000)
            return; try {
            const v = await api('/api/jobs/' + active,{signal:controller.signal});
            if (stopped || !live.current || generation!==context.current || denied.current)
                return;
            setMessages(old => old.map(m => m.id === active ? { ...m, state: v.state, result: v.result, resultKind: v.resultKind, sources: v.sources, sourceHash: v.sourceHash, errorCode: v.errorCode } : m));
            if (!['queued', 'running'].includes(v.state)) {
                setActive(null);
                return;
            }
        }
        catch (e) {
            if (!stopped && live.current && generation===context.current) {
                setError(e instanceof Error ? e.message : 'Job state unavailable.');
                hideAccess(e);
            }
        } timer = setTimeout(poll, n++ < 2 ? 2000 : n < 5 ? 5000 : 10000); };
        const visibility = () => { if (!document.hidden)
            void poll(); };
        document.addEventListener('visibilitychange', visibility);
        timer = setTimeout(poll, 2000);
        return () => { stopped = true;controller.abort(); if (timer)
            clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
    }, [active, api,selected,actorId,hideAccess]);
    async function send(path: string, body: unknown, retry = false) {
        if (!live.current||denied.current||busyRef.current || pending.current && !retry)
            return;
        busyRef.current = true;
        setBusy(true);
        setError('');
        const generation=context.current;
        const op = retry && pending.current ? pending.current : { path, body:structuredClone(body), key: crypto.randomUUID() };
        pending.current = op;
        try {
            const data = await api(op.path, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': op.key }, body: JSON.stringify(op.body) });
            if(!live.current||generation!==context.current)return;
            pending.current = null;
            if (data.threadId) {
                setQuestion('');
                window.history.replaceState(null, '', '/evidence?thread=' + data.threadId);
                setSelected(data.threadId);
            }
            else {
                setQuestion('');
                setActive(data.jobId);
                await loadRef.current();
            }
        }
        catch (e) {
            if(!live.current||generation!==context.current)return;
            setError(e instanceof Error ? e.message : 'Request failed.');
            const status = (e as {
                status?: number;
            }).status;
            if (status && status < 500)
                pending.current = null;
            hideAccess(e);
        }
        finally {
            busyRef.current = false;
            if(live.current)setBusy(false);
        }
    }
    const sources = [...new Map(messages.flatMap(m => m.sources ?? []).map(s => [s.evidenceId, s])).values()];
    return <RecordLayout provider={provider} fixture={!!fixture} section="evidence"><p className="eyebrow">Source review</p><h1 className="clinical-title">Keep the evidence beside the answer.</h1><p className="section-intro">Review private document text and approved records with their source references. External generation is disabled by default. Evidence-only views and offline test output are labelled separately.</p>
  {error && <div className="clinical-error" role="alert"><p>{error}</p>{pending.current && <button className="quiet-button" disabled={busy} onClick={() => void send(pending.current!.path, pending.current!.body, true)}>Retry the same request</button>}</div>}
  {expired ? <Link href="/login">Sign in again to view private evidence</Link> : <>
   <div className="clinical-toolbar"><label>Saved conversation<select className="evidence-select" value={selected ?? ''} disabled={busy || !!pending.current} onChange={e => { if (question.trim() && !window.confirm('Discard the unsent question before changing patient context?'))
            return; serial.current++; setSelected(e.target.value || null); setMessages([]); setThread(null); setQuestion(''); setDocumentId(''); setKind('answer_question'); }}><option value="">Choose a conversation</option>{threads.map(t => <option key={t.id} value={t.id}>{new Date(t.created_at).toLocaleString()} · {t.id.slice(0, 8)}</option>)}</select></label><button className="quiet-button" disabled={busy || !!pending.current || provider && !consultationId && !thread?.consultation_id} onClick={() => { if (question.trim() && !window.confirm('Discard the unsent question before starting a new review?'))
            return; void send('/api/ai/threads', { consultationId: provider ? thread?.consultation_id ?? consultationId ?? null : null }); }}>New source review</button><button className="quiet-button" disabled={busy} onClick={() => void loadRef.current()}>Refresh saved state</button></div>
   {loading ? <p role="status">Loading saved evidence…</p> : !selected ? <div className="empty-records"><h2>Start with a source.</h2><p>{provider && !consultationId ? 'Open an authorized consultation, then choose its source-review link.' : 'Create a private conversation. No provider call occurs without an explicit active allowance.'}</p><Link href={provider ? '/consultations' : '/records'}>{provider ? 'Open consultations' : 'Open private records'}</Link></div> : <div className="evidence-columns"><section aria-label="Conversation and processing state">
    {messages.length ? messages.map(m => <article className="evidence-message" key={m.id}><p className="eyebrow">{labels[m.state] ?? m.state} · {m.resultKind === 'offline_fixture' ? 'Synthetic provider double · no live AI' : m.resultKind === 'evidence_only' ? 'Source evidence only' : m.resultKind === 'generated' && m.state === 'succeeded' ? 'Saved supported excerpts · cached' : 'No accepted generated output'}</p><h2>{m.question}</h2>{m.state === 'succeeded' && m.result && 'answer' in m.result ? <SupportedAnswer result={m.result}/> : <p className="clinical-muted">{m.state === 'outcome_unknown' ? 'The processing outcome is uncertain. This request will not be repeated automatically.' : m.state === 'exhausted' ? 'Generation is unavailable for this request. You can still review the source.' : m.state === 'cancelled' || m.state === 'stale' ? 'The source changed or access ended. Previous content is unavailable.' : m.state === 'rejected' ? 'The response failed source/schema/fidelity checks. No accepted answer was saved.' : m.state === 'queued' || m.state === 'running' ? 'Durable work is pending. You may leave and return; this page does not cancel server work.' : 'No generated answer is available. Read the original source or continue manual review.'}</p>}
     {m.result && 'proposalId' in m.result && thread?.consultation_id && <Link className="text-link" href={'/consultations?id=' + thread.consultation_id}>Review the saved proposal in its consultation ↗</Link>}
     <small>Saved request {m.id.slice(0, 8)}{m.sourceHash ? ' · snapshot ' + m.sourceHash.slice(0, 12) : ''}</small></article>) : <p className="clinical-muted">No saved questions yet. Source selection is checked on the server.</p>}
    <form className="evidence-compose" onSubmit={e => { e.preventDefault(); void send('/api/ai/threads/' + selected, { kind, question, documentIds: kind === 'extract_emr' ? [] : documentId ? [documentId] : [] }); }}>
     <label className="clinical-field">Source scope<select className="evidence-select" value={documentId} disabled={busy || !!pending.current || kind === 'extract_emr'} onChange={e => setDocumentId(e.target.value)}><option value="">Current authorized sources for this patient</option>{documentId && !documents.some(d => d.id === documentId) && <option value={documentId}>Selected source unavailable · choose another source</option>}{documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
     <label className="clinical-field">Request type<select className="evidence-select" disabled={busy || !!pending.current} value={kind} onChange={e => setKind(e.target.value)}><option value="answer_question">Question about the sources</option><option value="explain_document">Source excerpts & definitions</option>{provider && thread?.consultation_id && <option value="extract_emr">Transcript-to-draft suggestion</option>}</select></label>
     <label className="clinical-field">Question<textarea required rows={3} minLength={2} maxLength={500} value={question} disabled={busy || !!pending.current} onChange={e => setQuestion(e.target.value)}/></label><button className="primary-button" disabled={busy || !!pending.current || !!documentId && !documents.some(d => d.id === documentId) && kind !== 'extract_emr'}>{busy ? 'Saving request…' : 'Save source request'}</button><p className="clinical-muted">Generation may be unavailable. A queued request is not a completed answer. Suggestions require clinician review and never approve a record.</p>
    </form>
   </section><aside aria-label="Authorized source evidence" className="evidence-sources"><p className="eyebrow">Evidence drawer</p><h2>Source text & provenance</h2>{sources.length ? sources.map(s => <article key={s.evidenceId} id={'evidence-' + s.evidenceId} tabIndex={-1}><h3>{s.title ?? (s.sourceType === 'transcript' ? 'Saved transcript' : 'Approved record')}</h3><p className="clinical-muted">{s.sourceType === 'manual_transcript' ? 'Patient-entered transcript' : s.sourceType.replaceAll('_', ' ')}{s.page ? ' · page ' + s.page : ''} · version {s.versionId.slice(0, 8)}</p><blockquote>{s.text}</blockquote>{s.documentId ? <Link href={'/records?document=' + s.documentId + '#source-' + s.chunkId}>Open private source ↗</Link> : s.sourceType === 'approved_emr' ? <Link href={'/api/clinical/approved/' + s.versionId} target="_blank">Open approved version ↗</Link> : thread?.consultation_id ? <Link href={'/consultations?id=' + thread.consultation_id + '#segment-' + s.segmentId}>Open transcript segment ↗</Link> : null}</article>) : <p>No currently authorized matching source text is available.</p>}</aside></div>}
  </>}
 </RecordLayout>;
}
