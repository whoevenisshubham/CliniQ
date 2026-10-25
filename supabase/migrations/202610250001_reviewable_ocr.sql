BEGIN;
-- Additive, seed-free. Prepared for isolated rehearsal; no hosted apply.
ALTER TABLE public.document_jobs DROP CONSTRAINT document_jobs_kind_check;
ALTER TABLE public.document_jobs ADD CONSTRAINT document_jobs_kind_check CHECK(kind IN ('ingest_document','purge_document','answer_question','explain_document','extract_emr','ocr_document'));
ALTER TABLE public.document_jobs DROP CONSTRAINT jobs_resource_required;
ALTER TABLE public.document_jobs ADD CONSTRAINT jobs_resource_required CHECK((kind IN ('ingest_document','purge_document') AND document_id IS NOT NULL) OR (kind IN ('answer_question','explain_document','extract_emr','ocr_document') AND thread_id IS NOT NULL AND input_snapshot IS NOT NULL));
ALTER TABLE public.document_jobs DROP CONSTRAINT document_jobs_document_id_version_id_input_revision_kind_key;
CREATE UNIQUE INDEX document_local_job_once ON public.document_jobs(document_id,version_id,input_revision,kind) WHERE kind IN ('ingest_document','purge_document');
CREATE UNIQUE INDEX ocr_source_once ON public.document_jobs(actor_id,document_id,version_id,input_revision) WHERE kind='ocr_document';
CREATE OR REPLACE FUNCTION private.invalidate_document(p_document uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE public.document_jobs SET status='cancelled',lease_until=CASE WHEN kind='ocr_document' THEN lease_until ELSE NULL END WHERE document_id=p_document AND status IN ('queued','running');
 DELETE FROM public.document_chunks WHERE document_id=p_document;
 UPDATE public.document_results SET status='stale' WHERE document_id=p_document;
END $$;
ALTER TABLE public.provider_budgets DROP CONSTRAINT provider_budgets_kind_check;
ALTER TABLE public.provider_budgets ADD CONSTRAINT provider_budgets_kind_check CHECK(kind IN ('answer_question','explain_document','extract_emr','ocr_document'));
ALTER TABLE public.document_versions ADD COLUMN reviewed_ocr jsonb;
ALTER TABLE public.upload_operations ADD COLUMN reviewed_ocr jsonb;
-- OCR uses the existing thread/budget authority, but must not appear as an
-- evidence-chat thread with an incompatible question/answer envelope.
CREATE OR REPLACE FUNCTION private.owns_ai_thread(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT private.actor_thread(private.current_app_user_id(),t) AND NOT EXISTS(SELECT 1 FROM public.document_jobs WHERE thread_id=t AND kind='ocr_document')
$$;
CREATE FUNCTION private.ocr_thread_family() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.thread_id IS NOT NULL THEN
 PERFORM 1 FROM public.ai_threads WHERE id=NEW.thread_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.document_jobs WHERE thread_id=NEW.thread_id AND (kind='ocr_document')<>(NEW.kind='ocr_document')) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ocr_thread_family() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ocr_thread_family BEFORE INSERT ON public.document_jobs FOR EACH ROW EXECUTE FUNCTION private.ocr_thread_family();

CREATE OR REPLACE FUNCTION private.ai_sources_current(j public.document_jobs) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;BEGIN
 IF j.kind='ocr_document' THEN RETURN private.actor_thread(j.actor_id,j.thread_id) AND private.actor_thread_document(j.actor_id,j.thread_id,j.document_id) AND EXISTS(SELECT 1 FROM public.documents d JOIN public.document_versions v ON v.id=d.current_version_id JOIN public.ai_threads t ON t.patient_id=d.patient_id WHERE d.id=j.document_id AND t.id=j.thread_id AND d.status='ready' AND d.revision=j.input_revision AND v.id=j.version_id AND v.sha256=j.input_snapshot->>'byteHash');END IF;
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
REVOKE ALL ON FUNCTION private.ai_sources_current(public.document_jobs) FROM PUBLIC,anon,authenticated;
-- One bounded raster/provider pipeline at a time, before native image work.
-- Generic text claims must never consume an OCR job.
CREATE OR REPLACE FUNCTION public.ai_claim(p_id uuid DEFAULT NULL) RETURNS SETOF public.document_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;BEGIN
 PERFORM private.ai_recover();
 SELECT * INTO j FROM public.document_jobs WHERE thread_id IS NOT NULL AND kind<>'ocr_document' AND status='queued' AND available_at<=now() AND attempts<3 AND (p_id IS NULL OR id=p_id) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN;END IF;
 IF NOT private.ai_sources_current(j) THEN UPDATE public.document_jobs SET status='stale',result=NULL,error_code='SOURCE_STALE' WHERE id=j.id;RETURN;END IF;
 UPDATE public.document_jobs SET status='running',fence=fence+1,attempts=attempts+1,lease_until=now()+interval '90 seconds' WHERE id=j.id RETURNING * INTO j;RETURN NEXT j;
END $$;
CREATE FUNCTION public.ocr_claim(p_id uuid) RETURNS SETOF public.document_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ocr-render',0));PERFORM private.ai_recover();
 IF EXISTS(SELECT 1 FROM public.document_jobs WHERE kind='ocr_document' AND lease_until>now()) THEN RETURN;END IF;
 SELECT * INTO j FROM public.document_jobs WHERE id=p_id AND kind='ocr_document' AND status='queued' AND available_at<=now() AND attempts<3 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN;END IF;
 IF NOT private.ai_sources_current(j) THEN UPDATE public.document_jobs SET status='stale',result=NULL,error_code='SOURCE_STALE' WHERE id=j.id;RETURN;END IF;
 UPDATE public.document_jobs SET status='running',fence=fence+1,attempts=attempts+1,lease_until=now()+interval '90 seconds' WHERE id=j.id RETURNING * INTO j;RETURN NEXT j;
END $$;
REVOKE ALL ON FUNCTION public.ocr_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ocr_claim(uuid) TO service_role;

CREATE FUNCTION public.ocr_admit(k uuid,tid uuid,did uuid,vid uuid,expected integer,pages integer[],accounting jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();d public.documents;v public.document_versions;j public.document_jobs;req jsonb;inp jsonb;BEGIN
 IF a IS NULL OR k IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF NOT private.actor_thread(a,tid) OR NOT private.actor_thread_document(a,tid,did) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO d FROM public.documents WHERE id=did FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.ai_threads WHERE id=tid AND patient_id=d.patient_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF EXISTS(SELECT 1 FROM public.document_jobs WHERE thread_id=tid AND kind<>'ocr_document') THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 IF d.revision IS DISTINCT FROM expected OR d.current_version_id IS DISTINCT FROM vid THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 SELECT * INTO v FROM public.document_versions WHERE id=vid;
 IF pages IS NULL OR cardinality(pages) NOT BETWEEN 1 AND 2 OR array_position(pages,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(pages) x)<>cardinality(pages) OR EXISTS(SELECT 1 FROM unnest(pages) x WHERE x NOT BETWEEN 1 AND 20) THEN RAISE EXCEPTION 'INVALID_PAGES';END IF;
 IF v.mime NOT IN ('image/png','image/jpeg','application/pdf') OR v.source_class<>'original' OR NOT (v.extraction_status='needs_transcription' OR (v.mime='application/pdf' AND v.extraction_status='text_ready')) OR (v.mime<>'application/pdf' AND pages<>ARRAY[1]) OR (v.mime='application/pdf' AND EXISTS(SELECT 1 FROM unnest(pages) x WHERE x>v.page_count)) THEN RAISE EXCEPTION 'OCR_SOURCE_UNSUPPORTED';END IF;
 IF accounting IS NULL OR octet_length(accounting::text)>4000 OR jsonb_typeof(accounting->'input') IS DISTINCT FROM 'number' OR jsonb_typeof(accounting->'output') IS DISTINCT FROM 'number' OR accounting->'profile'->>'version' IS DISTINCT FROM 'ocr-accounting-v1' OR (accounting->>'input')::integer NOT BETWEEN 1 AND 50000 OR (accounting->>'output')::integer NOT BETWEEN 1 AND 3000 OR accounting->'pages' IS DISTINCT FROM to_jsonb(pages) THEN RAISE EXCEPTION 'OCR_ACCOUNTING_UNAVAILABLE';END IF;
 req:=jsonb_build_object('documentId',did,'versionId',vid,'revision',expected,'pages',pages);
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||did::text,0));
 SELECT * INTO j FROM public.document_jobs WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF j.kind<>'ocr_document' OR j.request<>req THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN j.id;END IF;
 SELECT * INTO j FROM public.document_jobs WHERE kind='ocr_document' AND actor_id=a AND document_id=did AND version_id=vid AND input_revision=expected;
 IF FOUND THEN IF j.request<>req THEN RAISE EXCEPTION 'OCR_ALREADY_REQUESTED';END IF;RETURN j.id;END IF;
 IF (SELECT count(*) FROM public.document_jobs WHERE actor_id=a AND kind='ocr_document' AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 inp:=jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('sourceType','ocr_image','documentId',did,'versionId',vid,'revision',expected,'pages',pages)),'pages',pages,'mime',v.mime,'byteHash',v.sha256,'byteSize',v.byte_size,'accounting',accounting);
 INSERT INTO public.document_jobs(actor_id,document_id,version_id,input_revision,kind,thread_id,operation_key,request,input_snapshot,source_hash,prompt_version)
 VALUES(a,did,vid,expected,'ocr_document',tid,k,req,inp,encode(extensions.digest(convert_to(inp::text,'UTF8'),'sha256'),'hex'),'cliniq-reviewed-ocr-v1') RETURNING id INTO j.id;RETURN j.id;
