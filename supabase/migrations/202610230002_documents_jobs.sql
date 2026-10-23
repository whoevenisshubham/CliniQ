-- M2 document lifecycle: no legacy clinical writes or provider calls enabled.
BEGIN;
ALTER TABLE public.documents ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.document_versions ADD COLUMN extraction_status text NOT NULL DEFAULT 'queued' CHECK(extraction_status IN ('queued','parsing','text_ready','needs_transcription','encrypted','unsupported','empty','failed','obsolete'));
ALTER TABLE public.document_versions ADD COLUMN page_count integer CHECK(page_count BETWEEN 0 AND 20);
ALTER TABLE public.document_versions ADD COLUMN parser_version text;
ALTER TABLE public.document_versions ADD COLUMN source_class text NOT NULL DEFAULT 'original' CHECK(source_class IN ('original','manual'));
ALTER TABLE public.document_versions ADD COLUMN parent_version_id uuid;
ALTER TABLE public.document_versions ADD CONSTRAINT manual_parent_fk FOREIGN KEY(document_id,parent_version_id) REFERENCES public.document_versions(document_id,id);
CREATE TABLE public.upload_operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.users(id), patient_id uuid NOT NULL REFERENCES public.patients(id),
 operation_key uuid NOT NULL, document_id uuid NOT NULL REFERENCES public.documents(id), version_id uuid NOT NULL DEFAULT gen_random_uuid(),
 expected_revision integer NOT NULL CHECK(expected_revision>=0), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180 AND file_name !~ '[/\\]'),
 mime text NOT NULL CHECK(mime IN ('text/plain','application/pdf','image/png','image/jpeg')), byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 4194304),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), object_key text UNIQUE NOT NULL,
 source_class text NOT NULL DEFAULT 'original' CHECK(source_class IN ('original','manual')), parent_version_id uuid,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','stored','committed','cleaning','cleaned')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes', cleaned_at timestamptz,
 UNIQUE(actor_id,operation_key), FOREIGN KEY(document_id,parent_version_id) REFERENCES public.document_versions(document_id,id)
);
CREATE TABLE public.document_chunks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.documents(id), version_id uuid NOT NULL REFERENCES public.document_versions(id),
 input_revision integer NOT NULL CHECK(input_revision>=0), ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 99), page integer NOT NULL CHECK(page BETWEEN 1 AND 20),
 text text NOT NULL CHECK(length(text) BETWEEN 1 AND 1300), offset_start integer NOT NULL CHECK(offset_start>=0),offset_end integer NOT NULL CHECK(offset_end>offset_start),
 text_sha256 text NOT NULL, source_class text NOT NULL CHECK(source_class IN ('original','manual')), UNIQUE(version_id,ordinal)
);
CREATE TABLE public.document_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.documents(id),version_id uuid REFERENCES public.document_versions(id),
 actor_id uuid NOT NULL REFERENCES public.users(id),input_revision integer NOT NULL CHECK(input_revision>=0), kind text NOT NULL CHECK(kind IN ('ingest_document','purge_document')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 available_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,fence integer NOT NULL DEFAULT 0 CHECK(fence>=0),attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,version_id,input_revision,kind)
);
CREATE INDEX document_jobs_claim ON public.document_jobs(status,available_at);
CREATE TABLE public.document_mutations(actor_id uuid NOT NULL REFERENCES public.users(id),operation_key uuid NOT NULL,request jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(actor_id,operation_key));
-- Reserved for derived results; no AI admission or result writes are enabled.
CREATE TABLE public.document_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES public.documents(id),input_revision integer NOT NULL,status text NOT NULL CHECK(status IN ('current','stale')),created_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['upload_operations','document_chunks','document_jobs','document_mutations','document_results'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;END $$;
CREATE POLICY upload_owner ON public.upload_operations FOR SELECT TO authenticated USING(actor_id=private.current_app_user_id());
CREATE POLICY chunks_current ON public.document_chunks FOR SELECT TO authenticated USING(private.can_read_document(document_id) AND EXISTS(SELECT 1 FROM public.documents d WHERE d.id=document_id AND d.current_version_id=version_id AND d.revision=input_revision AND d.status='ready'));
CREATE POLICY jobs_owner ON public.document_jobs FOR SELECT TO authenticated USING(actor_id=private.current_app_user_id());
GRANT SELECT ON public.upload_operations,public.document_chunks,public.document_jobs TO authenticated;
-- Old originals are retained for owner provenance only; grants always read current version.
DROP POLICY versions_scoped ON public.document_versions;
CREATE POLICY versions_current ON public.document_versions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.documents d WHERE d.id=document_id AND d.deleted_at IS NULL AND (private.owns_patient(d.patient_id) OR (d.current_version_id=document_versions.id AND private.can_read_document(d.id)))));
-- App validates complete bytes before privileged immutable upload; no direct upload bypass.
DROP POLICY clinical_owner_upload ON storage.objects;

