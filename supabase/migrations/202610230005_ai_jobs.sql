BEGIN;
-- Extend the existing durable queue; retain its original name and document
-- ingestion/purge semantics. No parallel database or second worker queue.
CREATE TABLE public.ai_threads(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES public.users(id),patient_id uuid NOT NULL REFERENCES public.patients(id),
 consultation_id uuid REFERENCES public.consultations(id),operation_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,operation_key)
);
ALTER TABLE public.clinical_drafts ADD COLUMN extraction_cursor integer NOT NULL DEFAULT -1 CHECK(extraction_cursor BETWEEN -1 AND 999);
ALTER TABLE public.document_jobs ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE public.document_jobs DROP CONSTRAINT document_jobs_kind_check;
ALTER TABLE public.document_jobs ADD CONSTRAINT document_jobs_kind_check CHECK(kind IN ('ingest_document','purge_document','answer_question','explain_document','extract_emr'));
ALTER TABLE public.document_jobs DROP CONSTRAINT document_jobs_status_check;
ALTER TABLE public.document_jobs ADD CONSTRAINT document_jobs_status_check CHECK(status IN ('queued','running','succeeded','failed','cancelled','outcome_unknown','unavailable','rejected','exhausted','stale'));
ALTER TABLE public.document_jobs ADD COLUMN thread_id uuid REFERENCES public.ai_threads(id);
ALTER TABLE public.document_jobs ADD COLUMN operation_key uuid;
ALTER TABLE public.document_jobs ADD COLUMN request jsonb;
ALTER TABLE public.document_jobs ADD COLUMN input_snapshot jsonb;
ALTER TABLE public.document_jobs ADD COLUMN source_hash text;
ALTER TABLE public.document_jobs ADD COLUMN result jsonb;
ALTER TABLE public.document_jobs ADD COLUMN result_kind text CHECK(result_kind IN ('generated','offline_fixture','evidence_only'));
ALTER TABLE public.document_jobs ADD COLUMN provider_attempt_id uuid;
ALTER TABLE public.document_jobs ADD CONSTRAINT jobs_resource_required CHECK((kind IN ('ingest_document','purge_document') AND document_id IS NOT NULL) OR (kind IN ('answer_question','explain_document','extract_emr') AND thread_id IS NOT NULL AND input_snapshot IS NOT NULL));
CREATE UNIQUE INDEX ai_job_operation ON public.document_jobs(actor_id,operation_key) WHERE operation_key IS NOT NULL;
CREATE TABLE public.provider_budgets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),authorization_ref text NOT NULL CHECK(length(authorization_ref) BETWEEN 1 AND 160),
 mode text NOT NULL CHECK(mode IN ('offline_fixture','live')),provider text NOT NULL CHECK(provider='groq'),model text NOT NULL CHECK(length(model) BETWEEN 1 AND 100),
 kind text NOT NULL CHECK(kind IN ('answer_question','explain_document','extract_emr')),
 enabled boolean NOT NULL DEFAULT false,synthetic_only boolean NOT NULL DEFAULT true CHECK(synthetic_only),
 allowed_actors uuid[] NOT NULL DEFAULT '{}',CHECK(NOT enabled OR cardinality(allowed_actors) BETWEEN 1 AND 20),
 starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 max_requests integer NOT NULL CHECK(max_requests BETWEEN 1 AND 60),max_input bigint NOT NULL CHECK(max_input BETWEEN 1 AND 1000000),max_output bigint NOT NULL CHECK(max_output BETWEEN 1 AND 200000),
 requests integer NOT NULL DEFAULT 0 CHECK(requests>=0),input_tokens bigint NOT NULL DEFAULT 0 CHECK(input_tokens>=0),output_tokens bigint NOT NULL DEFAULT 0 CHECK(output_tokens>=0),
 active integer NOT NULL DEFAULT 0 CHECK(active BETWEEN 0 AND 1),CHECK(requests<=max_requests AND input_tokens<=max_input AND output_tokens<=max_output)
);
CREATE TABLE public.provider_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid UNIQUE NOT NULL REFERENCES public.document_jobs(id),budget_id uuid NOT NULL REFERENCES public.provider_budgets(id),
 state text NOT NULL CHECK(state IN ('sent','responded','completed','outcome_unknown')),
 reserved_input integer NOT NULL CHECK(reserved_input>0),reserved_output integer NOT NULL CHECK(reserved_output>0),
 actual_input integer,actual_output integer,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz
);
-- One authorization counter spans all operation-specific budgets. A three-call
-- verification allowance cannot become nine calls by splitting job kinds.
CREATE TABLE public.provider_allowances(
 authorization_ref text PRIMARY KEY,mode text NOT NULL CHECK(mode IN ('offline_fixture','live')),provider text NOT NULL CHECK(provider='groq'),model text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 max_requests integer NOT NULL CHECK(max_requests BETWEEN 1 AND 60),max_input bigint NOT NULL CHECK(max_input BETWEEN 1 AND 1000000),max_output bigint NOT NULL CHECK(max_output BETWEEN 1 AND 200000),
 max_per_day integer NOT NULL DEFAULT 10 CHECK(max_per_day BETWEEN 1 AND 60),max_actor_day integer NOT NULL DEFAULT 3 CHECK(max_actor_day BETWEEN 1 AND 60),
 min_interval_seconds integer NOT NULL DEFAULT 60 CHECK(min_interval_seconds BETWEEN 0 AND 3600),next_send_at timestamptz NOT NULL DEFAULT now(),
 requests integer NOT NULL DEFAULT 0,input_tokens bigint NOT NULL DEFAULT 0,output_tokens bigint NOT NULL DEFAULT 0,
 CHECK(requests BETWEEN 0 AND max_requests AND input_tokens BETWEEN 0 AND max_input AND output_tokens BETWEEN 0 AND max_output),
 CHECK(mode='offline_fixture' OR (max_per_day<=10 AND max_actor_day<=3 AND min_interval_seconds>=60 AND ends_at-starts_at<=interval '30 days'))
);
CREATE TABLE public.provider_daily_usage(
 authorization_ref text NOT NULL REFERENCES public.provider_allowances(authorization_ref),actor_id uuid NOT NULL REFERENCES public.users(id),utc_day date NOT NULL,
 requests integer NOT NULL CHECK(requests>0),PRIMARY KEY(authorization_ref,actor_id,utc_day)
);
CREATE TABLE public.ai_budget_scope(
 actor_id uuid NOT NULL REFERENCES public.users(id),patient_id uuid NOT NULL REFERENCES public.patients(id),authorization_ref text NOT NULL,
 expires_at timestamptz NOT NULL,PRIMARY KEY(actor_id,patient_id,authorization_ref)
);
ALTER TABLE public.document_jobs ADD CONSTRAINT job_attempt_fk FOREIGN KEY(provider_attempt_id) REFERENCES public.provider_attempts(id);
ALTER TABLE public.document_jobs ADD COLUMN result_state text CHECK(result_state IN ('succeeded','rejected','unavailable'));
ALTER TABLE public.document_jobs ADD COLUMN result_provider text;
ALTER TABLE public.document_jobs ADD COLUMN result_model text;
ALTER TABLE public.document_jobs ADD COLUMN execution_mode text;
ALTER TABLE public.document_jobs ADD COLUMN prompt_version text NOT NULL DEFAULT 'cliniq-source-review-v1';
ALTER TABLE public.document_jobs ADD COLUMN retrieval_version text NOT NULL DEFAULT 'postgres-authorized-lexical-v1';
ALTER TABLE public.document_jobs ADD COLUMN schema_version text NOT NULL DEFAULT '1';
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['ai_threads','provider_budgets','provider_attempts','ai_budget_scope','provider_allowances','provider_daily_usage'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
END LOOP;END $$;
CREATE FUNCTION private.actor_thread(a uuid,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.ai_threads x JOIN public.users u ON u.id=x.owner_id WHERE x.id=t AND x.owner_id=a AND u.is_active AND
 ((u.role='patient' AND EXISTS(SELECT 1 FROM public.patients p WHERE p.id=x.patient_id AND p.user_id=a)) OR (u.role='doctor' AND private.actor_can_edit_encounter(a,x.consultation_id))))
$$;
CREATE FUNCTION private.actor_document(a uuid,d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.documents x JOIN public.patients p ON p.id=x.patient_id JOIN public.users u ON u.id=a WHERE x.id=d AND x.status='ready' AND x.deleted_at IS NULL AND u.is_active AND
 ((u.role='patient' AND p.user_id=a) OR (u.role='doctor' AND EXISTS(SELECT 1 FROM public.document_grants g JOIN public.workspace_memberships m ON m.workspace_id=g.workspace_id AND m.user_id=g.provider_id WHERE g.document_id=d AND g.provider_id=a AND g.granted_by=x.created_by AND g.revoked_at IS NULL AND m.status='active' AND m.role='doctor' AND EXISTS(SELECT 1 FROM public.care_relationships r WHERE r.patient_id=p.id AND r.provider_id=a AND r.workspace_id=g.workspace_id AND r.scope='clinical' AND r.revoked_at IS NULL)))))
$$;
CREATE FUNCTION private.actor_thread_document(a uuid,t uuid,d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT private.actor_document(a,d) AND EXISTS(SELECT 1 FROM public.ai_threads x WHERE x.id=t AND (x.consultation_id IS NULL OR EXISTS(SELECT 1 FROM public.consultations c JOIN public.document_grants g ON g.workspace_id=c.workspace_id WHERE c.id=x.consultation_id AND g.document_id=d AND g.provider_id=a AND g.revoked_at IS NULL)))
$$;
CREATE FUNCTION private.actor_thread_version(a uuid,t uuid,v uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.emr_versions e JOIN public.consultations c ON c.id=e.consultation_id JOIN public.patients p ON p.id=c.patient_id JOIN public.ai_threads x ON x.patient_id=p.id WHERE e.id=v AND x.id=t AND ((p.user_id=a AND x.consultation_id IS NULL) OR (private.actor_can_edit_encounter(a,c.id) AND c.workspace_id=(SELECT workspace_id FROM public.consultations WHERE id=x.consultation_id))))
$$;
REVOKE ALL ON FUNCTION private.actor_thread_document(uuid,uuid,uuid),private.actor_thread_version(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.ai_sources_current(j public.document_jobs) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;BEGIN
 IF NOT private.actor_thread(j.actor_id,j.thread_id) THEN RETURN false;END IF;
 IF j.kind='extract_emr' AND NOT EXISTS(SELECT 1 FROM public.ai_threads t JOIN public.consultations c ON c.id=t.consultation_id WHERE t.id=j.thread_id AND c.status='active') THEN RETURN false;END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(j.input_snapshot->'sources') LOOP
 IF s->>'sourceType'=ANY(ARRAY['document','manual_transcript']) THEN
 IF NOT private.actor_thread_document(j.actor_id,j.thread_id,(s->>'documentId')::uuid) OR NOT EXISTS(SELECT 1 FROM public.documents d JOIN public.document_chunks ch ON ch.document_id=d.id WHERE d.id=(s->>'documentId')::uuid AND d.current_version_id=(s->>'versionId')::uuid AND d.revision=(s->>'revision')::integer AND ch.id=(s->>'chunkId')::uuid AND ch.version_id=d.current_version_id AND ch.input_revision=d.revision AND ch.text=s->>'text' AND ch.text_sha256=s->>'contentSha256') THEN RETURN false; END IF;
 ELSIF s->>'sourceType'='approved_emr' THEN
 IF NOT private.actor_thread_version(j.actor_id,j.thread_id,(s->>'versionId')::uuid) OR EXISTS(SELECT 1 FROM public.emr_versions v WHERE v.amended_from_id=(s->>'versionId')::uuid) THEN RETURN false;END IF;
 ELSIF s->>'sourceType'='transcript' THEN
 IF NOT EXISTS(SELECT 1 FROM public.clinical_segments x JOIN public.ai_threads t ON t.consultation_id=x.consultation_id WHERE t.id=j.thread_id AND x.id=(s->>'segmentId')::uuid AND x.text=s->>'text') THEN RETURN false;END IF;
 ELSE RETURN false; END IF;
 END LOOP;RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.actor_thread(uuid,uuid),private.actor_document(uuid,uuid),private.ai_sources_current(public.document_jobs) FROM PUBLIC,anon,authenticated;
-- Policy wrappers do not reveal worker inputs or grant unscoped capabilities.
CREATE FUNCTION private.owns_ai_thread(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$SELECT private.actor_thread(private.current_app_user_id(),t)$$;
CREATE FUNCTION private.read_ai_job(jid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$SELECT EXISTS(SELECT 1 FROM public.document_jobs j WHERE j.id=jid AND j.actor_id=private.current_app_user_id() AND private.ai_sources_current(j))$$;
REVOKE ALL ON FUNCTION private.owns_ai_thread(uuid),private.read_ai_job(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.owns_ai_thread(uuid),private.read_ai_job(uuid) TO authenticated;
CREATE POLICY threads_owner ON public.ai_threads FOR SELECT TO authenticated USING(private.owns_ai_thread(id));
GRANT SELECT ON public.ai_threads TO authenticated;
DROP POLICY jobs_owner ON public.document_jobs;
CREATE POLICY jobs_owner ON public.document_jobs FOR SELECT TO authenticated USING(actor_id=private.current_app_user_id() AND (kind IN ('ingest_document','purge_document') OR private.read_ai_job(id)));

CREATE FUNCTION public.ai_thread_create(k uuid,cid uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();p uuid;t public.ai_threads;BEGIN
 IF a IS NULL OR k IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||k::text,0));
 SELECT * INTO t FROM public.ai_threads WHERE owner_id=a AND operation_key=k;
 IF FOUND THEN IF t.consultation_id IS DISTINCT FROM cid THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;IF NOT private.actor_thread(a,t.id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN t.id;END IF;
 IF cid IS NOT NULL THEN IF NOT private.can_edit_encounter(cid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;SELECT patient_id INTO p FROM public.consultations WHERE id=cid;
 ELSE SELECT x.id INTO p FROM public.patients x JOIN public.users u ON u.id=x.user_id WHERE x.user_id=a AND u.role='patient';END IF;
 IF p IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF (SELECT count(*) FROM public.ai_threads WHERE owner_id=a)>=50 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 INSERT INTO public.ai_threads(owner_id,patient_id,consultation_id,operation_key) VALUES(a,p,cid,k) RETURNING * INTO t;RETURN t.id;
END $$;
REVOKE ALL ON FUNCTION public.ai_thread_create(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_thread_create(uuid,uuid) TO authenticated;

CREATE FUNCTION private.retrieval_vector(source_text text) RETURNS tsvector LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT to_tsvector('english',regexp_replace(regexp_replace(source_text,'([[:alpha:]])([0-9])','\1 \2','g'),'([0-9])([[:alpha:]])','\1 \2','g'))
$$;
REVOKE ALL ON FUNCTION private.retrieval_vector(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ai_admit(k uuid,tid uuid,job_kind text,q text,documents uuid[] DEFAULT '{}',versions uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();t public.ai_threads;j public.document_jobs;req jsonb;input jsonb;sources jsonb;query tsquery;lexemes text;d public.clinical_drafts;cursor_id uuid;cursor_seq integer;
BEGIN
 IF k IS NULL OR a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF NOT private.actor_thread(a,tid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF job_kind IS NULL OR job_kind<>ALL(ARRAY['answer_question','explain_document','extract_emr']) OR q IS NULL OR length(btrim(q)) NOT BETWEEN 2 AND 500 OR cardinality(documents)>6 OR cardinality(versions)>6 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 req:=jsonb_build_object('threadId',tid,'kind',job_kind,'question',q,'documents',documents,'versions',versions);
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||k::text,0));
 SELECT * INTO j FROM public.document_jobs WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF j.request<>req THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN j.id;END IF;
 IF (SELECT count(*) FROM public.document_jobs WHERE actor_id=a AND thread_id IS NOT NULL AND created_at>now()-interval '1 day')>=30 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF (SELECT count(*) FROM public.document_jobs WHERE actor_id=a AND thread_id IS NOT NULL)>=200 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 SELECT * INTO t FROM public.ai_threads WHERE id=tid;
 IF job_kind='extract_emr' THEN
 IF t.consultation_id IS NULL OR NOT private.can_edit_encounter(t.consultation_id) OR NOT EXISTS(SELECT 1 FROM public.consultations WHERE id=t.consultation_id AND status='active') THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 PERFORM 1 FROM public.consultations WHERE id=t.consultation_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.document_jobs jx JOIN public.ai_threads tx ON tx.id=jx.thread_id WHERE tx.consultation_id=t.consultation_id AND jx.kind='extract_emr' AND jx.status IN ('queued','running')) THEN RAISE EXCEPTION 'EXTRACTION_PENDING';END IF;
 SELECT * INTO d FROM public.clinical_drafts WHERE consultation_id=t.consultation_id FOR UPDATE;
 SELECT id,sequence INTO cursor_id,cursor_seq FROM public.clinical_segments WHERE consultation_id=t.consultation_id AND sequence>d.extraction_cursor ORDER BY sequence DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('evidenceId','segment:'||id,'sourceType','transcript','segmentId',id,'versionId',id,'sequence',sequence,'text',text,'speaker',speaker,'language',language) ORDER BY sequence),'[]') INTO sources FROM public.clinical_segments WHERE consultation_id=t.consultation_id AND sequence>d.extraction_cursor;
 IF cursor_id IS NULL THEN RAISE EXCEPTION 'NO_NEW_TRANSCRIPT';END IF;
 IF octet_length(sources::text)>40000 THEN RAISE EXCEPTION 'CONTEXT_LIMIT';END IF;
 input:=jsonb_build_object('sources',sources,'baseRevision',d.revision,'throughSegmentId',cursor_id,'fromSequence',d.extraction_cursor+1,'throughSequence',cursor_seq,'draft',d.snapshot,'question',q);
 ELSE
 -- Authorization is materialized before ranking. Caller-selected IDs never
 -- broaden access; a denied selected source fails admission rather than leaks.
 IF EXISTS(SELECT 1 FROM unnest(documents) x WHERE NOT private.actor_thread_document(a,tid,x) OR NOT EXISTS(SELECT 1 FROM public.documents z WHERE z.id=x AND z.patient_id=t.patient_id)) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF EXISTS(SELECT 1 FROM unnest(versions) x WHERE NOT private.actor_thread_version(a,tid,x)) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT string_agg(quote_literal(x),' | ') INTO lexemes FROM unnest(tsvector_to_array(private.retrieval_vector(q))) x;
 query:=coalesce(to_tsquery('english',lexemes),''::tsquery);
 WITH authorized AS MATERIALIZED(
 SELECT ch.text,jsonb_build_object('evidenceId','chunk:'||ch.id,'sourceType',CASE WHEN ch.source_class='manual' THEN 'manual_transcript' ELSE 'document' END,'documentId',doc.id,'versionId',ch.version_id,'revision',doc.revision,'chunkId',ch.id,'title',doc.title,'date',doc.created_at,'page',ch.page,'offsetStart',ch.offset_start,'offsetEnd',ch.offset_end,'text',ch.text,'contentSha256',ch.text_sha256) ref
 FROM public.document_chunks ch JOIN public.documents doc ON doc.id=ch.document_id WHERE doc.patient_id=t.patient_id AND doc.status='ready' AND ch.version_id=doc.current_version_id AND ch.input_revision=doc.revision AND private.actor_thread_document(a,tid,doc.id) AND (doc.id=ANY(documents) OR (cardinality(documents)=0 AND cardinality(versions)=0))
 UNION ALL SELECT left(v.snapshot::text,7500),jsonb_build_object('evidenceId','approved:'||v.id,'sourceType','approved_emr','versionId',v.id,'title','Approved consultation','date',v.reviewed_at,'text',left(v.snapshot::text,7500),'contentSha256',v.content_sha256,'excerpt',true)
 FROM public.emr_versions v JOIN public.consultations c ON c.id=v.consultation_id JOIN public.patients p ON p.id=c.patient_id WHERE p.id=t.patient_id AND private.actor_thread_version(a,tid,v.id) AND (v.id=ANY(versions) OR (cardinality(documents)=0 AND cardinality(versions)=0)) AND NOT EXISTS(SELECT 1 FROM public.emr_versions newer WHERE newer.amended_from_id=v.id)
 ),ranked AS(SELECT text,ref,ts_rank_cd(private.retrieval_vector(text),query) rank FROM authorized WHERE private.retrieval_vector(text)@@query OR (cardinality(documents)>0 AND q~*'(summari[sz]|explain|instructions|plot)') ORDER BY rank DESC,ref->>'evidenceId' LIMIT 6),bounded AS(SELECT *,sum(length(text)) OVER(ORDER BY rank DESC,ref->>'evidenceId') total FROM ranked)
 SELECT coalesce(jsonb_agg(ref ORDER BY rank DESC,ref->>'evidenceId'),'[]') INTO sources FROM bounded WHERE total<=10000;
 input:=jsonb_build_object('sources',sources,'question',q);
 END IF;
 INSERT INTO public.document_jobs(actor_id,input_revision,kind,thread_id,operation_key,request,input_snapshot,source_hash)
 VALUES(a,coalesce(d.revision,0),job_kind,tid,k,req,input,encode(extensions.digest(convert_to(input::text,'UTF8'),'sha256'),'hex')) RETURNING * INTO j;RETURN j.id;
END $$;
REVOKE ALL ON FUNCTION public.ai_admit(uuid,uuid,text,text,uuid[],uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_admit(uuid,uuid,text,text,uuid[],uuid[]) TO authenticated;
CREATE FUNCTION public.ai_source_choices(tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();p uuid;docs jsonb;BEGIN
 IF NOT private.actor_thread(a,tid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;SELECT patient_id INTO p FROM public.ai_threads WHERE id=tid;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'versionId',v.id,'extractionStatus',v.extraction_status) ORDER BY d.created_at DESC),'[]') INTO docs FROM public.documents d JOIN public.document_versions v ON v.id=d.current_version_id WHERE d.patient_id=p AND private.actor_thread_document(a,tid,d.id);
 RETURN jsonb_build_object('documents',docs);
END $$;
REVOKE ALL ON FUNCTION public.ai_source_choices(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_source_choices(uuid) TO authenticated;

-- Old parser entry point must never claim newly admitted AI work.
CREATE OR REPLACE FUNCTION public.document_claim(p_id uuid DEFAULT NULL) RETURNS SETOF public.document_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE public.document_jobs SET status='failed',error_code='ATTEMPTS_EXHAUSTED',lease_until=NULL WHERE kind IN ('ingest_document','purge_document') AND status='running' AND lease_until<now() AND attempts>=3;
 UPDATE public.document_versions v SET extraction_status='failed' WHERE EXISTS(SELECT 1 FROM public.document_jobs j JOIN public.documents d ON d.id=j.document_id WHERE j.version_id=v.id AND j.status='failed' AND j.attempts>=3 AND d.current_version_id=v.id AND d.revision=j.input_revision);
 RETURN QUERY WITH candidate AS(SELECT id FROM public.document_jobs WHERE kind IN ('ingest_document','purge_document') AND (p_id IS NULL OR id=p_id) AND attempts<3 AND available_at<=now() AND (status='queued' OR (status='running' AND lease_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
 UPDATE public.document_jobs j SET status='running',fence=fence+1,attempts=attempts+1,lease_until=now()+interval '90 seconds' FROM candidate c WHERE j.id=c.id RETURNING j.*;
END $$;
CREATE FUNCTION private.ai_lock_sources(jid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;t public.ai_threads;BEGIN
 SELECT * INTO j FROM public.document_jobs WHERE id=jid;SELECT * INTO t FROM public.ai_threads WHERE id=j.thread_id;
 PERFORM 1 FROM public.users WHERE id=j.actor_id FOR SHARE;
 IF t.consultation_id IS NOT NULL THEN PERFORM 1 FROM public.consultations WHERE id=t.consultation_id FOR UPDATE;END IF;
 PERFORM 1 FROM public.documents d WHERE d.id IN(SELECT (s->>'documentId')::uuid FROM jsonb_array_elements(j.input_snapshot->'sources') s WHERE s ? 'documentId') ORDER BY d.id FOR SHARE;
 -- Resource locks precede job locks, matching document revoke/finalization.
END $$;
REVOKE ALL ON FUNCTION private.ai_lock_sources(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.ai_recover() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;pa public.provider_attempts;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ai-global-send',0));
 FOR j IN SELECT x.* FROM public.document_jobs x WHERE x.thread_id IS NOT NULL AND x.lease_until<now() AND (x.status='running' OR EXISTS(SELECT 1 FROM public.provider_attempts p WHERE p.job_id=x.id AND p.state='sent')) ORDER BY x.created_at FOR UPDATE SKIP LOCKED LIMIT 10 LOOP
 SELECT * INTO pa FROM public.provider_attempts WHERE job_id=j.id FOR UPDATE;
 IF FOUND AND pa.state='sent' THEN
 UPDATE public.provider_attempts SET state='outcome_unknown',finished_at=now() WHERE id=pa.id;
 UPDATE public.provider_budgets SET active=greatest(active-1,0) WHERE id=pa.budget_id;
 UPDATE public.document_jobs SET status=CASE WHEN status IN ('cancelled','stale') THEN status ELSE 'outcome_unknown' END,lease_until=NULL,error_code='OUTCOME_UNKNOWN' WHERE id=j.id;
 ELSIF j.status='running' THEN
 UPDATE public.document_jobs SET status=CASE WHEN j.attempts>=3 THEN 'failed' ELSE 'queued' END,lease_until=NULL,error_code=CASE WHEN j.attempts>=3 THEN 'ATTEMPTS_EXHAUSTED' ELSE 'LEASE_EXPIRED' END WHERE id=j.id;
 END IF;END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.ai_recover() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ai_reconcile() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT private.ai_recover() $$;
REVOKE ALL ON FUNCTION public.ai_reconcile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_reconcile() TO service_role;
CREATE FUNCTION public.ai_claim(p_id uuid DEFAULT NULL) RETURNS SETOF public.document_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;pa public.provider_attempts;BEGIN
 PERFORM private.ai_recover();
 SELECT * INTO j FROM public.document_jobs WHERE thread_id IS NOT NULL AND status='queued' AND available_at<=now() AND attempts<3 AND (p_id IS NULL OR id=p_id) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN;END IF;
 IF NOT private.ai_sources_current(j) THEN UPDATE public.document_jobs SET status='stale',result=NULL,error_code='SOURCE_STALE' WHERE id=j.id;RETURN;END IF;
 UPDATE public.document_jobs SET status='running',fence=fence+1,attempts=attempts+1,lease_until=now()+interval '90 seconds' WHERE id=j.id RETURNING * INTO j;RETURN NEXT j;
END $$;
CREATE FUNCTION public.ai_reserve(jid uuid,f integer,execution_mode text,model_name text,input_bound integer,output_bound integer,budget_ref text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;b public.provider_budgets;g public.provider_allowances;aid uuid;day_key date:=(now() AT TIME ZONE 'UTC')::date;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ai-global-send',0));
 SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;
 IF NOT FOUND OR j.thread_id IS NULL OR j.status<>'running' OR j.fence<>f OR j.lease_until<=now() OR j.provider_attempt_id IS NOT NULL THEN RETURN NULL;END IF;
 IF NOT private.ai_sources_current(j) THEN UPDATE public.document_jobs SET status='stale',result=NULL,error_code='SOURCE_STALE',lease_until=NULL WHERE id=jid;RETURN NULL;END IF;
 IF execution_mode IS NULL OR execution_mode<>ALL(ARRAY['offline_fixture','live']) OR input_bound NOT BETWEEN 1 AND 50000 OR output_bound NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'INVALID_BUDGET';END IF;
 SELECT * INTO b FROM public.provider_budgets b0 WHERE enabled AND synthetic_only AND j.actor_id=ANY(allowed_actors) AND mode=execution_mode AND model=model_name AND kind=j.kind AND authorization_ref=budget_ref AND starts_at<=now() AND ends_at>now() AND EXISTS(SELECT 1 FROM public.ai_budget_scope s JOIN public.ai_threads t ON t.patient_id=s.patient_id WHERE s.actor_id=j.actor_id AND t.id=j.thread_id AND s.authorization_ref=b0.authorization_ref AND s.expires_at>now()) ORDER BY starts_at,id FOR UPDATE LIMIT 1;
 IF NOT FOUND THEN UPDATE public.document_jobs SET status='unavailable',result_kind='evidence_only',error_code='PROVIDER_DISABLED',lease_until=NULL WHERE id=jid;RETURN NULL;END IF;
 SELECT * INTO g FROM public.provider_allowances WHERE authorization_ref=b.authorization_ref AND enabled AND mode=b.mode AND provider=b.provider AND model=b.model AND starts_at<=now() AND ends_at>now() FOR UPDATE;
 IF NOT FOUND THEN UPDATE public.document_jobs SET status='unavailable',result_kind='evidence_only',error_code='PROVIDER_DISABLED',lease_until=NULL WHERE id=jid;RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM public.provider_budgets WHERE active>0) THEN UPDATE public.document_jobs SET status='queued',available_at=now()+interval '30 seconds',lease_until=NULL,error_code='CONCURRENCY_LIMIT' WHERE id=jid;RETURN NULL;END IF;
 IF b.mode='live' AND g.next_send_at>now() THEN UPDATE public.document_jobs SET status='queued',available_at=g.next_send_at,lease_until=NULL,error_code='MINUTE_PACING' WHERE id=jid;RETURN NULL;END IF;
 IF b.requests+1>b.max_requests OR b.input_tokens+input_bound>b.max_input OR b.output_tokens+output_bound>b.max_output OR g.requests+1>g.max_requests OR g.input_tokens+input_bound>g.max_input OR g.output_tokens+output_bound>g.max_output OR (SELECT coalesce(sum(requests),0) FROM public.provider_daily_usage WHERE authorization_ref=g.authorization_ref AND utc_day=day_key)>=g.max_per_day OR (SELECT coalesce(sum(requests),0) FROM public.provider_daily_usage WHERE authorization_ref=g.authorization_ref AND utc_day=day_key AND actor_id=j.actor_id)>=g.max_actor_day THEN UPDATE public.document_jobs SET status='exhausted',result_kind='evidence_only',error_code='BUDGET_EXHAUSTED',lease_until=NULL WHERE id=jid;RETURN NULL;END IF;
 UPDATE public.provider_budgets SET requests=requests+1,input_tokens=input_tokens+input_bound,output_tokens=output_tokens+output_bound,active=active+1 WHERE id=b.id;
 UPDATE public.provider_allowances SET requests=requests+1,input_tokens=input_tokens+input_bound,output_tokens=output_tokens+output_bound,next_send_at=CASE WHEN mode='live' THEN now()+make_interval(secs=>min_interval_seconds) ELSE next_send_at END WHERE authorization_ref=g.authorization_ref;
 INSERT INTO public.provider_daily_usage(authorization_ref,actor_id,utc_day,requests) VALUES(g.authorization_ref,j.actor_id,day_key,1) ON CONFLICT(authorization_ref,actor_id,utc_day) DO UPDATE SET requests=public.provider_daily_usage.requests+1;
 -- Marker precedes transmission. A crash between this commit and the send is
 -- conservatively uncertain, never a free retry of a potentially billable call.
 INSERT INTO public.provider_attempts(job_id,budget_id,state,reserved_input,reserved_output) VALUES(jid,b.id,'sent',input_bound,output_bound) RETURNING id INTO aid;
 UPDATE public.document_jobs SET provider_attempt_id=aid,result_provider=b.provider,result_model=b.model,execution_mode=b.mode WHERE id=jid;RETURN aid;
END $$;
CREATE FUNCTION public.ai_record_response(jid uuid,f integer,aid uuid,p_result jsonb,p_kind text,p_state text,used_input integer,used_output integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;p public.provider_attempts;BEGIN
 PERFORM private.ai_lock_sources(jid);
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ai-global-send',0));
 SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;SELECT * INTO p FROM public.provider_attempts WHERE id=aid AND job_id=jid FOR UPDATE;
 IF NOT FOUND OR j.fence<>f OR p.state<>'sent' THEN RETURN false;END IF;
 IF p_kind IS NULL OR p_kind IS DISTINCT FROM (CASE WHEN j.execution_mode='offline_fixture' THEN 'offline_fixture' ELSE 'generated' END) OR p_state IS NULL OR p_state<>ALL(ARRAY['succeeded','rejected','unavailable']) OR p_result IS NULL OR octet_length(p_result::text)>50000 THEN RAISE EXCEPTION 'INVALID_RESULT';END IF;
 -- Known usage may release unused token reservation; missing/invalid usage
 -- retains the conservative bound. Rejection still consumes its attempt.
 used_input:=CASE WHEN used_input BETWEEN 0 AND p.reserved_input THEN used_input ELSE p.reserved_input END;
 used_output:=CASE WHEN used_output BETWEEN 0 AND p.reserved_output THEN used_output ELSE p.reserved_output END;
 UPDATE public.provider_budgets SET active=greatest(active-1,0),input_tokens=input_tokens-p.reserved_input+used_input,output_tokens=output_tokens-p.reserved_output+used_output WHERE id=p.budget_id;
 UPDATE public.provider_allowances SET input_tokens=input_tokens-p.reserved_input+used_input,output_tokens=output_tokens-p.reserved_output+used_output WHERE authorization_ref=(SELECT authorization_ref FROM public.provider_budgets WHERE id=p.budget_id);
 UPDATE public.provider_attempts SET state='responded',actual_input=used_input,actual_output=used_output,finished_at=now() WHERE id=aid;
 IF j.status<>'running' OR j.lease_until<=now() OR NOT private.ai_sources_current(j) THEN UPDATE public.document_jobs SET status=CASE WHEN j.status='cancelled' THEN 'cancelled' ELSE 'stale' END,result=NULL,lease_until=NULL,error_code='SOURCE_STALE' WHERE id=jid;RETURN false;END IF;
 UPDATE public.document_jobs SET result=p_result,result_kind=p_kind,result_state=p_state WHERE id=jid;RETURN true;
END $$;
CREATE FUNCTION public.ai_publish(jid uuid,f integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;p public.provider_attempts;t public.ai_threads;pid uuid;BEGIN
 PERFORM private.ai_lock_sources(jid);
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ai-global-send',0));
 SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' OR j.fence<>f OR j.lease_until<=now() OR j.result IS NULL THEN RETURN false;END IF;
 SELECT * INTO p FROM public.provider_attempts WHERE id=j.provider_attempt_id FOR UPDATE;
 IF NOT FOUND OR p.state<>'responded' THEN RETURN false;END IF;
 IF NOT private.ai_sources_current(j) THEN UPDATE public.document_jobs SET status='stale',result=NULL,lease_until=NULL,error_code='SOURCE_STALE' WHERE id=jid;RETURN false;END IF;
 IF j.kind='extract_emr' AND j.result_state='succeeded' THEN
 SELECT * INTO t FROM public.ai_threads WHERE id=j.thread_id;
 pid:=public.clinical_offer(j.actor_id,t.consultation_id,jsonb_build_object('baseRevision',j.input_snapshot->'baseRevision','throughSegmentId',j.input_snapshot->'throughSegmentId','operations',j.result->'operations'),'offline_fixture');
 UPDATE public.clinical_proposals SET result_kind=j.result_kind WHERE id=pid;
 UPDATE public.clinical_drafts SET extraction_cursor=greatest(extraction_cursor,(j.input_snapshot->>'throughSequence')::integer) WHERE consultation_id=t.consultation_id;
 UPDATE public.document_jobs SET result=jsonb_build_object('proposalId',pid,'requiresReview',true) WHERE id=jid;
 END IF;
 UPDATE public.provider_attempts SET state='completed' WHERE id=p.id;
 UPDATE public.document_jobs SET status=result_state,lease_until=NULL,error_code=CASE WHEN result_state='rejected' THEN 'OUTPUT_REJECTED' WHEN result_state='unavailable' THEN result->>'reason' ELSE NULL END WHERE id=jid;RETURN true;
END $$;
CREATE FUNCTION public.ai_unknown(jid uuid,f integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;p public.provider_attempts;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ai-global-send',0));
 SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;
 SELECT * INTO p FROM public.provider_attempts WHERE id=j.provider_attempt_id FOR UPDATE;
 IF NOT FOUND OR j.fence<>f OR p.state<>'sent' THEN RETURN;END IF;
 UPDATE public.provider_attempts SET state='outcome_unknown',finished_at=now() WHERE id=p.id;
 UPDATE public.provider_budgets SET active=greatest(active-1,0) WHERE id=p.budget_id;
 UPDATE public.document_jobs SET status=CASE WHEN status IN ('stale','cancelled') THEN status ELSE 'outcome_unknown' END,error_code='OUTCOME_UNKNOWN',lease_until=NULL,result=NULL WHERE id=jid;
END $$;
CREATE FUNCTION public.ai_evidence_only(jid uuid,f integer,reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;BEGIN
 PERFORM private.ai_lock_sources(jid);
 SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' OR j.fence<>f OR j.lease_until<=now() OR j.provider_attempt_id IS NOT NULL THEN RETURN false;END IF;
 IF NOT private.ai_sources_current(j) THEN UPDATE public.document_jobs SET status='stale',lease_until=NULL,result=NULL,error_code='SOURCE_STALE' WHERE id=jid;RETURN false;END IF;
 IF reason IS NULL OR reason<>ALL(ARRAY['PROVIDER_DISABLED','INSUFFICIENT_EVIDENCE','UNSUPPORTED_ADVICE']) THEN RAISE EXCEPTION 'INVALID_REASON';END IF;
 UPDATE public.document_jobs SET status=CASE WHEN reason='PROVIDER_DISABLED' THEN 'unavailable' ELSE 'succeeded' END,result_kind='evidence_only',result=jsonb_build_object('answerKind','insufficient_evidence','reason',reason),lease_until=NULL,error_code=reason WHERE id=jid;RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ai_claim(uuid),public.ai_reserve(uuid,integer,text,text,integer,integer,text),public.ai_record_response(uuid,integer,uuid,jsonb,text,text,integer,integer),public.ai_publish(uuid,integer),public.ai_unknown(uuid,integer),public.ai_evidence_only(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_claim(uuid),public.ai_reserve(uuid,integer,text,text,integer,integer,text),public.ai_record_response(uuid,integer,uuid,jsonb,text,text,integer,integer),public.ai_publish(uuid,integer),public.ai_unknown(uuid,integer),public.ai_evidence_only(uuid,integer,text) TO service_role;

CREATE FUNCTION private.invalidate_ai_sources() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='documents' THEN
 UPDATE public.document_jobs j SET status='stale',result=NULL,error_code='SOURCE_STALE' WHERE j.thread_id IS NOT NULL AND j.status NOT IN ('failed','cancelled','outcome_unknown','stale') AND (EXISTS(SELECT 1 FROM jsonb_array_elements(j.input_snapshot->'sources') s WHERE s->>'documentId'=NEW.id::text) OR (j.request->'documents') ? NEW.id::text);
 IF NEW.status='deleted' THEN
 UPDATE public.document_jobs j SET input_snapshot=jsonb_set(j.input_snapshot,'{sources}',(SELECT coalesce(jsonb_agg(CASE WHEN s->>'documentId'=NEW.id::text THEN (s-'text')||jsonb_build_object('redacted',true) ELSE s END),'[]') FROM jsonb_array_elements(j.input_snapshot->'sources') s)),result=NULL WHERE j.thread_id IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(j.input_snapshot->'sources') s WHERE s->>'documentId'=NEW.id::text);
 END IF;
 ELSE
 IF NEW.amended_from_id IS NOT NULL THEN UPDATE public.document_jobs j SET status='stale',result=NULL,error_code='SOURCE_STALE' WHERE j.thread_id IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(j.input_snapshot->'sources') s WHERE s->>'versionId'=NEW.amended_from_id::text);END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.invalidate_ai_sources() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ai_document_invalidation AFTER UPDATE OF revision,current_version_id,status ON public.documents FOR EACH ROW WHEN(OLD.revision IS DISTINCT FROM NEW.revision OR OLD.current_version_id IS DISTINCT FROM NEW.current_version_id OR OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION private.invalidate_ai_sources();
CREATE TRIGGER ai_approval_invalidation AFTER INSERT ON public.emr_versions FOR EACH ROW EXECUTE FUNCTION private.invalidate_ai_sources();
CREATE FUNCTION private.invalidate_ai_grant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE public.document_jobs j SET status='cancelled',result=NULL,error_code='ACCESS_REVOKED' WHERE j.thread_id IS NOT NULL AND j.actor_id=NEW.provider_id AND EXISTS(SELECT 1 FROM public.ai_threads t JOIN public.consultations c ON c.id=t.consultation_id WHERE t.id=j.thread_id AND c.workspace_id=NEW.workspace_id) AND EXISTS(SELECT 1 FROM jsonb_array_elements(j.input_snapshot->'sources') s WHERE s->>'documentId'=NEW.document_id::text);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.invalidate_ai_grant() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ai_grant_invalidation AFTER UPDATE OF revoked_at ON public.document_grants FOR EACH ROW WHEN(OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL) EXECUTE FUNCTION private.invalidate_ai_grant();
CREATE FUNCTION private.validate_clinical_proposal_shape() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;op jsonb;BEGIN
 SELECT snapshot INTO s FROM public.clinical_drafts WHERE consultation_id=NEW.consultation_id;
 FOR op IN SELECT value FROM jsonb_array_elements(NEW.operations) LOOP
 IF op->>'op'=ANY(ARRAY['set_fact','update_fact']) THEN s:=jsonb_set(s,ARRAY[op->>'path'],op->'value');END IF;
 END LOOP;PERFORM private.validate_clinical_snapshot(s);RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_clinical_proposal_shape() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER clinical_proposal_shape BEFORE INSERT ON public.clinical_proposals FOR EACH ROW EXECUTE FUNCTION private.validate_clinical_proposal_shape();
NOTIFY pgrst,'reload schema';
COMMIT;