END $$;
REVOKE ALL ON FUNCTION public.ocr_admit(uuid,uuid,uuid,uuid,integer,integer[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ocr_admit(uuid,uuid,uuid,uuid,integer,integer[],jsonb) TO authenticated;

CREATE FUNCTION public.ocr_review_admit(k uuid,jid uuid,sha text,bytes integer,title text) RETURNS public.upload_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();j public.document_jobs;o public.upload_operations;BEGIN
 SELECT * INTO j FROM public.document_jobs WHERE id=jid AND actor_id=a AND kind='ocr_document';
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 -- Same upload key recovers an already committed reviewed version without
 -- requiring its now-obsolete source to become current again.
 SELECT * INTO o FROM public.upload_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN
 IF o.reviewed_ocr->>'jobId' IS DISTINCT FROM jid::text THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
 RETURN public.document_admit(k,title,'reviewed-transcription.txt','text/plain',bytes,sha,j.document_id,j.input_revision,j.version_id);
 END IF;
 PERFORM 1 FROM public.documents WHERE id=j.document_id FOR UPDATE;
 PERFORM private.ai_lock_sources(jid);
 IF NOT private.ai_sources_current(j) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF j.status<>'succeeded' OR j.result_state<>'succeeded' OR j.result IS NULL THEN RAISE EXCEPTION 'REVIEW_UNAVAILABLE';END IF;
 o:=public.document_admit(k,title,'reviewed-transcription.txt','text/plain',bytes,sha,j.document_id,j.input_revision,j.version_id);
 UPDATE public.upload_operations SET reviewed_ocr=jsonb_build_object('jobId',jid,'sourceVersionId',j.version_id,'sourcePages',j.input_snapshot->'pages','reviewedBy',a,'reviewedAt',now(),'providerConfidence','uncalibrated','executionMode',j.execution_mode,'model',j.result_model,'accounting',j.result->'accounting') WHERE id=o.id RETURNING * INTO o;
 RETURN o;
END $$;
REVOKE ALL ON FUNCTION public.ocr_review_admit(uuid,uuid,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ocr_review_admit(uuid,uuid,text,integer,text) TO authenticated;
CREATE FUNCTION private.ocr_version_provenance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN SELECT reviewed_ocr INTO NEW.reviewed_ocr FROM public.upload_operations WHERE version_id=NEW.id;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION private.ocr_version_provenance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reviewed_ocr_provenance BEFORE INSERT ON public.document_versions FOR EACH ROW EXECUTE FUNCTION private.ocr_version_provenance();
CREATE FUNCTION public.ocr_cancel(jid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN UPDATE public.document_jobs SET status='cancelled',result=NULL,error_code='CANCELLED_BY_ACTOR' WHERE id=jid AND kind='ocr_document' AND actor_id=private.current_app_user_id() AND status IN ('queued','running');RETURN FOUND;END $$;
REVOKE ALL ON FUNCTION public.ocr_cancel(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ocr_cancel(uuid) TO authenticated;
CREATE FUNCTION public.ocr_before_send_fail(jid uuid,f integer,reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;BEGIN
 PERFORM private.ai_lock_sources(jid);SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;
 IF NOT FOUND OR j.kind<>'ocr_document' OR j.fence<>f OR j.provider_attempt_id IS NOT NULL THEN RETURN false;END IF;
 IF j.status IN ('cancelled','stale') THEN UPDATE public.document_jobs SET lease_until=NULL WHERE id=jid;RETURN false;END IF;
 IF j.status<>'running' THEN RETURN false;END IF;
 UPDATE public.document_jobs SET status=CASE WHEN NOT private.ai_sources_current(j) THEN 'stale' WHEN reason='CANCELLED_BEFORE_SEND' THEN 'cancelled' ELSE 'unavailable' END,result=NULL,error_code=left(reason,80),lease_until=NULL WHERE id=jid;RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ocr_before_send_fail(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ocr_before_send_fail(uuid,integer,text) TO service_role;
-- Preserve transcription ordinal AND original selected-page references in evidence.
CREATE OR REPLACE FUNCTION public.ai_admit(k uuid,tid uuid,job_kind text,q text,documents uuid[] DEFAULT '{}',versions uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
 SELECT ch.text,jsonb_build_object('evidenceId','chunk:'||ch.id,'sourceType',CASE WHEN ch.source_class='manual' THEN 'manual_transcript' ELSE 'document' END,'documentId',doc.id,'versionId',ch.version_id,'revision',doc.revision,'chunkId',ch.id,'title',doc.title,'date',doc.created_at,'page',ch.page,'reviewedOCR',v.reviewed_ocr IS NOT NULL,'originalVersionId',v.reviewed_ocr->>'sourceVersionId','originalPage',(v.reviewed_ocr->'sourcePages')->(ch.page-1),'offsetStart',ch.offset_start,'offsetEnd',ch.offset_end,'text',ch.text,'contentSha256',ch.text_sha256) ref
 FROM public.document_chunks ch JOIN public.documents doc ON doc.id=ch.document_id JOIN public.document_versions v ON v.id=ch.version_id WHERE doc.patient_id=t.patient_id AND doc.status='ready' AND ch.version_id=doc.current_version_id AND ch.input_revision=doc.revision AND private.actor_thread_document(a,tid,doc.id) AND (doc.id=ANY(documents) OR (cardinality(documents)=0 AND cardinality(versions)=0))
 UNION ALL SELECT left(v.snapshot::text,7500),jsonb_build_object('evidenceId','approved:'||v.id,'sourceType','approved_emr','versionId',v.id,'title','Approved consultation','date',v.reviewed_at,'text',left(v.snapshot::text,7500),'contentSha256',v.content_sha256,'excerpt',true)
 FROM public.emr_versions v JOIN public.consultations c ON c.id=v.consultation_id JOIN public.patients p ON p.id=c.patient_id WHERE p.id=t.patient_id AND private.actor_thread_version(a,tid,v.id) AND (v.id=ANY(versions) OR (cardinality(documents)=0 AND cardinality(versions)=0)) AND NOT EXISTS(SELECT 1 FROM public.emr_versions newer WHERE newer.amended_from_id=v.id)
 ),ranked AS(SELECT text,ref,ts_rank_cd(private.retrieval_vector(text),query) rank FROM authorized WHERE private.retrieval_vector(text)@@query OR (cardinality(documents)>0 AND q~*'(summari[sz]|explain|instructions|plot)') ORDER BY rank DESC,ref->>'evidenceId' LIMIT 6),bounded AS(SELECT *,sum(length(text)) OVER(ORDER BY rank DESC,ref->>'evidenceId') total FROM ranked)
 SELECT coalesce(jsonb_agg(ref ORDER BY rank DESC,ref->>'evidenceId'),'[]') INTO sources FROM bounded WHERE total<=10000;
 input:=jsonb_build_object('sources',sources,'question',q);
 END IF;
 INSERT INTO public.document_jobs(actor_id,input_revision,kind,thread_id,operation_key,request,input_snapshot,source_hash)
 VALUES(a,coalesce(d.revision,0),job_kind,tid,k,req,input,encode(extensions.digest(convert_to(input::text,'UTF8'),'sha256'),'hex')) RETURNING * INTO j;RETURN j.id;
END $$;

-- Explicit OCR-only per-request ceilings; NULL does not enable OCR. Existing
-- text allowances remain unchanged. No allowance/scope/counter rows are seeded.
ALTER TABLE public.provider_allowances ADD COLUMN ocr_max_input integer CHECK(ocr_max_input BETWEEN 1 AND 50000), ADD COLUMN ocr_max_output integer CHECK(ocr_max_output BETWEEN 1 AND 3000);
ALTER TABLE public.provider_budgets ADD COLUMN ocr_max_input integer CHECK(ocr_max_input BETWEEN 1 AND 50000), ADD COLUMN ocr_max_output integer CHECK(ocr_max_output BETWEEN 1 AND 3000);
CREATE FUNCTION public.ocr_reserve(jid uuid,f integer,execution_mode text,model_name text,input_bound integer,output_bound integer,budget_ref text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;b public.provider_budgets;g public.provider_allowances;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ai-global-send',0));
 SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;
 IF NOT FOUND OR j.kind<>'ocr_document' OR j.status<>'running' OR j.fence<>f OR j.provider_attempt_id IS NOT NULL THEN RETURN NULL;END IF;
 SELECT * INTO b FROM public.provider_budgets WHERE authorization_ref=budget_ref AND model=model_name AND mode=execution_mode AND kind='ocr_document' AND enabled AND j.actor_id=ANY(allowed_actors) ORDER BY starts_at,id FOR UPDATE LIMIT 1;
 SELECT * INTO g FROM public.provider_allowances WHERE authorization_ref=budget_ref FOR UPDATE;
 IF b.ocr_max_input IS NULL OR b.ocr_max_output IS NULL OR g.ocr_max_input IS NULL OR g.ocr_max_output IS NULL OR input_bound IS NULL OR output_bound IS NULL OR input_bound<1 OR input_bound>least(b.ocr_max_input,g.ocr_max_input) OR output_bound<1 OR output_bound>least(b.ocr_max_output,g.ocr_max_output) OR model_name IS DISTINCT FROM j.input_snapshot->'accounting'->'profile'->>'model' OR input_bound>(j.input_snapshot->'accounting'->>'input')::integer OR output_bound IS DISTINCT FROM (j.input_snapshot->'accounting'->>'output')::integer THEN
 UPDATE public.document_jobs SET status='unavailable',error_code='OCR_REQUEST_LIMIT',lease_until=NULL WHERE id=jid;RETURN NULL;END IF;
 RETURN public.ai_reserve(jid,f,execution_mode,model_name,input_bound,output_bound,budget_ref);
END $$;
REVOKE ALL ON FUNCTION public.ocr_reserve(uuid,integer,text,text,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ocr_reserve(uuid,integer,text,text,integer,integer,text) TO service_role;
-- Prevent bypass of OCR ceilings via the established generic service RPC.
CREATE FUNCTION private.ocr_attempt_bound() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.document_jobs;b public.provider_budgets;g public.provider_allowances;BEGIN
 SELECT * INTO j FROM public.document_jobs WHERE id=NEW.job_id;
 IF j.kind='ocr_document' THEN
 SELECT * INTO b FROM public.provider_budgets WHERE id=NEW.budget_id;
 SELECT * INTO g FROM public.provider_allowances WHERE authorization_ref=b.authorization_ref;
 IF b.ocr_max_input IS NULL OR b.ocr_max_output IS NULL OR g.ocr_max_input IS NULL OR g.ocr_max_output IS NULL OR NEW.reserved_input>least(b.ocr_max_input,g.ocr_max_input) OR NEW.reserved_output>least(b.ocr_max_output,g.ocr_max_output) OR NEW.reserved_output IS DISTINCT FROM (j.input_snapshot->'accounting'->>'output')::integer THEN RAISE EXCEPTION 'OCR_REQUEST_LIMIT';END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ocr_attempt_bound() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ocr_attempt_bound BEFORE INSERT ON public.provider_attempts FOR EACH ROW EXECUTE FUNCTION private.ocr_attempt_bound();
CREATE FUNCTION public.optional_capabilities() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT '{"ocr":1,"speech":0}'::jsonb $$;
REVOKE ALL ON FUNCTION public.optional_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.optional_capabilities() TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
