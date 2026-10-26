// Small endpoint-specific guards for the envelopes the repaired clients consume.
// A malformed 2xx is an unknown outcome, never a confirmed failed mutation.
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string';
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const revision = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const nullable = (v: unknown, check: (v: unknown) => boolean) => v === null || check(v);
const rows = (v: unknown, check: (v: Record<string, unknown>) => boolean) => Array.isArray(v) && v.every(x => object(x) && check(x));
const strings = (v: unknown) => Array.isArray(v) && v.every(text);
const fields = (v: Record<string, unknown>, names: string[]) => names.every(k => text(v[k]));
const dated = (v: unknown) => text(v) && Number.isFinite(Date.parse(v as string));
const version = (v: Record<string, unknown>) => text(v.id) && text(v.reviewedAt);
const item = (v: Record<string, unknown>) => fields(v, ['itemId', 'description', 'category']) && ['quantity', 'unitPaise', 'totalPaise'].every(k => number(v[k]));

export function careResponse(body: unknown, mutation = false) {
  if (!object(body) || !object(body.data)) return false;
  const d = body.data;
  if (mutation) return revision(d.revision) && ['appointmentId', 'queueId', 'consultationId'].some(k => text(d[k]));
  return rows(d.slots, v => fields(v, ['id', 'provider_name', 'time_zone']) && dated(v.starts_at) && dated(v.ends_at))
    && rows(d.appointments, v => fields(v, ['id', 'provider_name', 'time_zone', 'status']) && dated(v.starts_at) && revision(v.revision))
    && rows(d.patients, v => fields(v, ['id', 'name']) && nullable(v.phone, text) && typeof v.unclaimed === 'boolean')
    && rows(d.providers, v => fields(v, ['id', 'name']))
    && rows(d.queue, v => fields(v, ['id', 'patient_name', 'doctor_name', 'status']) && revision(v.revision) && number(v.queue_number));
}

export function continuityResponse(body: unknown, mutation = false) {
  if (!object(body) || !object(body.data)) return false;
  const d = body.data;
  if (mutation) return revision(d.revision) && ['scheduleId', 'eventId', 'taskId'].some(k => text(d[k])) && ['pending', 'reconciled'].includes(String(d.processing));
  return text(d.role) && rows(d.prescriptions, v => fields(v, ['id', 'medication_name', 'approved_emr_version_id', 'reviewed_at']) && typeof v.current_source === 'boolean')
    && rows(d.schedules, v => fields(v, ['id', 'prescription_id', 'time_zone', 'starts_on', 'ends_on']) && strings(v.local_times) && revision(v.revision) && typeof v.enabled === 'boolean')
    && rows(d.tasks, v => fields(v, ['id', 'kind', 'display_time_zone']) && dated(v.due_at) && revision(v.revision))
    && rows(d.adherence, v => fields(v, ['id', 'prescription_id', 'status', 'scheduled_at']) && revision(v.revision) && rows(v.history, h => fields(h, ['status', 'reportedAt']) && revision(h.revision)))
    && rows(d.approvedVersions, version);
}

export function billingResponse(body: unknown, mutation = false) {
  if (!object(body) || !object(body.data)) return false;
  const d = body.data;
  if (mutation) return text(d.billId) && revision(d.revision) && number(d.totalPaise) && d.illustrative === true && d.taxStatus === 'not_assessed';
  return typeof d.canReview === 'boolean' && nullable(d.revision, revision)
    && nullable(d.bill, v => object(v) && fields(v, ['id', 'tariffVersion', 'sourceVersion', 'reviewedAt', 'taxStatus']) && rows(v.items, item) && number(v.totalPaise) && typeof v.sourceCurrent === 'boolean')
    && rows(d.tariffs, v => fields(v, ['version', 'effectiveOn']) && rows(v.items, i => fields(i, ['id', 'description', 'category']) && number(i.unitPaise)))
    && rows(d.approvedVersions, version)
    && rows(d.history, v => revision(v.revision) && fields(v, ['sourceVersion', 'tariffVersion', 'reviewedAt']) && rows(v.items, item) && number(v.totalPaise));
}

export function accountResponse(body: unknown, mutation = false) {
  if (!object(body) || !object(body.data)) return false;
  const d = body.data;
  if (mutation) return revision(d.revision) && nullable(d.memberId, text);
  return revision(d.revision) && object(d.profile) && fields(d.profile, ['name', 'language'])
    && ['phone', 'dob', 'gender', 'bloodGroup', 'address', 'emergencyContact'].every(k => nullable((d.profile as Record<string, unknown>)[k], text))
    && nullable(d.profile.allergies, strings) && nullable(d.profile.conditions, strings)
    && rows(d.family, v => fields(v, ['id', 'name', 'relation']) && nullable(v.parent_id, text) && nullable(v.conditions, strings))
    && rows(d.preferences, v => fields(v, ['id', 'purpose', 'updated_at']) && typeof v.enabled === 'boolean' && typeof v.managed_preference === 'boolean')
    && rows(d.measurements, v => text(v.source_version) && typeof v.current_source === 'boolean' && object(v.measurement) && fields(v.measurement, ['name', 'unit']) && nullable(v.measurement.value, number) && nullable(v.measurement.observedAt, text));
}

const snapshot = (v: unknown) => object(v) && ['chief_complaint','physical_examination','clinical_summary'].every(k=>nullable(v[k],text))
  && ['symptoms','diagnosis','lab_tests_ordered'].every(k=>strings(v[k]))
  && rows(v.medications,m=>fields(m,['id','name']) && ['dose','frequency','duration','route','instructions'].every(k=>nullable(m[k],text)) && strings(m.unknownFields))
  && rows(v.vitals,m=>fields(m,['name','unit']) && nullable(m.value,number) && nullable(m.observedAt,text));