CREATE FUNCTION public.document_admit(p_key uuid,p_title text,p_name text,p_mime text,p_size integer,p_hash text,p_document uuid DEFAULT NULL,p_revision integer DEFAULT 0,p_parent uuid DEFAULT NULL)
RETURNS public.upload_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=private.current_app_user_id(); patient uuid; d public.documents; op public.upload_operations; vid uuid:=gen_random_uuid(); occupied bigint; count_docs integer;
BEGIN
 SELECT id INTO patient FROM public.patients WHERE user_id=actor;
 IF patient IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor AND role='patient') THEN RAISE EXCEPTION 'OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(patient::text,0));
 SELECT * INTO op FROM public.upload_operations WHERE actor_id=actor AND operation_key=p_key;
 IF FOUND THEN
  IF op.title IS DISTINCT FROM p_title OR op.file_name IS DISTINCT FROM p_name OR op.mime IS DISTINCT FROM p_mime OR op.byte_size IS DISTINCT FROM p_size OR op.sha256 IS DISTINCT FROM p_hash OR (p_document IS NOT NULL AND op.document_id<>p_document) OR op.expected_revision<>p_revision OR op.parent_version_id IS DISTINCT FROM p_parent THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='23505'; END IF;
  IF op.state IN ('cleaning','cleaned') OR (op.state IN ('reserved','stored') AND op.expires_at<=now()) THEN RAISE EXCEPTION 'UPLOAD_EXPIRED' USING ERRCODE='23514'; END IF;
  RETURN op;
 END IF;
 IF (SELECT count(*) FROM public.upload_operations WHERE patient_id=patient AND created_at>now()-interval '24 hours')>=100 THEN RAISE EXCEPTION 'UPLOAD_RATE_LIMIT' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(v.byte_size),0) INTO occupied FROM public.document_versions v JOIN public.documents x ON x.id=v.document_id WHERE x.patient_id=patient;
 occupied:=occupied+(SELECT coalesce(sum(byte_size),0) FROM public.upload_operations WHERE patient_id=patient AND state IN ('reserved','stored','cleaning'));
 IF occupied+p_size>41943040 THEN RAISE EXCEPTION 'BYTE_QUOTA' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*) FROM public.upload_operations WHERE patient_id=patient AND state IN ('reserved','stored','cleaning'))>=10 THEN RAISE EXCEPTION 'UPLOAD_QUOTA' USING ERRCODE='23514'; END IF;
 IF p_document IS NULL THEN
  SELECT count(*) INTO count_docs FROM public.documents WHERE patient_id=patient AND status<>'deleted';
  IF count_docs>=10 THEN RAISE EXCEPTION 'DOCUMENT_QUOTA' USING ERRCODE='23514'; END IF;
  INSERT INTO public.documents(patient_id,created_by,title) VALUES(patient,actor,p_title) RETURNING * INTO d;
 ELSE
  SELECT * INTO d FROM public.documents WHERE id=p_document AND patient_id=patient AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='42501'; END IF;
  IF d.revision<>p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT' USING ERRCODE='40001'; END IF;
  IF (SELECT count(*) FROM public.document_versions WHERE document_id=d.id)>=10 THEN RAISE EXCEPTION 'VERSION_QUOTA' USING ERRCODE='23514'; END IF;
 END IF;
 IF p_parent IS NOT NULL AND (p_mime<>'text/plain' OR NOT EXISTS(SELECT 1 FROM public.document_versions WHERE id=p_parent AND document_id=d.id)) THEN RAISE EXCEPTION 'INVALID_PARENT' USING ERRCODE='23514'; END IF;
 INSERT INTO public.upload_operations(actor_id,patient_id,operation_key,document_id,version_id,expected_revision,title,file_name,mime,byte_size,sha256,object_key,source_class,parent_version_id)
 VALUES(actor,patient,p_key,d.id,vid,d.revision,p_title,p_name,p_mime,p_size,p_hash,d.id::text||'/'||vid::text,CASE WHEN p_parent IS NULL THEN 'original' ELSE 'manual' END,p_parent) RETURNING * INTO op;
 RETURN op;
