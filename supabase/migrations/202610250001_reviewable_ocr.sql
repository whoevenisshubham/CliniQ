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
 UPDATE public.document_jobs SET status='cancelled',lease_until=CASE WHEN kind='ocr_document' AND provider_attempt_id IS NOT NULL THEN lease_until ELSE NULL END WHERE document_id=p_document AND status IN ('queued','running');
 DELETE FROM public.document_chunks WHERE document_id=p_document;
 UPDATE public.document_results SET status='stale' WHERE document_id=p_document;
END $$;
ALTER TABLE public.provider_budgets DROP CONSTRAINT provider_budgets_kind_check;
ALTER TABLE public.provider_budgets ADD CONSTRAINT provider_budgets_kind_check CHECK(kind IN ('answer_question','explain_document','extract_emr','ocr_document'));
ALTER TABLE public.document_versions ADD COLUMN reviewed_ocr jsonb;
ALTER TABLE public.upload_operations ADD COLUMN reviewed_ocr jsonb;

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

CREATE FUNCTION public.ocr_admit(k uuid,tid uuid,did uuid,vid uuid,expected integer,pages integer[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();d public.documents;v public.document_versions;j public.document_jobs;req jsonb;inp jsonb;BEGIN
 IF a IS NULL OR k IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF NOT private.actor_thread(a,tid) OR NOT private.actor_thread_document(a,tid,did) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO d FROM public.documents WHERE id=did FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.ai_threads WHERE id=tid AND patient_id=d.patient_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF d.revision IS DISTINCT FROM expected OR d.current_version_id IS DISTINCT FROM vid THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 SELECT * INTO v FROM public.document_versions WHERE id=vid;
 IF pages IS NULL OR cardinality(pages) NOT BETWEEN 1 AND 2 OR array_position(pages,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(pages) x)<>cardinality(pages) OR EXISTS(SELECT 1 FROM unnest(pages) x WHERE x NOT BETWEEN 1 AND 20) THEN RAISE EXCEPTION 'INVALID_PAGES';END IF;
 IF v.mime NOT IN ('image/png','image/jpeg','application/pdf') OR v.source_class<>'original' OR v.extraction_status<>'needs_transcription' OR (v.mime<>'application/pdf' AND pages<>ARRAY[1]) OR (v.mime='application/pdf' AND EXISTS(SELECT 1 FROM unnest(pages) x WHERE x>v.page_count)) THEN RAISE EXCEPTION 'OCR_SOURCE_UNSUPPORTED';END IF;
 req:=jsonb_build_object('documentId',did,'versionId',vid,'revision',expected,'pages',pages);
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||did::text,0));
 SELECT * INTO j FROM public.document_jobs WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF j.kind<>'ocr_document' OR j.request<>req THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN j.id;END IF;
 SELECT * INTO j FROM public.document_jobs WHERE kind='ocr_document' AND actor_id=a AND document_id=did AND version_id=vid AND input_revision=expected;
 IF FOUND THEN IF j.request<>req THEN RAISE EXCEPTION 'OCR_ALREADY_REQUESTED';END IF;RETURN j.id;END IF;
 IF (SELECT count(*) FROM public.document_jobs WHERE actor_id=a AND kind='ocr_document' AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 inp:=jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('sourceType','ocr_image','documentId',did,'versionId',vid,'revision',expected,'pages',pages)),'pages',pages,'mime',v.mime,'byteHash',v.sha256,'byteSize',v.byte_size);
 INSERT INTO public.document_jobs(actor_id,document_id,version_id,input_revision,kind,thread_id,operation_key,request,input_snapshot,source_hash,prompt_version)
 VALUES(a,did,vid,expected,'ocr_document',tid,k,req,inp,encode(extensions.digest(convert_to(inp::text,'UTF8'),'sha256'),'hex'),'cliniq-reviewed-ocr-v1') RETURNING id INTO j.id;RETURN j.id;
END $$;
REVOKE ALL ON FUNCTION public.ocr_admit(uuid,uuid,uuid,uuid,integer,integer[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ocr_admit(uuid,uuid,uuid,uuid,integer,integer[]) TO authenticated;

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
 UPDATE public.upload_operations SET reviewed_ocr=jsonb_build_object('jobId',jid,'sourceVersionId',j.version_id,'sourcePages',j.input_snapshot->'pages','reviewedBy',a,'reviewedAt',now(),'providerConfidence','uncalibrated','executionMode',j.execution_mode,'model',j.result_model) WHERE id=o.id RETURNING * INTO o;
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
 IF NOT FOUND OR j.kind<>'ocr_document' OR j.status<>'running' OR j.fence<>f OR j.provider_attempt_id IS NOT NULL THEN RETURN false;END IF;
 UPDATE public.document_jobs SET status=CASE WHEN NOT private.ai_sources_current(j) THEN 'stale' WHEN reason='CANCELLED_BEFORE_SEND' THEN 'cancelled' ELSE 'unavailable' END,result=NULL,error_code=left(reason,80),lease_until=NULL WHERE id=jid;RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ocr_before_send_fail(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ocr_before_send_fail(uuid,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
