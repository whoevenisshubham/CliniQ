"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { RecordLayout } from "../documents/DocumentSurface";
import {SpeechCapture} from './SpeechCapture';
import { emptySnapshot, type ClinicalSnapshot, type Medication, type SavedSegment } from "@/lib/contracts/clinical";
type Approved = {
    id: string;
    consultation_id: string;
    snapshot: ClinicalSnapshot;
    reviewed_at: string;
    source_revision: number;
    amended_from_id: string | null;
};
type Visit = {
    id: string;
    patient_id: string;
    workspace_id: string;
    status: string;
    revision: number;
    started_at: string;
};
export type ClinicalDetail = {
    visit: Visit;
    draft: {
        snapshot: ClinicalSnapshot;
        revision: number;
        provenance: Record<string, unknown>;
    };
    segments: (SavedSegment & {
        source_type: string;
        speech_provenance?:{mode?:string};
    })[];
    patient: {
        id: string;
        name: string;
        allergies: string[];
    };
    approved: Approved[];
    history: Approved[];
    documents: {
        id: string;
        title: string;
        current_version_id: string;
        created_at: string;
    }[];
    proposals?: {
        id: string;
        base_revision: number;
        operations: {
            op: string;
            path: string;
            value?: unknown;
            evidence_segment_ids: string[];
            note?: string;
        }[];
        source_snapshot: {
            id: string;
            text: string;
            speaker: string;
            language: string;
        }[];
        result_kind: string;
        state: string;
        created_at: string;
    }[];
    prescriptions: {
        id: string;
        medication_name: string;
        dosage: string | null;
        prescribed_at: string;
    }[];
};
type Listing = {
    role: string;
    visits?: Visit[];
    patients?: {
        id: string;
        name: string;
    }[];
    care?: {
        patient_id: string;
        workspace_id: string;
    }[];
    approved?: Approved[];
};
class RequestError extends Error {
    constructor(message: string, public status: number) { super(message); }
}
async function api(path: string, init?: RequestInit) {
    const r = await fetch(path, { ...init, cache: "no-store", signal: AbortSignal.timeout(30000) });
    const b = await r.json();
    if (!r.ok)
        throw new RequestError(b.error?.message ?? "The request failed.", r.status);
    return b.data;
}
// The manual findings/transcript/review vocabulary is retained from CliniQ's
// ActiveConsultationClient/LiveTranscriptPanel. Authoritative orchestration is
// separate from their legacy inference timers and multi-request finalization.
export function ConsultationReview({ actorId, provider, initialId = null, fixture }: {
    actorId: string;
    provider: boolean;
    initialId?: string | null;
    fixture?: ClinicalDetail;
}) {
    const [listing, setListing] = useState<Listing | null>(null), [selected, setSelected] = useState<string | null>(initialId), [detail, setDetail] = useState<ClinicalDetail | null>(fixture ?? null);
    const [snapshot, setSnapshot] = useState<ClinicalSnapshot>(fixture?.draft.snapshot ?? emptySnapshot()), [transcript, setTranscript] = useState("");
    const [speaker, setSpeaker] = useState<SavedSegment["speaker"]>("unknown"), [language, setLanguage] = useState<SavedSegment["language"]>("unknown");
    const [status, setStatus] = useState(fixture ? "visual fixture" : "loading"), [error, setError] = useState(""), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [review, setReview] = useState(false), [confirmed, setConfirmed] = useState(false), [reasons, setReasons] = useState<Record<string, string>>({});
    const [patientChoice, setPatientChoice] = useState("");
    const [contextOpen, setContextOpen] = useState(false);
    const [captureBusy,setCaptureBusy]=useState(false);

    const pending = useRef<{
        key: string;
        command: unknown;
        path?: string;
    } | null>(null), epoch = useRef(0), dirtyRef = useRef(false);
    dirtyRef.current = dirty;
    const mounted = useRef(true);
    const reviewButtonRef = useRef<HTMLButtonElement>(null);
    const transcriptRef = useRef(transcript);
    transcriptRef.current = transcript;
    const load = useCallback(async (id: string | null, replace = false) => {
        const token = ++epoch.current;
        try {
            if (fixture) {
                setDetail(fixture);
                setStatus("visual fixture");
                return;
            }
            const data = id ? await api(`/api/clinical/${id}`) : await api("/api/clinical");
            if (!mounted.current || token !== epoch.current)
                return;
            if (id) {
                if (dirtyRef.current && !replace) {
                    if (data.visit.revision !== detail?.visit.revision) {
                        setStatus("conflicted");
                        setError("This encounter changed in another session. Your unsaved input is retained; review it before reloading.");
                    }
                    return;
                }
                if (data.visit.revision !== detail?.visit.revision) {
                    setConfirmed(false);
                    setReasons({});
                }
                setDetail(data);
                setSnapshot(data.draft.snapshot);
                setDirty(false);
                setStatus(data.visit.status === "completed" ? "approved" : "saved");
            }
            else {
                setListing(data);
                setStatus("ready");
            }
        }
        catch (e) {
            if (token !== epoch.current)
                return;
            setError(e instanceof Error ? e.message : "Unable to load consultation.");
            setStatus(e instanceof RequestError && e.status === 401 ? "session expired" : "failed");
        }
    }, [fixture, detail?.visit.revision]);
    const loadRef = useRef(load);
    loadRef.current = load;
    useEffect(() => { mounted.current = true; void loadRef.current(selected); return () => { mounted.current = false; }; }, [selected, actorId]);
    useEffect(() => {
        const focus = () => {
            if (!busy && !pending.current)
                void loadRef.current(selected);
        };
        const before = (e: BeforeUnloadEvent) => {
            if (dirtyRef.current || transcriptRef.current.trim() || pending.current) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("focus", focus);
        window.addEventListener("beforeunload", before);
        return () => { window.removeEventListener("focus", focus); window.removeEventListener("beforeunload", before); };
    }, [selected, busy]);
    function edit(next: ClinicalSnapshot) { setSnapshot(next); setDirty(true); setStatus("unsaved"); setConfirmed(false); }
    async function commit(command: unknown, retry = false, path = "/api/clinical") {
        if (busy || pending.current && !retry)
            return;
        setBusy(true);
        setError("");
        setStatus("saving");
        const operation = retry && pending.current ? pending.current : { key: crypto.randomUUID(), command, path };
        pending.current = operation;
        try {
            if (fixture)
                throw new Error("Visual fixture only. Changes are not persisted.");
            const committed = retry ? await api("/api/clinical/operations/" + operation.key) : null;
            const result = committed ?? await api(operation.path ?? "/api/clinical", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": operation.key }, body: JSON.stringify(operation.command) });
            pending.current = null;
            setDirty(false);
            dirtyRef.current = false;
            setTranscript("");
            setReview(false);
            setConfirmed(false);
            setReasons({});
            if (result.consultationId !== selected) {
                window.history.replaceState(null, "", `/consultations?id=${result.consultationId}`);
                setSelected(result.consultationId);
            }
            else
                await loadRef.current(selected, true);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : "Save failed.";
            setError(message);
            setStatus(e instanceof RequestError && e.status === 409 ? "conflicted" : e instanceof RequestError && e.status === 401 ? "session expired" : "failed");
            // Known rejected requests did not commit. Ambiguous transport failures keep
            // the exact request/key; only retry/reconcile is allowed until resolved.
            if (e instanceof RequestError && e.status < 500 || fixture)
                pending.current = null;
        }
        finally {
            setBusy(false);
        }
    }
    const locked = busy || captureBusy || status === "session expired" || !!pending.current;
    const active = detail?.visit.status === "active";
    const notices = [...snapshot.medications.flatMap(m => [...m.unknownFields.map(f => ({ key: `${m.id}:${f}`, text: `${m.name}: ${f} is explicitly unknown.` })), ...(detail?.patient.allergies.some(a => a.trim().toLowerCase() === m.name.trim().toLowerCase()) ? [{ key: `allergy:${m.id}`, text: `${m.name} exactly matches a saved allergy label. Review the source facts.` }] : [])]), ...Array.from(new Set(snapshot.vitals.map(v => v.name))).filter(name => new Set(snapshot.vitals.filter(v => v.name === name).map(v => v.unit)).size > 1).map(name => ({ key: `unit:${name}`, text: `${name} has conflicting recorded units. Review original values.` }))];
    const labelled = (name: keyof Pick<ClinicalSnapshot, "chief_complaint" | "physical_examination" | "clinical_summary">, label: string) => <label className="clinical-field">{label}<textarea rows={3} maxLength={8000} value={snapshot[name] ?? ""} disabled={!active || locked} onChange={e => edit({ ...snapshot, [name]: e.target.value || null })}/></label>;
    function updateMed(index: number, partial: Partial<Medication>) { edit({ ...snapshot, medications: snapshot.medications.map((m, i) => i === index ? { ...m, ...partial } : m) }); }
    const saveFindings=()=>{if(!detail)return;const cleaned={...snapshot,symptoms:snapshot.symptoms.filter(x=>x.trim()),diagnosis:snapshot.diagnosis.filter(x=>x.trim()),lab_tests_ordered:snapshot.lab_tests_ordered.filter(x=>x.trim())};void commit({action:'save',consultationId:detail.visit.id,expectedRevision:detail.visit.revision,snapshot:cleaned});};
    const openReview=(button:HTMLButtonElement)=>{reviewButtonRef.current=button;setConfirmed(false);setReview(true);};
    return <RecordLayout provider={provider} fixture={!!fixture} section="consultations">
  <div className="clinical-topline"><p className="eyebrow">{provider ? "Consultation & review" : "Approved care history"}</p><span role="status" className="record-state">{busy ? "Saving…" : status}</span></div>
  <h1 className="clinical-title">{detail ? detail.patient.name : provider ? "The conversation, kept in context." : "Your approved visit records."}</h1>
  {!detail && <p className="section-intro">{provider ? "Keep the conversation beside your findings. Save a draft, review it, and approve a lasting record." : "Only clinician-approved versions appear here. Earlier versions remain visible when a correction is issued."}</p>}
  {error && <div className="clinical-error" role="alert"><p>{error}</p>{pending.current && <button className="quiet-button" disabled={busy} onClick={() => void commit(pending.current!.command, true)}>Retry / reconcile the same operation</button>}{status === "session expired" && <Link href="/login">Sign in again</Link>}</div>}
  {!detail && !provider && <div className="clinical-history">{listing?.approved?.length ? listing.approved.map(a => <ApprovedRecord key={a.id} record={a}/>) : <p>{status === "loading" ? "Loading approved history…" : "No approved visit records yet."}</p>}</div>}
  {!detail && provider && <>
   <form className="clinical-start" onSubmit={e => {
                e.preventDefault();
                const care = listing?.care?.find(c => `${c.patient_id}:${c.workspace_id}` === patientChoice);
                if (care)
                    void commit({ action: "create", patientId: care.patient_id, workspaceId: care.workspace_id });
            }}>
    <label>Assigned patient<select required value={patientChoice} disabled={locked} onChange={e => setPatientChoice(e.target.value)}><option value="">Choose a patient</option>{listing?.care?.map(c => <option key={`${c.patient_id}:${c.workspace_id}`} value={`${c.patient_id}:${c.workspace_id}`}>{listing.patients?.find(p => p.id === c.patient_id)?.name ?? "Assigned patient"} · {c.workspace_id.slice(0, 8)}</option>)}</select></label><button className="primary-button" disabled={locked || !patientChoice}>Start consultation</button>
   </form>
   <div className="clinical-history">{listing?.visits?.map(v => <Link className="clinical-visit" href={`/consultations?id=${v.id}`} key={v.id}><span>{listing.patients?.find(p => p.id === v.patient_id)?.name ?? "Assigned patient"}<small>{new Date(v.started_at).toLocaleString()} · {v.id.slice(0, 8)}</small></span><span>{v.status} · revision {v.revision}</span></Link>)}{listing && !listing.visits?.length && <p>No consultations yet.</p>}</div>
  </>}
  {detail && <>
   <div className="clinical-primary-strip"><p><strong>{detail.visit.status}</strong> · {dirty?'Unsaved findings':transcript.trim()?'Unsaved transcript':status} · revision {detail.visit.revision}<br/><span>Allergies: {detail.patient.allergies.length?detail.patient.allergies.join(', '):'none recorded; verify with patient'}</span></p>{active&&<div><button className="quiet-button" disabled={locked||!dirty} onClick={saveFindings}>Save findings</button><button className="primary-button" disabled={locked||dirty||!!transcript.trim()} onClick={e=>openReview(e.currentTarget)}>Review saved draft</button></div>}</div>
   <div className="clinical-toolbar"><Link href="/consultations">All consultations</Link><Link href={"/evidence?consultation=" + detail.visit.id}>Review source evidence</Link><span>Encounter {detail.visit.id.slice(0, 8)} · saved revision {detail.visit.revision}</span><button className="quiet-button" disabled={busy || !!pending.current} onClick={() => {
                if (!dirty || window.confirm("Reload committed content? Unsaved edits will be discarded.")) {
                    setDirty(false);
                    dirtyRef.current = false;
                    void loadRef.current(selected, true);
                }
            }}>Reload saved record</button></div>
   <div className="consultation-columns">
    <details className="consultation-context" open={contextOpen} onToggle={e => setContextOpen(e.currentTarget.open)}><summary><span className="eyebrow">Source context</span><h2>Before this visit</h2></summary><h3>Recorded allergies</h3><p>{detail.patient.allergies.length ? detail.patient.allergies.join(", ") : "None recorded — this is not confirmation of no allergies."}</p>
     <h3>Approved history</h3>{detail.history.length ? detail.history.map(h => <details key={h.id}><summary>{new Date(h.reviewed_at).toLocaleDateString()} · version {h.id.slice(0, 8)}</summary><p>{h.snapshot.chief_complaint ?? "Complaint not recorded"}</p><p>{h.snapshot.clinical_summary ?? "Summary not recorded"}</p><Link href={`/api/clinical/approved/${h.id}`} target="_blank">Open approved source</Link></details>) : <p>No approved history available.</p>}
     <h3>Prescription references</h3>{detail.prescriptions.length ? detail.prescriptions.map(p => <p key={p.id}>{p.medication_name} · {p.dosage ?? "Dose unknown"}<small>{new Date(p.prescribed_at).toLocaleDateString()} · historical reference, review current use</small></p>) : <p>No approved prescription references.</p>}
     <h3>Explicitly shared documents</h3>{detail.documents.length ? detail.documents.map(d => <p key={d.id}><Link href={`/records?document=${d.id}`}>{d.title}</Link><small>Version {d.current_version_id.slice(0, 8)} · {new Date(d.created_at).toLocaleDateString()}</small></p>) : <p>No documents explicitly shared with you.</p>}
    </details>
    <section className="consultation-editor clinical-workbench" aria-label="Clinical findings"><div className="transcript-column">
     <div className="clinical-section-heading"><span className="section-number">01</span><div><h2>Transcript</h2><p>Saved final segments · speaker labels are explicit or unknown</p></div></div>
     <ol className="clinical-transcript">{detail.segments.map(s => <li key={s.id} id={`segment-${s.id}`} tabIndex={-1}><span>{s.speaker} · {s.language} · {s.source_type}{s.speech_provenance?.mode==='offline_fixture'?' · synthetic offline output':''}</span><p>{s.text}</p></li>)}</ol>{!detail.segments.length && <p className="clinical-muted">No transcript segments saved.</p>}
     {active&&<SpeechCapture key={detail.visit.id+':'+detail.visit.revision} consultationId={detail.visit.id} revision={detail.visit.revision} sequence={detail.segments.length} disabled={locked||dirty||!!transcript.trim()} fixture={!!fixture} onBusy={setCaptureBusy} onSaved={()=>{setCaptureBusy(false);void loadRef.current(detail.visit.id,true);}}/>}
     {active && <form onSubmit={e => {
                    e.preventDefault();
                    if (dirty) {
                        setError("Save your clinical findings before adding a transcript segment.");
                        return;
                    }
                    void commit({ action: "transcript", consultationId: detail.visit.id, expectedRevision: detail.visit.revision, segment: { id: crypto.randomUUID(), sequence: detail.segments.length, text: transcript, speaker, language, startMs: null, endMs: null } });
                }}>
      <label className="clinical-field">Typed transcript segment · speech unavailable here<textarea required rows={4} maxLength={8000} value={transcript} disabled={locked} onChange={e => setTranscript(e.target.value)}/></label><div className="clinical-inline"><label>Speaker<select value={speaker} disabled={locked} onChange={e => setSpeaker(e.target.value as SavedSegment['speaker'])}><option value="unknown">Unknown</option><option value="patient">Patient (labelled)</option><option value="clinician">Clinician (labelled)</option></select></label><label>Language<select value={language} disabled={locked} onChange={e => setLanguage(e.target.value as SavedSegment['language'])}>{['unknown', 'en', 'hi', 'Hinglish'].map(x => <option key={x}>{x}</option>)}</select></label><button className="quiet-button" disabled={locked || !transcript.trim()}>Save final segment</button></div>
     </form>}
     </div><div className="findings-column"><div className="clinical-section-heading"><span className="section-number">02</span><div><h2>Clinician findings</h2><p>Manual observations · no automatic carry-forward or generated diagnosis</p></div></div>
     {detail.proposals?.length ? <section className="clinical-proposals" aria-label="Source-bound suggestions"><h3>Source-bound suggestions</h3>{detail.proposals.map(p => <article key={p.id}><p className="eyebrow">{p.result_kind === 'offline_fixture' ? 'Synthetic offline proposal · no live AI' : 'Generated proposal · clinician review required'}</p><p>{p.base_revision !== detail.visit.revision && p.state !== 'accepted' ? 'Stale · a clinician edit takes precedence' : p.state} · base revision {p.base_revision}</p>{p.operations.map((op, i) => <div key={i}><strong>{op.path} · {op.op}</strong><p>{op.value === undefined ? op.note ?? 'Review uncertainty; no automatic deletion' : JSON.stringify(op.value)}</p>{op.evidence_segment_ids.map(id => <a className="text-link" href={'#segment-' + id} key={id}>Transcript source {id.slice(0, 8)} ↗ </a>)}</div>)}<details><summary>Retained source statements</summary>{p.source_snapshot.map(s => <blockquote key={s.id}><p>{s.text}</p><small>{s.speaker} · {s.language}</small></blockquote>)}</details>{active && ['review_required', 'stale'].includes(p.state) && <div className="clinical-inline"><button className="quiet-button" disabled={locked || dirty || p.base_revision !== detail.visit.revision} onClick={() => void commit({ decision: 'accept', expectedRevision: detail.visit.revision }, false, '/api/clinical/proposals/' + p.id)}>Use reviewed suggestion in draft</button><button className="quiet-button" disabled={locked || dirty} onClick={() => void commit({ decision: 'reject', expectedRevision: detail.visit.revision }, false, '/api/clinical/proposals/' + p.id)}>Dismiss suggestion</button></div>}</article>)}</section> : null}
     {labelled("chief_complaint", "Chief complaint")}{([['symptoms', 'Reported symptoms'], ['diagnosis', 'Clinician assessment'], ['lab_tests_ordered', 'Tests ordered']] as const).map(([name, label]) => <label className="clinical-field" key={name}>{label} · one item per line<textarea rows={3} disabled={!active || locked} value={snapshot[name].join('\n')} onChange={e => edit({ ...snapshot, [name]: e.target.value.split('\n') })}/></label>)}
     {labelled("physical_examination", "Physical examination")}
     <h3>Measurements & units</h3>{snapshot.vitals.map((v, i) => <div className="clinical-measurement" key={i}><label>Measurement<select value={v.name} disabled={!active || locked} onChange={e => edit({ ...snapshot, vitals: snapshot.vitals.map((x, j) => i === j ? { ...x, name: e.target.value, unit: '' } : x) })}>{['bp_systolic', 'bp_diastolic', 'heart_rate', 'respiratory_rate', 'temperature', 'spo2', 'weight', 'height', 'glucose', 'hba1c'].map(x => <option key={x}>{x}</option>)}</select></label><label>Value<input type="number" step="any" value={v.value ?? ''} disabled={!active || locked} onChange={e => edit({ ...snapshot, vitals: snapshot.vitals.map((x, j) => i === j ? { ...x, value: e.target.value === '' ? null : Number(e.target.value) } : x) })}/></label><label>Exact unit<input value={v.unit} maxLength={20} disabled={!active || locked} onChange={e => edit({ ...snapshot, vitals: snapshot.vitals.map((x, j) => i === j ? { ...x, unit: e.target.value } : x) })}/></label><button className="quiet-button" disabled={!active || locked} onClick={() => edit({ ...snapshot, vitals: snapshot.vitals.filter((_, j) => i !== j) })}>Remove</button></div>)}
     {active && <button className="quiet-button" disabled={locked || snapshot.vitals.length >= 20} onClick={() => edit({ ...snapshot, vitals: [...snapshot.vitals, { name: 'temperature', value: null, unit: '°C', observedAt: null }] })}>Add measurement</button>}
     <h3>Medication review</h3><p className="clinical-muted">Keep original dose wording. Unknown fields require an explicit review reason before approval. No drug-interaction coverage is claimed.</p>
     {snapshot.medications.map((m, i) => <fieldset className="clinical-medication" key={m.id}><legend>Medicine {i + 1}</legend>{(['name', 'dose', 'frequency', 'duration', 'route', 'instructions'] as const).map(f => <label key={f}>{f}<input value={m[f] ?? ''} maxLength={f === 'name' ? 200 : 1000} disabled={!active || locked || m.unknownFields.includes(f as 'dose')} onChange={e => updateMed(i, { [f]: e.target.value || null })}/>{(['dose', 'frequency', 'duration', 'route'] as string[]).includes(f) && <span><input type="checkbox" checked={m.unknownFields.includes(f as 'dose')} disabled={!active || locked} onChange={e => updateMed(i, { [f]: null, unknownFields: e.target.checked ? [...m.unknownFields, f as 'dose'] : m.unknownFields.filter(x => x !== f) })}/> Explicitly unknown</span>}</label>)}{active && <button className="quiet-button" disabled={locked} onClick={() => edit({ ...snapshot, medications: snapshot.medications.filter((_, j) => i !== j) })}>Remove medicine</button>}</fieldset>)}
     {active && <button className="quiet-button" disabled={locked || snapshot.medications.length >= 30} onClick={() => edit({ ...snapshot, medications: [...snapshot.medications, { id: crypto.randomUUID(), name: '', dose: null, frequency: null, duration: null, route: null, instructions: null, unknownFields: [] }] })}>Add medicine</button>}
     {labelled("clinical_summary", "Clinician summary (optional)")}
     {active && <div className="clinical-savebar"><button className="quiet-button" disabled={locked || !dirty} onClick={() => { const cleaned = { ...snapshot, symptoms: snapshot.symptoms.filter(x => x.trim()), diagnosis: snapshot.diagnosis.filter(x => x.trim()), lab_tests_ordered: snapshot.lab_tests_ordered.filter(x => x.trim()) }; void commit({ action: 'save', consultationId: detail.visit.id, expectedRevision: detail.visit.revision, snapshot: cleaned }); }}>Save findings</button><button className="primary-button" disabled={locked || dirty || !!transcript.trim()} onClick={e => openReview(e.currentTarget)}>Review saved revision</button></div>}
     {detail.approved.map(a => <div key={a.id}><ApprovedRecord record={a}/><button className="quiet-button" disabled={locked} onClick={() => void commit({ action: 'amend', approvedVersionId: a.id })}>Start linked correction</button></div>)}
    </div></section>
   </div>
  </>}
  <Dialog.Root open={review} onOpenChange={setReview}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-panel clinical-review-dialog" onCloseAutoFocus={e => { e.preventDefault(); reviewButtonRef.current?.focus(); }}><Dialog.Title>Review revision {detail?.draft.revision}</Dialog.Title><Dialog.Description>Approval saves an immutable record, its prescription set and an in-app notification together. A later correction creates a linked version.</Dialog.Description>{error && <p role="alert" className="clinical-error">{error}</p>}<p>{snapshot.chief_complaint ?? 'Chief complaint missing'}</p><p>{snapshot.medications.length} medicines · {snapshot.vitals.length} measurements. Review exact values in the saved findings before continuing.</p>{notices.map(n => <label className="clinical-field" key={n.key}>{n.text}<textarea required minLength={10} maxLength={1000} value={reasons[n.key] ?? ''} onChange={e => setReasons({ ...reasons, [n.key]: e.target.value })} placeholder="Record your review reason (at least 10 characters)"/></label>)}<label className="clinical-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I reviewed this saved revision, medication fields, explicit unknowns and source context.</label><div className="clinical-inline"><Dialog.Close className="quiet-button">Return to findings</Dialog.Close><button className="primary-button" disabled={locked || !confirmed || notices.some(n => (reasons[n.key] ?? '').trim().length < 10)} onClick={() => detail && void commit({ action: 'finalize', consultationId: detail.visit.id, expectedRevision: detail.visit.revision, reviewedDraftRevision: detail.draft.revision, confirmed, acknowledgements: reasons })}>Approve record</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
 </RecordLayout>;
}
function ApprovedRecord({ record }: {
    record: Approved;
}) { return <article className="approved-record"><p className="eyebrow">Approved · {new Date(record.reviewed_at).toLocaleString()}</p><h2>{record.snapshot.chief_complaint ?? 'Approved consultation'}</h2><p>{record.snapshot.clinical_summary ?? 'No clinician summary recorded. Generated explanations are unavailable.'}</p>{record.amended_from_id && <p>Correction of version {record.amended_from_id}. The original is retained.</p>}<p>Version {record.id} · source revision {record.source_revision}</p><ul>{record.snapshot.medications.map(m => <li key={m.id}>{m.name} · {m.dose ?? 'Dose unknown'} · {m.frequency ?? 'Frequency unknown'} · {m.duration ?? 'Duration unknown'} · {m.route ?? 'Route unknown'}</li>)}</ul><Link className="text-link" href={`/api/clinical/approved/${record.id}`} target="_blank">Open faithful print / save as PDF record ↗</Link></article>; }