const approved = (v: Record<string,unknown>) => fields(v,['id','consultation_id','reviewed_at']) && snapshot(v.snapshot);
export function clinicalResponse(body: unknown, path: string, mutation = false) {
  if(!object(body))return false;const d=body.data;
  if(path.startsWith('/api/clinical/operations/'))return d===null || object(d)&&text(d.consultationId)&&revision(d.revision);
  if(!object(d))return false;
  if(mutation)return text(d.consultationId)&&revision(d.revision);
  if(path==='/api/clinical')return text(d.role) && (Array.isArray(d.approved)?rows(d.approved,approved):rows(d.visits,v=>text(v.id)&&text(v.status)&&dated(v.started_at)&&revision(v.revision))&&rows(d.patients,v=>fields(v,['id','name']))&&rows(d.care,v=>fields(v,['patient_id','workspace_id'])));
  return object(d.visit)&&fields(d.visit,['id','patient_id','workspace_id','status'])&&revision(d.visit.revision)
    &&object(d.draft)&&snapshot(d.draft.snapshot)&&object(d.patient)&&fields(d.patient,['id','name'])&&strings(d.patient.allergies)
    &&rows(d.segments,v=>fields(v,['id','text','speaker','language','source_type']))&&rows(d.approved,approved)&&rows(d.history,approved)
    &&rows(d.prescriptions,v=>fields(v,['id','medication_name','prescribed_at'])&&nullable(v.dosage,text))
    &&rows(d.documents,v=>fields(v,['id','title','current_version_id','created_at']))
    &&(d.proposals===undefined||rows(d.proposals,v=>fields(v,['id','result_kind','state'])&&revision(v.base_revision)&&rows(v.operations,o=>fields(o,['op','path'])&&strings(o.evidence_segment_ids))&&rows(v.source_snapshot,s=>fields(s,['id','text','speaker','language']))));
}

const evidence = (v:Record<string,unknown>)=>fields(v,['evidenceId','sourceType','versionId','text']);
const result = (v:unknown)=>v===null||object(v)&&(!('answer' in v)||text(v.answer)&&rows(v.facts,f=>text(f.text)&&strings(f.evidenceIds)&&rows(f.quotedSupport,q=>fields(q,['evidenceId','quote'])))&&rows(v.definitions,d=>fields(d,['text','referenceId']))&&strings(v.uncertainties)&&strings(v.citedSourceIds));
const message=(v:Record<string,unknown>)=>fields(v,['id','state','question'])&&result(v.result)&&rows(v.sources,evidence);
export function evidenceResponse(body:unknown,path:string,mutation=false){
 if(!object(body))return false;const d=body.data;
 if(mutation)return object(d)&&(path==='/api/ai/threads'?text(d.threadId):text(d.jobId)&&d.status==='queued'&&number(d.pollAfterMs));
 if(path==='/api/ai/threads')return rows(d,v=>fields(v,['id','created_at'])&&nullable(v.consultation_id,text));
 if(path.startsWith('/api/jobs/'))return object(d)&&fields(d,['id','state'])&&result(d.result)&&rows(d.sources,evidence);
 return object(d)&&object(d.thread)&&fields(d.thread,['id','created_at'])&&rows(d.messages,message)&&object(d.availableSources)&&rows(d.availableSources.documents,v=>fields(v,['id','title']));
}

const speechStates=['admitted','transmitting','responded','saved','outcome_unknown','stale','cancelled','unavailable','rejected','exhausted','failed'];
export function speechResponse(body:unknown,kind:'availability'|'status'|'save'){
 if(!object(body)||!object(body.data))return false;const d=body.data;
 if(kind==='availability')return typeof d.available==='boolean'&&['disabled','offline_fixture','live'].includes(String(d.mode))&&(d.maxClipMs===undefined||Number.isSafeInteger(d.maxClipMs)&&Number(d.maxClipMs)>=1000&&Number(d.maxClipMs)<=15000);
 if(kind==='status')return text(d.id)&&speechStates.includes(String(d.status));
 return speechStates.includes(String(d.state))&&text(d.operationId)&&(d.state!=='saved'||text(d.segmentId)&&text(d.consultationId)&&revision(d.revision));
}

export function documentResponse(body:unknown,path:string,mutation=false){
 if(!object(body))return false;
 if(path.endsWith('/recover'))return object(body.data)&&['idle','succeeded','stale','failed','recovery_degraded','recovery_blocked','retry_queued','unavailable','text_ready','needs_transcription','empty','encrypted','unsupported','review_required','not_admitted','cancelled','outcome_unknown'].includes(String(body.data.status));
 if(mutation)return text(body.document_id)&&(path==='/api/documents'||path.endsWith('/versions')?text(body.version_id):revision(body.revision)&&text(body.action));
 if(path==='/api/documents')return rows(body.documents,v=>fields(v,['id','title','status'])&&revision(v.revision)&&nullable(v.current_version_id,text));
 if(path==='/api/documents/providers')return rows(body.providers,v=>fields(v,['provider_id','workspace_id','name','workspace_name']));
 return object(body.document)&&fields(body.document,['id','title','status'])&&revision(body.document.revision)
  &&rows(body.versions,v=>fields(v,['id','extraction_status','mime','source_class'])&&number(v.version_no))
  &&rows(body.chunks,v=>fields(v,['id','text'])&&['page','ordinal','offset_start','offset_end'].every(k=>number(v[k])))
  &&rows(body.grants,v=>fields(v,['id','provider_id','workspace_id']));
}
