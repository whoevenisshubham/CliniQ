BEGIN;

-- Additive M3 authority. Legacy drafts/transcripts/approvals are retained verbatim;
-- no historical completed encounter is silently represented as a new approval.
CREATE TABLE public.clinical_drafts (
 consultation_id uuid PRIMARY KEY REFERENCES public.consultations(id) ON DELETE RESTRICT,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 snapshot jsonb NOT NULL DEFAULT '{"chief_complaint":null,"physical_examination":null,"symptoms":[],"diagnosis":[],"medications":[],"lab_tests_ordered":[],"vitals":[],"clinical_summary":null}',
 provenance jsonb NOT NULL DEFAULT '{}',
 updated_by uuid NOT NULL REFERENCES public.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.clinical_segments (
 id uuid PRIMARY KEY,
 consultation_id uuid NOT NULL REFERENCES public.clinical_drafts(consultation_id) ON DELETE RESTRICT,
 sequence integer NOT NULL CHECK(sequence BETWEEN 0 AND 999),
 text text NOT NULL CHECK(length(btrim(text)) BETWEEN 1 AND 8000),
 speaker text NOT NULL CHECK(speaker IN ('clinician','patient','unknown')),
 language text NOT NULL CHECK(language IN ('en','hi','Hinglish','unknown')),
 start_ms integer CHECK(start_ms>=0), end_ms integer CHECK(end_ms>=start_ms),
 source_type text NOT NULL DEFAULT 'typed' CHECK(source_type IN ('typed','speech')),
 created_by uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(consultation_id,sequence)
);
CREATE TABLE public.emr_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE RESTRICT,
 version_no integer NOT NULL CHECK(version_no>0),
 snapshot jsonb NOT NULL, field_provenance jsonb NOT NULL,
 reviewed_by uuid NOT NULL REFERENCES public.users(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 source_revision integer NOT NULL CHECK(source_revision>=0),
 content_sha256 text NOT NULL,
 acknowledgements jsonb NOT NULL,
 amended_from_id uuid REFERENCES public.emr_versions(id) ON DELETE RESTRICT,
 UNIQUE(consultation_id,version_no)
);
ALTER TABLE public.consultations ADD COLUMN amendment_of uuid REFERENCES public.emr_versions(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX encounter_amendment_parent ON public.consultations(amendment_of) WHERE amendment_of IS NOT NULL;
ALTER TABLE public.prescriptions ADD COLUMN approved_emr_version_id uuid REFERENCES public.emr_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.prescriptions ADD COLUMN medication_item_id uuid;
ALTER TABLE public.prescriptions ADD COLUMN route text;
ALTER TABLE public.prescriptions ADD COLUMN unknown_fields jsonb;
CREATE UNIQUE INDEX prescription_approved_item ON public.prescriptions(consultation_id,approved_emr_version_id,medication_item_id) WHERE approved_emr_version_id IS NOT NULL;
CREATE TABLE public.clinical_operations (
 actor_id uuid NOT NULL REFERENCES public.users(id),
 operation_key uuid NOT NULL,
 request jsonb NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,operation_key)
);
CREATE TABLE public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES public.users(id),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 kind text NOT NULL CHECK(kind='approved_record'),
 resource_id uuid NOT NULL REFERENCES public.emr_versions(id) ON DELETE RESTRICT,
 due_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 UNIQUE(recipient_id,resource_id)
);
ALTER TABLE public.audit_log ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.audit_log ADD COLUMN sequence_no integer;
ALTER TABLE public.audit_log ADD COLUMN operation_key uuid;
ALTER TABLE public.audit_log ADD COLUMN event_version integer;
CREATE UNIQUE INDEX audit_encounter_sequence ON public.audit_log(consultation_id,sequence_no) WHERE sequence_no IS NOT NULL;
-- M4 owns queue intake; M3 completes only an explicitly trusted typed link.
ALTER TABLE public.patient_queue ADD COLUMN consultation_ref uuid REFERENCES public.consultations(id) ON DELETE RESTRICT;
ALTER TABLE public.patient_queue ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.patient_queue ADD COLUMN patient_ref uuid REFERENCES public.patients(id);
ALTER TABLE public.patient_queue ADD COLUMN doctor_ref uuid REFERENCES public.users(id);