END $$;

CREATE FUNCTION private.invalidate_document(p_document uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE public.document_jobs SET status='cancelled',lease_until=NULL WHERE document_id=p_document AND status IN ('queued','running');
 DELETE FROM public.document_chunks WHERE document_id=p_document;
 UPDATE public.document_results SET status='stale' WHERE document_id=p_document;
END $$;
CREATE FUNCTION private.enqueue_document(p_document uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE public.document_versions SET extraction_status='queued' WHERE id=(SELECT current_version_id FROM public.documents WHERE id=p_document AND status='ready');
 INSERT INTO public.document_jobs(document_id,version_id,actor_id,input_revision,kind)
 SELECT id,current_version_id,created_by,revision,'ingest_document' FROM public.documents WHERE id=p_document AND status='ready' AND current_version_id IS NOT NULL;
END $$;
CREATE FUNCTION public.document_upload_stage(p_operation uuid,p_stage text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE op public.upload_operations;BEGIN
 SELECT patient_id INTO op.patient_id FROM public.upload_operations WHERE id=p_operation;
 PERFORM pg_advisory_xact_lock(hashtextextended(op.patient_id::text,0));
 SELECT * INTO op FROM public.upload_operations WHERE id=p_operation FOR UPDATE;
 IF op.state NOT IN ('reserved','stored') THEN RETURN;END IF;
 IF p_stage='stored' THEN
  IF op.expires_at<=now() THEN RAISE EXCEPTION 'UPLOAD_EXPIRED';END IF;
  UPDATE public.upload_operations SET state='stored' WHERE id=op.id;
 ELSIF p_stage='failed' THEN
  UPDATE public.documents SET status='upload_failed' WHERE id=op.document_id AND current_version_id IS NULL AND deleted_at IS NULL;
 ELSE RAISE EXCEPTION 'INVALID_STAGE';END IF;
END $$;
CREATE FUNCTION public.document_commit(p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE op public.upload_operations;d public.documents;vno integer;
BEGIN
 SELECT patient_id INTO op.patient_id FROM public.upload_operations WHERE id=p_operation;
 PERFORM pg_advisory_xact_lock(hashtextextended(op.patient_id::text,0));
 SELECT * INTO op FROM public.upload_operations WHERE id=p_operation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF op.state='committed' THEN RETURN jsonb_build_object('document_id',op.document_id,'version_id',op.version_id);END IF;
 IF op.state NOT IN ('reserved','stored') OR op.expires_at<=now() THEN RAISE EXCEPTION 'UPLOAD_EXPIRED';END IF;
 SELECT * INTO d FROM public.documents WHERE id=op.document_id FOR UPDATE;
 IF d.deleted_at IS NOT NULL OR d.revision<>op.expected_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=op.actor_id AND is_active) THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='clinical-documents' AND name=op.object_key) THEN RAISE EXCEPTION 'BYTES_MISSING';END IF;
 IF op.state<>'stored' THEN RAISE EXCEPTION 'BYTES_UNVALIDATED';END IF;
 SELECT coalesce(max(version_no),0)+1 INTO vno FROM public.document_versions WHERE document_id=d.id;
 IF vno>10 THEN RAISE EXCEPTION 'VERSION_QUOTA';END IF;
 INSERT INTO public.document_versions(id,document_id,version_no,object_key,mime,byte_size,sha256,source_class,parent_version_id)
 VALUES(op.version_id,d.id,vno,op.object_key,op.mime,op.byte_size,op.sha256,op.source_class,op.parent_version_id);
 PERFORM private.invalidate_document(d.id);
 UPDATE public.document_grants SET revoked_at=now() WHERE document_id=d.id AND revoked_at IS NULL;
 UPDATE public.document_versions SET extraction_status='obsolete' WHERE document_id=d.id AND id<>op.version_id;
 UPDATE public.documents SET title=op.title,current_version_id=op.version_id,status='ready',revision=revision+1 WHERE id=d.id;
 UPDATE public.upload_operations SET state='committed' WHERE id=op.id;
 PERFORM private.enqueue_document(d.id);
 RETURN jsonb_build_object('document_id',d.id,'version_id',op.version_id);
END $$;
CREATE FUNCTION public.document_change(p_document uuid,p_revision integer,p_key uuid,p_action text,p_provider uuid DEFAULT NULL,p_workspace uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=private.current_app_user_id();patient uuid; d public.documents;m public.document_mutations;req jsonb;result jsonb;
BEGIN
 SELECT id INTO patient FROM public.patients WHERE user_id=actor;
 IF patient IS NULL THEN RAISE EXCEPTION 'OWNER_REQUIRED' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(patient::text,0));
 req:=jsonb_build_object('document',p_document,'revision',p_revision,'action',p_action,'provider',p_provider,'workspace',p_workspace);
 IF (SELECT count(*) FROM public.document_mutations WHERE actor_id=actor)>=1000 THEN RAISE EXCEPTION 'MUTATION_LIMIT' USING ERRCODE='23514';END IF;
 SELECT * INTO m FROM public.document_mutations WHERE actor_id=actor AND operation_key=p_key;
 IF FOUND THEN IF m.request<>req THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';END IF;RETURN m.result;END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document AND patient_id=patient AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='42501';END IF;
 IF d.revision<>p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT' USING ERRCODE='40001';END IF;
 IF p_action IN ('share','revoke') AND (p_provider IS NULL OR p_workspace IS NULL) THEN RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='23514';END IF;
 IF p_action='retry' THEN
  IF d.status<>'ready' THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='42501';END IF;
 ELSIF p_action='share' THEN
  IF d.status<>'ready' OR NOT EXISTS(SELECT 1 FROM public.care_relationships c JOIN public.workspace_memberships w ON w.workspace_id=c.workspace_id AND w.user_id=c.provider_id JOIN public.users u ON u.id=w.user_id
   WHERE c.patient_id=patient AND c.provider_id=p_provider AND c.workspace_id=p_workspace AND c.scope='clinical' AND c.revoked_at IS NULL AND w.status='active' AND w.role='doctor' AND u.role='doctor' AND u.is_active) THEN RAISE EXCEPTION 'INELIGIBLE_PROVIDER' USING ERRCODE='42501';END IF;
  INSERT INTO public.document_grants(document_id,provider_id,workspace_id,granted_by) VALUES(d.id,p_provider,p_workspace,actor) ON CONFLICT(document_id,provider_id,workspace_id) WHERE revoked_at IS NULL DO NOTHING;
 ELSIF p_action='revoke' THEN
  UPDATE public.document_grants SET revoked_at=now() WHERE document_id=d.id AND provider_id=p_provider AND workspace_id=p_workspace AND revoked_at IS NULL;
 ELSIF p_action='delete' THEN
  UPDATE public.documents SET status='deleted',deleted_at=now() WHERE id=d.id;
  UPDATE public.document_grants SET revoked_at=now() WHERE document_id=d.id AND revoked_at IS NULL;
  UPDATE public.upload_operations SET state='cleaning' WHERE document_id=d.id AND state IN ('reserved','stored');
 ELSE RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='23514';END IF;
 UPDATE public.documents SET revision=revision+1 WHERE id=d.id;
 PERFORM private.invalidate_document(d.id);
 IF p_action='delete' THEN
  INSERT INTO public.document_jobs(document_id,actor_id,input_revision,kind) VALUES(d.id,actor,d.revision+1,'purge_document');
 ELSE PERFORM private.enqueue_document(d.id);END IF;
 result:=jsonb_build_object('document_id',d.id,'revision',d.revision+1,'action',p_action);
 INSERT INTO public.document_mutations VALUES(actor,p_key,req,result);RETURN result;
END $$;

CREATE FUNCTION public.document_share_candidates() RETURNS TABLE(provider_id uuid,workspace_id uuid,name text,workspace_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT DISTINCT c.provider_id,c.workspace_id,u.name,w.name FROM public.care_relationships c JOIN public.patients p ON p.id=c.patient_id JOIN public.users u ON u.id=c.provider_id
 JOIN public.workspaces w ON w.id=c.workspace_id JOIN public.workspace_memberships m ON m.workspace_id=c.workspace_id AND m.user_id=c.provider_id
 WHERE p.user_id=private.current_app_user_id() AND c.scope='clinical' AND c.revoked_at IS NULL AND m.status='active' AND m.role='doctor' AND u.role='doctor' AND u.is_active
$$;
CREATE FUNCTION public.document_claim(p_id uuid DEFAULT NULL) RETURNS SETOF public.document_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE public.document_jobs SET status='failed',error_code='ATTEMPTS_EXHAUSTED',lease_until=NULL WHERE status='running' AND lease_until<now() AND attempts>=3;
 UPDATE public.document_versions v SET extraction_status='failed' WHERE EXISTS(SELECT 1 FROM public.document_jobs j JOIN public.documents d ON d.id=j.document_id WHERE j.version_id=v.id AND j.status='failed' AND j.attempts>=3 AND d.current_version_id=v.id AND d.revision=j.input_revision);
 RETURN QUERY WITH candidate AS(SELECT id FROM public.document_jobs WHERE (p_id IS NULL OR id=p_id) AND attempts<3 AND available_at<=now() AND (status='queued' OR (status='running' AND lease_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
 UPDATE public.document_jobs j SET status='running',fence=fence+1,attempts=attempts+1,lease_until=now()+interval '90 seconds' FROM candidate c WHERE j.id=c.id RETURNING j.*;
END $$;
CREATE FUNCTION public.document_publish(p_job uuid,p_fence integer,p_status text,p_pages integer,p_chunks jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;d public.documents;c jsonb;total integer:=0; ord integer:=0;pg integer:=0;prev_end integer:=0;
BEGIN
 -- Same lock order as change/commit: document before job, preventing revoke/publication deadlocks.
 SELECT document_id INTO j.document_id FROM public.document_jobs WHERE id=p_job;
 SELECT * INTO d FROM public.documents WHERE id=j.document_id FOR UPDATE;
 SELECT * INTO j FROM public.document_jobs WHERE id=p_job FOR UPDATE;
 IF j.status IS DISTINCT FROM 'running' OR j.fence<>p_fence OR j.lease_until<=now() OR d.status<>'ready' OR d.current_version_id<>j.version_id OR d.revision<>j.input_revision THEN RETURN false;END IF;
 IF p_status NOT IN ('text_ready','needs_transcription','encrypted','unsupported','empty','failed') OR p_pages<0 OR p_pages>20 OR jsonb_typeof(p_chunks)<>'array' OR jsonb_array_length(p_chunks)>100 THEN RAISE EXCEPTION 'INVALID_PARSER_RESULT';END IF;
 IF (p_status='text_ready') IS DISTINCT FROM (jsonb_array_length(p_chunks)>0) THEN RAISE EXCEPTION 'INVALID_PARSER_RESULT';END IF;
 DELETE FROM public.document_chunks WHERE document_id=d.id;
 FOR c IN SELECT value FROM jsonb_array_elements(p_chunks) LOOP
  total:=total+length(c->>'text');
  IF total>115000 OR (c->>'ordinal')::integer<>ord OR (c->>'page')::integer<pg OR (c->>'page')::integer>p_pages OR (c->>'offset_end')::integer-(c->>'offset_start')::integer<>length(c->>'text') THEN RAISE EXCEPTION 'INVALID_PARSER_RESULT';END IF;
  INSERT INTO public.document_chunks(document_id,version_id,input_revision,ordinal,page,text,offset_start,offset_end,text_sha256,source_class)
  SELECT d.id,j.version_id,j.input_revision,ord,(c->>'page')::integer,c->>'text',(c->>'offset_start')::integer,(c->>'offset_end')::integer,c->>'text_sha256',v.source_class FROM public.document_versions v WHERE v.id=j.version_id;
  ord:=ord+1;pg:=(c->>'page')::integer;
 END LOOP;
 UPDATE public.document_versions SET extraction_status=p_status,page_count=p_pages,parser_version='cliniq-local-v1' WHERE id=j.version_id;
 UPDATE public.document_jobs SET status=CASE WHEN p_status='failed' THEN 'failed' ELSE 'succeeded' END,lease_until=NULL,error_code=CASE WHEN p_status='failed' THEN 'PARSER_FAILED' ELSE NULL END WHERE id=j.id;
 RETURN true;
END $$;
CREATE FUNCTION public.document_job_fail(p_job uuid,p_fence integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE public.document_jobs SET status=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END,available_at=now()+interval '30 seconds',lease_until=NULL,error_code='LOCAL_TASK_FAILED'
 WHERE id=p_job AND fence=p_fence AND status='running' AND lease_until>now();
 IF NOT FOUND THEN RETURN false;END IF;
 UPDATE public.document_versions v SET extraction_status='failed' WHERE EXISTS(SELECT 1 FROM public.document_jobs j JOIN public.documents d ON d.id=j.document_id WHERE j.id=p_job AND j.version_id=v.id AND j.status='failed' AND d.current_version_id=v.id AND d.revision=j.input_revision);
 RETURN true;END $$;
CREATE FUNCTION public.document_cleanup_claim() RETURNS SETOF public.upload_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 RETURN QUERY WITH c AS(SELECT id FROM public.upload_operations WHERE (state IN ('reserved','stored') AND expires_at<now()) OR (state IN ('cleaning','cleaned') AND coalesce(cleaned_at,'epoch')<now()-interval '15 minutes') ORDER BY coalesce(cleaned_at,created_at) FOR UPDATE SKIP LOCKED LIMIT 5)
 UPDATE public.upload_operations o SET state='cleaning',cleaned_at=now() FROM c WHERE o.id=c.id RETURNING o.*;
END $$;
CREATE FUNCTION public.document_cleanup_complete(p_operation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE op public.upload_operations; BEGIN
 SELECT patient_id INTO op.patient_id FROM public.upload_operations WHERE id=p_operation;
 PERFORM pg_advisory_xact_lock(hashtextextended(op.patient_id::text,0));
 SELECT * INTO op FROM public.upload_operations WHERE id=p_operation FOR UPDATE;
 IF op.state<>'cleaning' THEN RETURN;END IF;
 UPDATE public.upload_operations SET state='cleaned',cleaned_at=now() WHERE id=op.id;
 UPDATE public.documents SET status='upload_failed' WHERE id=op.document_id AND current_version_id IS NULL AND deleted_at IS NULL;
END $$;
CREATE FUNCTION public.document_purge_complete(p_job uuid,p_fence integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE j public.document_jobs;BEGIN
 SELECT * INTO j FROM public.document_jobs WHERE id=p_job FOR UPDATE;
 IF j.kind<>'purge_document' OR j.status<>'running' OR j.fence<>p_fence OR j.lease_until<=now() OR NOT EXISTS(SELECT 1 FROM public.documents WHERE id=j.document_id AND status='deleted' AND revision=j.input_revision) THEN RETURN false;END IF;
 DELETE FROM public.document_chunks WHERE document_id=j.document_id;
 UPDATE public.documents SET current_version_id=NULL WHERE id=j.document_id;
 UPDATE public.document_versions SET parent_version_id=NULL WHERE document_id=j.document_id;
 UPDATE public.upload_operations SET parent_version_id=NULL WHERE document_id=j.document_id;
 UPDATE public.document_jobs SET version_id=NULL WHERE document_id=j.document_id;
 DELETE FROM public.document_versions WHERE document_id=j.document_id;
 UPDATE public.document_jobs SET status='succeeded',lease_until=NULL WHERE id=j.id;RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.invalidate_document(uuid),private.enqueue_document(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.document_admit(uuid,text,text,text,integer,text,uuid,integer,uuid),public.document_change(uuid,integer,uuid,text,uuid,uuid),public.document_share_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.document_admit(uuid,text,text,text,integer,text,uuid,integer,uuid),public.document_change(uuid,integer,uuid,text,uuid,uuid),public.document_share_candidates() TO authenticated;
REVOKE ALL ON FUNCTION public.document_upload_stage(uuid,text),public.document_commit(uuid),public.document_claim(uuid),public.document_publish(uuid,integer,text,integer,jsonb),public.document_job_fail(uuid,integer),public.document_cleanup_claim(),public.document_cleanup_complete(uuid),public.document_purge_complete(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.document_upload_stage(uuid,text),public.document_commit(uuid),public.document_claim(uuid),public.document_publish(uuid,integer,text,integer,jsonb),public.document_job_fail(uuid,integer),public.document_cleanup_claim(),public.document_cleanup_complete(uuid),public.document_purge_complete(uuid,integer) TO service_role;
COMMIT;

