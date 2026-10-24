"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {QueueVitals} from './QueueVitals';
import { RecordLayout } from '../documents/DocumentSurface';
import { accessDenied, readJsonResponse } from '@/lib/client/http-response';
import { careResponse } from '@/lib/client/workspace-response';
type Slot = {
    id: string;
    provider_name: string;
    starts_at: string;
    ends_at: string;
    time_zone: string;
    synthetic: boolean;
};
type Appointment = {
    id: string;
    provider_name: string;
    starts_at: string;
    time_zone: string;
    reason: string;
    status: string;
    revision: number;
};
type Entry = {
    id: string;
    patient_name: string;
    doctor_name: string;
    queue_number: number;
    status: string;
    revision: number;
    consultation_ref: string | null;
    vitals_recorded?:Record<string,{value:number;unit:string}>;
    vital_provenance?:{observedAt:string;recordedAt:string;correctionReason?:string}|null;
};
type View = {
    slots: Slot[];
    appointments: Appointment[];
    patients: {
        id: string;
        name: string;
        phone: string | null;
        unclaimed: boolean;
    }[];
    providers: {
        id: string;
        name: string;
    }[];
    queue: Entry[];
};
const empty: View = { slots: [], appointments: [], patients: [], providers: [], queue: [] };
async function api(path: string, init?: RequestInit) { const r = await fetch(path, { ...init, cache: 'no-store', signal: AbortSignal.any([AbortSignal.timeout(30000), ...(init?.signal ? [init.signal] : [])]) }); return (await readJsonResponse(r,b=>careResponse(b,!!init?.method))).data; }
function time(s: string, z: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: z }).format(new Date(s)); }
export function CareWorkspace({ role, memberships, fixture }: {
    role: string;
    memberships: {
        workspace_id: string;
        role: string;
        name?:string;
    }[];
    fixture?: View;
}) {
    const patient = role === 'patient';
    const [workspace, setWorkspace] = useState(memberships[0]?.workspace_id ?? ''), [data, setData] = useState<View>(fixture ?? empty), [loading, setLoading] = useState(!fixture), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [failed,setFailed]=useState(false), [expired, setExpired] = useState(false), [query, setQuery] = useState(''), [slot, setSlot] = useState(''), [reason, setReason] = useState(''), [reschedule, setReschedule] = useState<Appointment | null>(null), [name, setName] = useState(''), [phone, setPhone] = useState(''), [provider, setProvider] = useState(''), [selectedPatient, setSelectedPatient] = useState('');
    const pending = useRef<{
        key: string;
        body: unknown;
    } | null>(null), lock = useRef(false), generation = useRef(0), live=useRef(true), denied=useRef(false), readController=useRef<AbortController|null>(null);
    const hideAccess=useCallback((e:unknown)=>{if(!accessDenied(e))return;denied.current=true; ++generation.current;readController.current?.abort();pending.current=null;setExpired(true);setData(empty);setReason('');setName('');setPhone('');setSlot('');setReschedule(null);setSelectedPatient('');setProvider('');setQuery('');setNotice('');},[]);
    const load = useCallback(async () => { if(denied.current)return false;const seq = ++generation.current;readController.current?.abort();const controller=new AbortController();readController.current=controller; setLoading(true); try {
        const d = fixture ?? await api('/api/care?' + new URLSearchParams({ ...(workspace ? { workspace } : {}), q: query }),{signal:controller.signal});
        if (live.current && seq === generation.current) {
            setData(d);
            setFailed(false);
            setError('');
            return true;
        }
    }
    catch (e) {
        if (live.current && seq === generation.current) {
            setFailed(true);
            setError((e as Error).message);
            hideAccess(e);
        }
    }
    finally {
        if (live.current && seq === generation.current)
            setLoading(false);
    } return false; }, [workspace, query, fixture,hideAccess]);
    const invalidate=useCallback(()=>{++generation.current;readController.current?.abort();},[]);
    useEffect(() => { live.current=true; void load(); return ()=>{live.current=false;invalidate();}; }, [load,invalidate]);
    const send = async (body: unknown, retry = false) => { if (lock.current||!live.current||denied.current||pending.current&&!retry)
        return; if (fixture) {
        setError('Visual fixture: changes are disabled.');
        return;
    } lock.current = true; setBusy(true); setError(''); const seq=generation.current;const op = retry ? pending.current : { key: crypto.randomUUID(), body:structuredClone(body) }; if (!op) {
        lock.current = false;
        setBusy(false);
        return;
    } pending.current = op; try {
        const result = await api('/api/care', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': op.key }, body: JSON.stringify(op.body) });
        if(!live.current||seq!==generation.current)return;
        pending.current = null;
        setNotice('Committed to your account.');
        setReason('');
        setName('');
        setPhone('');
        setSlot('');
        setReschedule(null);
        const refreshed=await load();
        if (live.current && refreshed && result.consultationId && role === 'doctor')
            window.location.assign('/consultations?id=' + result.consultationId);
    }
    catch (e) {
        if(!live.current||seq!==generation.current)return;
        setError((e as Error).message);
        const status = (e as {
            status?: number;
        }).status;
        if (status && status < 500)
            pending.current = null;
        hideAccess(e);
    }
    finally {
        lock.current = false;
        if(live.current)setBusy(false);
    } };
    const disabled=busy||loading||failed||!!pending.current;
    if (expired)
        return <RecordLayout section="care"><h1>Sign in to continue</h1><p>Your session expired. Private appointment and intake details have been hidden.</p><Link href="/login">Sign in</Link></RecordLayout>;
    return <RecordLayout provider={!patient} reception={role === 'receptionist'} fixture={!!fixture} section="care"><div className="workspace-heading"><div><p className="eyebrow">Continuing care</p><h1>{patient ? 'Your appointments' : role === 'receptionist' ? 'Reception & intake' : 'Today’s clinic queue'}</h1><p className="muted">Synthetic clinic · bookings and in-app care only.</p></div><button className="quiet-button" disabled={busy || loading} onClick={() => void load()}>Refresh</button></div>
 {!patient && <label className="field-label">Workspace<select disabled={disabled} value={workspace} onChange={e => { setWorkspace(e.target.value); setSelectedPatient(''); setProvider(''); setName(''); setPhone(''); setData(empty); }}>{memberships.map(m => <option key={m.workspace_id} value={m.workspace_id}>{m.name??'Assigned clinic'}</option>)}</select></label>}
 {error && <div role="alert" className="record-error">{error}</div>}{notice && <p role="status">{notice}</p>}{pending.current && <p>Request outcome is unconfirmed. <button className="quiet-button" disabled={busy} onClick={() => void send(null, true)}>Reconcile by retrying the same operation</button></p>}{loading && <p role="status">Loading saved clinic state…</p>}{failed&&!expired&&<p>Saved state could not be refreshed. Actions are paused until a successful refresh; your input is retained.</p>}
 {patient ? <><section className="source-panel"><h2>{reschedule ? 'Choose a replacement slot' : 'Book a synthetic visit'}</h2><p>The clinic time zone is shown with each slot. A failed change keeps your original appointment.</p><label className="field-label">Available slot<select value={slot} onChange={e => setSlot(e.target.value)} disabled={disabled}><option value="">Select a saved slot</option>{data.slots.map(s => <option key={s.id} value={s.id}>{s.provider_name} · {time(s.starts_at, s.time_zone)} · {s.time_zone}</option>)}</select></label>{!data.slots.length && !loading && <p className="muted">No eligible future slots are available. Availability must be explicitly provisioned; refreshing does not create it.</p>}{!reschedule && <label className="field-label">Reason (optional)<textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)} disabled={disabled}/></label>}<button className="primary-button" disabled={!slot || disabled} onClick={() => void send(reschedule ? { action: 'reschedule', appointmentId: reschedule.id, expectedRevision: reschedule.revision, slotId: slot } : { action: 'book', slotId: slot, reason, type: 'general' })}>{busy ? 'Saving…' : reschedule ? 'Confirm reschedule' : 'Confirm synthetic booking'}</button>{reschedule && <button className="quiet-button" disabled={disabled} onClick={() => setReschedule(null)}>Keep original booking</button>}</section><h2>Saved appointments</h2>{!data.appointments.length && !loading && <p>No saved appointments.</p>}{data.appointments.map(a => <article className="document-row care-row" key={a.id}><div><h3>{a.provider_name}</h3><p>{time(a.starts_at, a.time_zone)} · {a.time_zone}</p><p>{a.status} · revision {a.revision}</p>{a.reason && <p>{a.reason}</p>}</div>{a.status === 'confirmed' && new Date(a.starts_at) > new Date() && <div><button className="quiet-button" disabled={disabled} onClick={() => { setReschedule(a); setSlot(''); setNotice('Choose a replacement above. Your original booking is still confirmed.'); }}>Reschedule</button><button className="quiet-button" disabled={disabled} onClick={() => void send({ action: 'cancel', appointmentId: a.id, expectedRevision: a.revision })}>Cancel booking</button></div>}</article>)}</> : <div className="care-operational">

 <section className="queue-panel"><h2>Today’s queue</h2>{!data.queue.length && !loading && <p>No scoped queue entries for today.</p>}{data.queue.map(e => <article className="document-row care-row" key={e.id}><div><p className="eyebrow">Queue {e.queue_number}</p><h3>{e.patient_name}</h3><p>{e.doctor_name} · {e.status} · revision {e.revision}</p>{e.status==='waiting'&&<QueueVitals key={e.id} queueId={e.id} revision={e.revision} workspace={workspace} measurements={e.vitals_recorded} provenance={e.vital_provenance} disabled={disabled} onSave={command=>void send(command)}/>}</div><div>{role === 'doctor' && e.status === 'waiting' && <button className="primary-button" disabled={disabled} onClick={() => void send({ action: 'start', workspaceId: workspace, queueId: e.id, expectedRevision: e.revision })}>Start consultation</button>}{role === 'doctor' && e.consultation_ref && <Link className="quiet-button" href={'/consultations?id=' + e.consultation_ref}>Open encounter</Link>}{role === 'receptionist' && e.status === 'waiting' && <><button className="quiet-button" disabled={disabled} onClick={() => void send({ action: 'cancel_queue', workspaceId: workspace, queueId: e.id, expectedRevision: e.revision })}>Cancel entry</button><button className="quiet-button" disabled={disabled} onClick={() => void send({ action: 'no_show', workspaceId: workspace, queueId: e.id, expectedRevision: e.revision })}>Mark no-show</button></>}</div></article>)}</section> {role === 'receptionist' && <section className="source-panel intake-panel"><h2>Scoped patient intake</h2><label className="field-label">Search this workspace<input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} disabled={disabled}/></label><label className="field-label">Assigned clinician<select disabled={disabled} value={provider} onChange={e => setProvider(e.target.value)}><option value="">Select clinician</option>{data.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field-label">Existing intake relationship<select disabled={disabled} value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}><option value="">Select scoped patient</option>{data.patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.unclaimed ? 'unclaimed' : 'linked account'}</option>)}</select></label><button className="quiet-button" disabled={!provider || !selectedPatient || disabled} onClick={() => void send({ action: 'enqueue', workspaceId: workspace, providerId: provider, patientId: selectedPatient })}>Add to queue</button><details><summary>Create separate unclaimed demographics</summary><p>A matching name or phone does not claim or merge an account. This creates a new unclaimed patient and scoped intake/care relationships.</p><label className="field-label">Patient name<input disabled={disabled} maxLength={120} value={name} onChange={e => setName(e.target.value)}/></label><label className="field-label">Phone (optional)<input disabled={disabled} maxLength={30} value={phone} onChange={e => setPhone(e.target.value)}/></label><button className="primary-button" disabled={!name.trim() || !provider || disabled} onClick={() => void send({ action: 'intake', workspaceId: workspace, providerId: provider, name, phone })}>Create unclaimed patient & queue entry</button></details></section>}</div>}
 </RecordLayout>;
}