CREATE FUNCTION private.can_edit_encounter(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.consultations x WHERE x.id=c AND x.doctor_id=private.current_app_user_id() AND private.can_treat(x.patient_id,x.workspace_id))
$$;
CREATE FUNCTION private.can_read_approved(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.consultations x WHERE x.id=c AND (private.owns_patient(x.patient_id) OR private.can_edit_encounter(c)))
$$;
REVOKE ALL ON FUNCTION private.can_edit_encounter(uuid),private.can_read_approved(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_edit_encounter(uuid),private.can_read_approved(uuid) TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['clinical_drafts','clinical_segments','emr_versions','clinical_operations','notifications'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
CREATE POLICY draft_treating ON public.clinical_drafts FOR SELECT TO authenticated USING(private.can_edit_encounter(consultation_id));
CREATE POLICY segments_treating ON public.clinical_segments FOR SELECT TO authenticated USING(private.can_edit_encounter(consultation_id));
CREATE POLICY versions_approved ON public.emr_versions FOR SELECT TO authenticated USING(private.can_read_approved(consultation_id));
CREATE POLICY prescriptions_approved ON public.prescriptions FOR SELECT TO authenticated USING(approved_emr_version_id IS NOT NULL AND private.can_read_approved(consultation_id));
CREATE POLICY operations_actor ON public.clinical_operations FOR SELECT TO authenticated USING(actor_id=private.current_app_user_id() AND private.can_edit_encounter((response->>'consultationId')::uuid));
CREATE POLICY notifications_recipient ON public.notifications FOR SELECT TO authenticated USING(recipient_id=private.current_app_user_id());
GRANT SELECT ON public.clinical_drafts,public.clinical_segments,public.emr_versions,public.clinical_operations,public.notifications,public.prescriptions TO authenticated;

CREATE FUNCTION private.clinical_audit(c public.consultations,k uuid,event text,p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; prev text; stamp timestamptz:=clock_timestamp(); h text;
BEGIN
 -- Caller holds encounter row lock; new chain is versioned separately from
 -- preserved historical client hashes. No clinical free text in audit payload.
 SELECT sequence_no,hash INTO n,prev FROM public.audit_log WHERE consultation_id=c.id AND sequence_no IS NOT NULL ORDER BY sequence_no DESC LIMIT 1;
 n:=coalesce(n,0)+1; prev:=coalesce(prev,repeat('0',64));
 h:=encode(extensions.digest(convert_to(jsonb_build_array(prev,n,c.id,k,event,p,stamp)::text,'UTF8'),'sha256'),'hex');
 INSERT INTO public.audit_log(consultation_id,event_type,actor_id,actor_role,payload,timestamp,hash,previous_hash,workspace_id,sequence_no,operation_key,event_version)
 VALUES(c.id,event,private.current_app_user_id(),'doctor',p,stamp,h,prev,c.workspace_id,n,k,1);
END $$;
REVOKE ALL ON FUNCTION private.clinical_audit(public.consultations,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.validate_clinical_snapshot(s jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE f text; x jsonb; ids uuid[]:='{}'; mid uuid;
BEGIN
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR octet_length(s::text)>65536 OR
 (SELECT count(*) FROM jsonb_object_keys(s))<>8 OR EXISTS(SELECT 1 FROM jsonb_object_keys(s) t(k) WHERE k<>ALL(ARRAY['chief_complaint','physical_examination','symptoms','diagnosis','medications','lab_tests_ordered','vitals','clinical_summary'])) THEN RAISE EXCEPTION 'INVALID_SNAPSHOT'; END IF;
 FOREACH f IN ARRAY ARRAY['chief_complaint','physical_examination','clinical_summary'] LOOP
 IF jsonb_typeof(s->f) NOT IN ('string','null') OR length(s->>f)>8000 THEN RAISE EXCEPTION 'INVALID_SNAPSHOT'; END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['symptoms','diagnosis','lab_tests_ordered'] LOOP
 IF jsonb_typeof(s->f) IS DISTINCT FROM 'array' OR jsonb_array_length(s->f)>50 THEN RAISE EXCEPTION 'INVALID_SNAPSHOT'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(s->f) LOOP
 IF jsonb_typeof(x)<>'string' OR length(btrim(x#>>'{}')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_SNAPSHOT'; END IF;
 END LOOP; END LOOP;
 IF jsonb_typeof(s->'medications') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'medications')>30 THEN RAISE EXCEPTION 'INVALID_MEDICATION'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(s->'medications') LOOP
 IF jsonb_typeof(x)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(x))<>8 OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) t(k) WHERE k<>ALL(ARRAY['id','name','dose','frequency','duration','route','instructions','unknownFields'])) THEN RAISE EXCEPTION 'INVALID_MEDICATION'; END IF;
 mid:=(x->>'id')::uuid; IF mid IS NULL OR mid=ANY(ids) THEN RAISE EXCEPTION 'INVALID_MEDICATION'; END IF; ids:=array_append(ids,mid);
 IF jsonb_typeof(x->'name') IS DISTINCT FROM 'string' OR length(btrim(x->>'name')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'INVALID_MEDICATION'; END IF;
 IF jsonb_typeof(x->'unknownFields') IS DISTINCT FROM 'array' OR jsonb_array_length(x->'unknownFields')>4 OR EXISTS(SELECT 1 FROM jsonb_array_elements(x->'unknownFields') v WHERE jsonb_typeof(v)<>'string' OR v#>>'{}'<>ALL(ARRAY['dose','frequency','duration','route'])) THEN RAISE EXCEPTION 'INVALID_MEDICATION'; END IF;
 FOREACH f IN ARRAY ARRAY['dose','frequency','duration','route','instructions'] LOOP
 IF jsonb_typeof(x->f) IS NULL OR jsonb_typeof(x->f) NOT IN ('string','null') OR length(x->>f)>1000 THEN RAISE EXCEPTION 'INVALID_MEDICATION'; END IF;
 IF f<>'instructions' AND x->'unknownFields' ? f AND x->f<>'null'::jsonb THEN RAISE EXCEPTION 'INVALID_MEDICATION'; END IF;
 END LOOP; END LOOP;
 IF jsonb_typeof(s->'vitals') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'vitals')>20 THEN RAISE EXCEPTION 'INVALID_VITALS'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(s->'vitals') LOOP
 IF jsonb_typeof(x)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(x))<>4 OR NOT(x ?& ARRAY['name','value','unit','observedAt']) OR
 jsonb_typeof(x->'name') IS DISTINCT FROM 'string' OR (x->>'name')<>ALL(ARRAY['bp_systolic','bp_diastolic','heart_rate','respiratory_rate','temperature','spo2','weight','height','glucose','hba1c']) OR
 jsonb_typeof(x->'value') NOT IN ('number','null') OR (x->>'value')::numeric<0 OR (x->>'value')::numeric>10000 OR jsonb_typeof(x->'unit') IS DISTINCT FROM 'string' OR
 NOT (CASE x->>'name' WHEN 'temperature' THEN x->>'unit'=ANY(ARRAY['°C','°F']) WHEN 'glucose' THEN x->>'unit'=ANY(ARRAY['mg/dL','mmol/L']) WHEN 'bp_systolic' THEN x->>'unit'='mmHg' WHEN 'bp_diastolic' THEN x->>'unit'='mmHg' WHEN 'heart_rate' THEN x->>'unit'='bpm' WHEN 'respiratory_rate' THEN x->>'unit'='breaths/min' WHEN 'spo2' THEN x->>'unit'='%' WHEN 'weight' THEN x->>'unit'='kg' WHEN 'height' THEN x->>'unit'='cm' WHEN 'hba1c' THEN x->>'unit'='%' ELSE false END) OR
 jsonb_typeof(x->'observedAt') NOT IN ('string','null') OR length(x->>'observedAt')>40 THEN RAISE EXCEPTION 'INVALID_VITALS'; END IF;
 IF x->>'observedAt' IS NOT NULL THEN PERFORM (x->>'observedAt')::timestamptz; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.validate_clinical_snapshot(jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.lock_clinical_access(p uuid,w uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 -- Serialize approval admission with account/membership/care revocation.
 PERFORM 1 FROM public.users WHERE id=private.current_app_user_id() FOR SHARE;
 PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=w AND user_id=private.current_app_user_id() FOR SHARE;
 PERFORM 1 FROM public.care_relationships WHERE patient_id=p AND workspace_id=w AND provider_id=private.current_app_user_id() AND scope='clinical' AND revoked_at IS NULL FOR SHARE;
 IF NOT coalesce(private.can_treat(p,w),false) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
END $$;
REVOKE ALL ON FUNCTION private.lock_clinical_access(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- One typed mutation function owns all authoritative writes. Every caller uses
-- their real JWT. No service-role principal substitution or client actor fields.
CREATE FUNCTION public.clinical_mutate(k uuid,command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=private.current_app_user_id(); c public.consultations; d public.clinical_drafts;
 prior public.clinical_operations; action text:=command->>'action'; response jsonb; cid uuid; p uuid; w uuid;
 s jsonb; seg jsonb; existing public.clinical_segments; f text; prov jsonb; v uuid; med jsonb; stamp timestamptz:=clock_timestamp(); owner_id uuid; parent public.emr_versions; parent_enc public.consultations;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF k IS NULL OR jsonb_typeof(command) IS DISTINCT FROM 'object' OR octet_length(command::text)>131072 OR action IS NULL OR action<>ALL(ARRAY['create','amend','save','transcript','finalize']) THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 -- Actor/key lock serializes timeouts and duplicate concurrent creation.
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||k::text,0));
 SELECT * INTO prior FROM public.clinical_operations WHERE actor_id=actor AND operation_key=k;
 IF FOUND THEN
 IF prior.request<>command THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 IF NOT private.can_edit_encounter((prior.response->>'consultationId')::uuid) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 RETURN prior.response;
 END IF;
 IF (SELECT count(*) FROM public.clinical_operations WHERE actor_id=actor AND created_at>now()-interval '1 day')>=1000 THEN RAISE EXCEPTION 'OPERATION_LIMIT'; END IF;
 IF action='amend' THEN
 IF (SELECT count(*) FROM jsonb_object_keys(command))<>2 OR NOT(command ?& ARRAY['action','approvedVersionId']) THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 SELECT * INTO parent FROM public.emr_versions WHERE id=(command->>'approvedVersionId')::uuid;
 IF NOT FOUND OR NOT private.can_edit_encounter(parent.consultation_id) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 SELECT * INTO parent_enc FROM public.consultations WHERE id=parent.consultation_id FOR UPDATE;
 PERFORM private.lock_clinical_access(parent_enc.patient_id,parent_enc.workspace_id);
 IF EXISTS(SELECT 1 FROM public.consultations WHERE amendment_of=parent.id) THEN RAISE EXCEPTION 'AMENDMENT_EXISTS'; END IF;
 INSERT INTO public.consultations(doctor_id,patient_id,workspace_id,status,amendment_of) VALUES(actor,parent_enc.patient_id,parent_enc.workspace_id,'active',parent.id) RETURNING * INTO c;
 INSERT INTO public.clinical_drafts(consultation_id,snapshot,provenance,updated_by) VALUES(c.id,parent.snapshot,parent.field_provenance,actor);
 PERFORM private.clinical_audit(c,k,'amendment_started',jsonb_build_object('priorVersionId',parent.id));
 ELSIF action='create' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) t(x) WHERE x<>ALL(ARRAY['action','patientId','workspaceId'])) OR (SELECT count(*) FROM jsonb_object_keys(command))<>3 THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 p:=(command->>'patientId')::uuid; w:=(command->>'workspaceId')::uuid;
 IF NOT coalesce(private.can_treat(p,w),false) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 PERFORM private.lock_clinical_access(p,w);
 INSERT INTO public.consultations(doctor_id,patient_id,workspace_id,status) VALUES(actor,p,w,'active') RETURNING * INTO c;
 INSERT INTO public.clinical_drafts(consultation_id,updated_by) VALUES(c.id,actor);
 PERFORM private.clinical_audit(c,k,'encounter_created','{}');
 ELSE
 cid:=(command->>'consultationId')::uuid;
 SELECT * INTO c FROM public.consultations WHERE id=cid FOR UPDATE;
 IF NOT FOUND OR NOT private.can_edit_encounter(cid) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 PERFORM private.lock_clinical_access(c.patient_id,c.workspace_id);
 SELECT * INTO d FROM public.clinical_drafts WHERE consultation_id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEGACY_RECONCILIATION_REQUIRED'; END IF;
 IF c.status<>'active' THEN RAISE EXCEPTION 'ENCOUNTER_CLOSED'; END IF;
 IF jsonb_typeof(command->'expectedRevision') IS DISTINCT FROM 'number' OR (command->>'expectedRevision')::numeric<>c.revision THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
 IF c.revision>=10000 THEN RAISE EXCEPTION 'OPERATION_LIMIT'; END IF;
 IF action='save' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) t(x) WHERE x<>ALL(ARRAY['action','consultationId','expectedRevision','snapshot'])) OR (SELECT count(*) FROM jsonb_object_keys(command))<>4 THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 s:=command->'snapshot'; PERFORM private.validate_clinical_snapshot(s);
 prov:=d.provenance;
 FOR f IN SELECT jsonb_object_keys(s) LOOP
 IF s->f IS DISTINCT FROM d.snapshot->f THEN prov:=jsonb_set(prov,ARRAY[f],jsonb_build_object('sourceType','clinician_observation','editorId',actor,'recordedAt',stamp,'revision',c.revision+1)); END IF;
 END LOOP;
 UPDATE public.clinical_drafts SET snapshot=s,provenance=prov,revision=c.revision+1,updated_by=actor,updated_at=stamp WHERE consultation_id=cid;
 PERFORM private.clinical_audit(c,k,'draft_saved',jsonb_build_object('revision',c.revision+1,'snapshotHash',encode(extensions.digest(convert_to(s::text,'UTF8'),'sha256'),'hex')));
 ELSIF action='transcript' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) t(x) WHERE x<>ALL(ARRAY['action','consultationId','expectedRevision','segment'])) OR (SELECT count(*) FROM jsonb_object_keys(command))<>4 THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 seg:=command->'segment';
 IF jsonb_typeof(seg) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(seg))<>7 OR NOT(seg ?& ARRAY['id','sequence','text','speaker','language','startMs','endMs']) OR jsonb_typeof(seg->'text') IS DISTINCT FROM 'string' OR jsonb_typeof(seg->'sequence') IS DISTINCT FROM 'number' OR (seg->>'sequence')::numeric<>trunc((seg->>'sequence')::numeric) OR jsonb_typeof(seg->'speaker') IS DISTINCT FROM 'string' OR jsonb_typeof(seg->'language') IS DISTINCT FROM 'string' OR jsonb_typeof(seg->'startMs')<>'null' OR jsonb_typeof(seg->'endMs')<>'null' THEN RAISE EXCEPTION 'INVALID_SEGMENT'; END IF;
 -- Typed text has no invented audio timing or provider provenance.
 SELECT * INTO existing FROM public.clinical_segments WHERE id=(seg->>'id')::uuid;
 IF FOUND THEN RAISE EXCEPTION 'SEGMENT_CONFLICT'; END IF;
 IF (seg->>'sequence')::integer<>(SELECT count(*) FROM public.clinical_segments WHERE consultation_id=cid) OR (SELECT coalesce(sum(length(text)),0) FROM public.clinical_segments WHERE consultation_id=cid)+length(seg->>'text')>100000 THEN RAISE EXCEPTION 'INVALID_SEGMENT'; END IF;
 INSERT INTO public.clinical_segments(id,consultation_id,sequence,text,speaker,language,start_ms,end_ms,created_by)
 VALUES((seg->>'id')::uuid,cid,(seg->>'sequence')::integer,seg->>'text',seg->>'speaker',seg->>'language',NULL,NULL,actor);
 UPDATE public.clinical_drafts SET revision=c.revision+1,updated_by=actor,updated_at=stamp WHERE consultation_id=cid;
 PERFORM private.clinical_audit(c,k,'transcript_saved',jsonb_build_object('segmentId',seg->>'id','revision',c.revision+1));
 ELSIF action='finalize' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) t(x) WHERE x<>ALL(ARRAY['action','consultationId','expectedRevision','reviewedDraftRevision','confirmed','acknowledgements'])) OR (SELECT count(*) FROM jsonb_object_keys(command))<>6 OR command->'confirmed' IS DISTINCT FROM 'true'::jsonb OR command->'reviewedDraftRevision' IS DISTINCT FROM to_jsonb(d.revision) THEN RAISE EXCEPTION 'REVIEW_REQUIRED'; END IF;
 s:=d.snapshot; PERFORM private.validate_clinical_snapshot(s);
 IF length(btrim(coalesce(s->>'chief_complaint','')))=0 THEN RAISE EXCEPTION 'REVIEW_REQUIRED'; END IF;
 IF jsonb_typeof(command->'acknowledgements') IS DISTINCT FROM 'object' OR octet_length((command->'acknowledgements')::text)>16000 OR EXISTS(SELECT 1 FROM jsonb_each(command->'acknowledgements') t(x,y) WHERE jsonb_typeof(y)<>'string' OR length(btrim(y#>>'{}')) NOT BETWEEN 10 AND 1000) THEN RAISE EXCEPTION 'REVIEW_REQUIRED'; END IF;
 FOR f IN SELECT x->>'name' FROM jsonb_array_elements(s->'vitals') x GROUP BY x->>'name' HAVING count(DISTINCT x->>'unit')>1 LOOP
 IF NOT(command->'acknowledgements' ? ('unit:'||f)) THEN RAISE EXCEPTION 'UNIT_REVIEW_REQUIRED'; END IF;
 END LOOP;
 FOR med IN SELECT value FROM jsonb_array_elements(s->'medications') LOOP
 IF EXISTS(SELECT 1 FROM public.patients p,LATERAL unnest(p.allergies) a WHERE p.id=c.patient_id AND lower(btrim(a))=lower(btrim(med->>'name'))) AND NOT(command->'acknowledgements' ? ('allergy:'||(med->>'id'))) THEN RAISE EXCEPTION 'ALLERGY_REVIEW_REQUIRED'; END IF;
 FOREACH f IN ARRAY ARRAY['dose','frequency','duration','route'] LOOP
 IF length(btrim(coalesce(med->>f,'')))=0 AND NOT(med->'unknownFields' ? f) THEN RAISE EXCEPTION 'MEDICATION_REVIEW_REQUIRED'; END IF;
 IF med->'unknownFields' ? f AND NOT(command->'acknowledgements' ? ((med->>'id')||':'||f)) THEN RAISE EXCEPTION 'MEDICATION_REVIEW_REQUIRED'; END IF;
 END LOOP; END LOOP;
 INSERT INTO public.emr_versions(consultation_id,version_no,snapshot,field_provenance,reviewed_by,source_revision,content_sha256,acknowledgements,amended_from_id)
 VALUES(cid,1,s,d.provenance,actor,c.revision,encode(extensions.digest(convert_to(s::text,'UTF8'),'sha256'),'hex'),command->'acknowledgements',c.amendment_of) RETURNING id INTO v;
 FOR med IN SELECT value FROM jsonb_array_elements(s->'medications') LOOP
 INSERT INTO public.prescriptions(consultation_id,patient_id,doctor_id,approved_emr_version_id,medication_item_id,medication_name,dosage,frequency,duration,route,instructions,unknown_fields)
 VALUES(cid,c.patient_id,actor,v,(med->>'id')::uuid,med->>'name',med->>'dose',med->>'frequency',med->>'duration',med->>'route',med->>'instructions',med->'unknownFields');
 END LOOP;
 UPDATE public.consultations SET status='completed',ended_at=stamp,finalized_revision=c.revision WHERE id=cid;
 UPDATE public.patient_queue SET status='completed',end_time=stamp WHERE consultation_ref=cid AND workspace_id=c.workspace_id AND patient_ref=c.patient_id AND doctor_ref=c.doctor_id AND status='in-consultation';
 SELECT user_id INTO owner_id FROM public.patients WHERE id=c.patient_id;
 IF owner_id IS NOT NULL THEN INSERT INTO public.notifications(recipient_id,workspace_id,kind,resource_id) VALUES(owner_id,c.workspace_id,'approved_record',v); END IF;
 PERFORM private.clinical_audit(c,k,'encounter_finalized',jsonb_build_object('approvedVersionId',v,'sourceRevision',c.revision));
 END IF;
 UPDATE public.consultations SET revision=revision+1 WHERE id=cid RETURNING * INTO c;
 END IF;
 response:=jsonb_build_object('consultationId',c.id,'revision',c.revision,'approvedVersionId',v,'status',c.status);
 INSERT INTO public.clinical_operations(actor_id,operation_key,request,response) VALUES(actor,k,command,response);
 RETURN response;
END $$;
REVOKE ALL ON FUNCTION public.clinical_mutate(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinical_mutate(uuid,jsonb) TO authenticated;

-- Ordinary clients never update approved records or audit. Also guard trusted
-- application mistakes: changes require a deliberate future amendment workflow.
CREATE FUNCTION private.immutable_approved() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'APPROVED_IMMUTABLE'; END $$;
REVOKE ALL ON FUNCTION private.immutable_approved() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER approved_immutable BEFORE UPDATE OR DELETE ON public.emr_versions FOR EACH ROW EXECUTE FUNCTION private.immutable_approved();
CREATE TRIGGER prescription_immutable BEFORE UPDATE OR DELETE ON public.prescriptions FOR EACH ROW WHEN (OLD.approved_emr_version_id IS NOT NULL) EXECUTE FUNCTION private.immutable_approved();
CREATE TRIGGER clinical_audit_immutable BEFORE UPDATE OR DELETE ON public.audit_log FOR EACH ROW WHEN (OLD.sequence_no IS NOT NULL) EXECUTE FUNCTION private.immutable_approved();
NOTIFY pgrst,'reload schema';
COMMIT;
