BEGIN;
-- Additive reviewed context: existing snapshots/prescriptions and old versions
-- are not rewritten. In particular medication history never feeds finalize Rx.
ALTER TABLE public.clinical_drafts ADD COLUMN clinical_context jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.clinical_proposals ADD COLUMN clinical_context jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.emr_versions ADD COLUMN clinical_context jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.clinical_segments ADD COLUMN reviewed_correction_of uuid REFERENCES public.clinical_segments(id);
CREATE FUNCTION public.clinical_correct_source(k uuid,cid uuid,source_id uuid,corrected_text text,expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;original public.clinical_segments;prior public.clinical_segments;BEGIN
 IF NOT private.can_edit_encounter(cid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO original FROM public.clinical_segments WHERE id=source_id AND consultation_id=cid;
 IF NOT FOUND OR source_id=k THEN RAISE EXCEPTION 'INVALID_SOURCE';END IF;
 SELECT * INTO prior FROM public.clinical_segments WHERE id=k;
 IF FOUND AND prior.reviewed_correction_of IS DISTINCT FROM source_id THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
 r:=public.clinical_mutate(k,jsonb_build_object('action','transcript','consultationId',cid,'expectedRevision',expected,'segment',jsonb_build_object('id',k,'sequence',CASE WHEN prior.id IS NOT NULL THEN prior.sequence ELSE(SELECT count(*) FROM public.clinical_segments WHERE consultation_id=cid) END,'text',corrected_text,'speaker',original.speaker,'language',original.language,'startMs',NULL,'endMs',NULL)));
 UPDATE public.clinical_segments SET reviewed_correction_of=source_id WHERE id=k AND consultation_id=cid;RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.clinical_correct_source(uuid,uuid,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinical_correct_source(uuid,uuid,uuid,text,integer) TO authenticated;
CREATE FUNCTION private.validate_clinical_context(ctx jsonb,cid uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE field text;a jsonb;sid jsonb;BEGIN
 IF ctx='{}' THEN RETURN;END IF;
 IF jsonb_typeof(ctx) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(ctx))<>3 OR NOT(ctx ?& ARRAY['symptoms','medication_history','statements']) OR octet_length(ctx::text)>24576 THEN RAISE EXCEPTION 'CONTEXT_SCHEMA';END IF;
 FOREACH field IN ARRAY ARRAY['symptoms','medication_history','statements'] LOOP
 IF jsonb_typeof(ctx->field) IS DISTINCT FROM 'array' OR jsonb_array_length(ctx->field)>30 THEN RAISE EXCEPTION 'CONTEXT_SCHEMA';END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(ctx->field) LOOP
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(a))<>8 OR NOT(a ?& ARRAY['id','kind','text','polarity','source_ids','quote','corrects_source_ids','medication']) OR (a->>'kind')<>ALL(ARRAY['symptom','medicine','history','allergy','prescribing','uncertain','measurement']) OR (a->>'polarity')<>ALL(ARRAY['present','absent','uncertain']) OR length(btrim(a->>'text')) NOT BETWEEN 1 AND 1000 OR length(a->>'quote')>1000 THEN RAISE EXCEPTION 'CONTEXT_SCHEMA';END IF;
 IF jsonb_typeof(a->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'kind') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'polarity') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'text') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'quote') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'CONTEXT_SCHEMA';END IF;PERFORM (a->>'id')::uuid;
 IF field='symptoms' AND a->>'kind'<>'symptom' OR field='medication_history' AND a->>'kind'<>'medicine' OR field='statements' AND a->>'kind'=ANY(ARRAY['symptom','medicine']) THEN RAISE EXCEPTION 'CONTEXT_SCHEMA';END IF;
 IF jsonb_typeof(a->'source_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(a->'source_ids') NOT BETWEEN 1 AND 10 OR jsonb_typeof(a->'corrects_source_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(a->'corrects_source_ids')>10 THEN RAISE EXCEPTION 'CONTEXT_SCHEMA';END IF;
 FOR sid IN SELECT value FROM jsonb_array_elements((a->'source_ids')||(a->'corrects_source_ids')) LOOP
 IF NOT EXISTS(SELECT 1 FROM public.clinical_segments s WHERE s.id=(sid#>>'{}')::uuid AND s.consultation_id=cid) THEN RAISE EXCEPTION 'INVALID_SOURCE';END IF;
 END LOOP;
 IF a->'medication'<>'null' THEN PERFORM private.validate_clinical_snapshot(jsonb_build_object('chief_complaint',NULL,'physical_examination',NULL,'symptoms','[]'::jsonb,'diagnosis','[]'::jsonb,'medications',jsonb_build_array(a->'medication'),'lab_tests_ordered','[]'::jsonb,'clinical_summary',NULL,'vitals','[]'::jsonb));END IF;
 END LOOP;END LOOP;
END $$;
CREATE FUNCTION private.merge_clinical_context(prior jsonb,incoming jsonb,cid uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE field text;r jsonb:='{}';items jsonb;BEGIN
 IF incoming='{}' THEN RETURN prior;END IF;PERFORM private.validate_clinical_context(incoming,cid);
 FOREACH field IN ARRAY ARRAY['symptoms','medication_history','statements'] LOOP
 SELECT coalesce(jsonb_agg(item ORDER BY ordering),'[]') INTO items FROM(SELECT item,ordering,row_number() OVER(PARTITION BY item->>'id' ORDER BY ordering DESC) n FROM(SELECT item,pos ordering FROM jsonb_array_elements(coalesce(prior->field,'[]')) WITH ORDINALITY x(item,pos) UNION ALL SELECT item,1000+pos FROM jsonb_array_elements(incoming->field) WITH ORDINALITY x(item,pos)) u) d WHERE n=1;
 r:=r||jsonb_build_object(field,items);END LOOP;
 PERFORM private.validate_clinical_context(r,cid);RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.validate_clinical_context(jsonb,uuid),private.merge_clinical_context(jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;

ALTER FUNCTION public.ai_admit(uuid,uuid,text,text,uuid[],uuid[]) RENAME TO ai_admit_without_context;
REVOKE ALL ON FUNCTION public.ai_admit_without_context(uuid,uuid,text,text,uuid[],uuid[]) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ai_admit(k uuid,tid uuid,job_kind text,q text,documents uuid[] DEFAULT '{}',versions uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE jid uuid;j public.document_jobs;cid uuid;sources jsonb;BEGIN
 jid:=public.ai_admit_without_context(k,tid,job_kind,q,documents,versions);
 SELECT * INTO j FROM public.document_jobs WHERE id=jid FOR UPDATE;
 IF job_kind<>'extract_emr' OR j.input_snapshot ? 'newSourceIds' OR j.status<>'queued' THEN RETURN jid;END IF;
 SELECT consultation_id INTO cid FROM public.ai_threads WHERE id=tid;
 SELECT jsonb_agg(jsonb_build_object('evidenceId','segment:'||s.id,'sourceType','transcript','segmentId',s.id,'versionId',s.id,'sequence',s.sequence,'text',s.text,'speaker',s.speaker,'captureType',s.source_type,'correctsSegmentId',s.reviewed_correction_of) ORDER BY s.sequence) INTO sources FROM public.clinical_segments s WHERE s.consultation_id=cid AND(s.id IN(SELECT (v->>'segmentId')::uuid FROM jsonb_array_elements(j.input_snapshot->'sources') v) OR s.id IN(SELECT x.id FROM public.clinical_segments x WHERE x.consultation_id=cid AND x.sequence<(j.input_snapshot->>'fromSequence')::integer ORDER BY x.sequence DESC LIMIT 2) OR s.id IN(SELECT x.reviewed_correction_of FROM public.clinical_segments x WHERE x.id IN(SELECT(v->>'segmentId')::uuid FROM jsonb_array_elements(j.input_snapshot->'sources') v)));
 IF octet_length(sources::text)>40000 THEN RAISE EXCEPTION 'CONTEXT_LIMIT';END IF;
 UPDATE public.document_jobs SET input_snapshot=input_snapshot||jsonb_build_object('newSourceIds',(SELECT jsonb_agg(v->'segmentId') FROM jsonb_array_elements(input_snapshot->'sources') v),'sources',sources) WHERE id=jid;
 UPDATE public.document_jobs SET source_hash=encode(extensions.digest(convert_to(input_snapshot::text,'UTF8'),'sha256'),'hex') WHERE id=jid;RETURN jid;
END $$;
REVOKE ALL ON FUNCTION public.ai_admit(uuid,uuid,text,text,uuid[],uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_admit(uuid,uuid,text,text,uuid[],uuid[]) TO authenticated;

ALTER FUNCTION public.ai_publish(uuid,integer) RENAME TO ai_publish_without_context;
REVOKE ALL ON FUNCTION public.ai_publish_without_context(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.ai_publish(jid uuid,f integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;ok boolean;pid uuid;cid uuid;BEGIN
 SELECT result->'context' INTO ctx FROM public.document_jobs WHERE id=jid;
 ok:=public.ai_publish_without_context(jid,f);
 IF ok AND ctx IS NOT NULL THEN
 SELECT (j.result->>'proposalId')::uuid,t.consultation_id INTO pid,cid FROM public.document_jobs j JOIN public.ai_threads t ON t.id=j.thread_id WHERE j.id=jid AND j.kind='extract_emr' AND j.status='succeeded';
 IF pid IS NOT NULL THEN
 PERFORM private.validate_clinical_context(ctx,cid);
 UPDATE public.clinical_proposals SET clinical_context=ctx,source_snapshot=(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sequence',s.sequence,'text',s.text,'speaker',s.speaker,'language',s.language,'source_type',s.source_type) ORDER BY s.sequence),'[]') FROM public.clinical_segments s WHERE s.consultation_id=cid AND(s.id IN(SELECT (v->>'id')::uuid FROM jsonb_array_elements(source_snapshot) v) OR s.id IN(SELECT (sid#>>'{}')::uuid FROM jsonb_each(ctx) fields,LATERAL jsonb_array_elements(fields.value) a,LATERAL jsonb_array_elements((a->'source_ids')||(a->'corrects_source_ids')) sid))) WHERE id=pid;
 END IF;END IF;RETURN ok;
END $$;
REVOKE ALL ON FUNCTION public.ai_publish(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_publish(uuid,integer) TO service_role;

ALTER FUNCTION public.clinical_apply_proposal(uuid,uuid,integer,text) RENAME TO clinical_apply_without_context;
REVOKE ALL ON FUNCTION public.clinical_apply_without_context(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.clinical_apply_proposal(k uuid,pid uuid,expected integer,decision text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;p public.clinical_proposals;BEGIN
 r:=public.clinical_apply_without_context(k,pid,expected,decision);
 IF decision='accept' THEN SELECT * INTO p FROM public.clinical_proposals WHERE id=pid;UPDATE public.clinical_drafts SET clinical_context=private.merge_clinical_context(clinical_context,p.clinical_context,p.consultation_id) WHERE consultation_id=p.consultation_id;END IF;RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.clinical_apply_proposal(uuid,uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinical_apply_proposal(uuid,uuid,integer,text) TO authenticated;
-- Explicit review rebase after clinician edits, never after additional speech.
-- Conflicting generated fields become review notices, not replacement writes.
CREATE FUNCTION public.clinical_rebase_proposal(k uuid,pid uuid,expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.clinical_proposals;d public.clinical_drafts;old_draft jsonb;ops jsonb:='[]';op jsonb;new_id uuid;prior public.clinical_operations;req jsonb;r jsonb;BEGIN
 SELECT * INTO p FROM public.clinical_proposals WHERE id=pid;
 IF NOT FOUND OR p.actor_id IS DISTINCT FROM private.current_app_user_id() OR NOT private.can_edit_encounter(p.consultation_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF k IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;req:=jsonb_build_object('action','rebase_proposal','proposalId',pid,'expectedRevision',expected);
 PERFORM pg_advisory_xact_lock(hashtextextended(p.actor_id::text||k::text,0));SELECT * INTO prior FROM public.clinical_operations WHERE actor_id=p.actor_id AND operation_key=k;
 IF FOUND THEN IF prior.request<>req THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN prior.response;END IF;
 PERFORM 1 FROM public.consultations WHERE id=p.consultation_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO d FROM public.clinical_drafts WHERE consultation_id=p.consultation_id FOR UPDATE;
 IF d.revision<>expected OR p.state<>ALL(ARRAY['review_required','stale']) OR (SELECT sequence FROM public.clinical_segments WHERE id=p.through_segment_id)<>(SELECT max(sequence) FROM public.clinical_segments WHERE consultation_id=p.consultation_id) THEN RAISE EXCEPTION 'STALE_PROPOSAL';END IF;
 SELECT j.input_snapshot->'draft' INTO old_draft FROM public.document_jobs j WHERE j.actor_id=p.actor_id AND j.result->>'proposalId'=pid::text AND j.status='succeeded' LIMIT 1;
 IF old_draft IS NULL THEN RAISE EXCEPTION 'STALE_PROPOSAL';END IF;
 FOR op IN SELECT value FROM jsonb_array_elements(p.operations) LOOP
 IF op->>'op'=ANY(ARRAY['set_fact','update_fact']) AND old_draft->(op->>'path') IS DISTINCT FROM d.snapshot->(op->>'path') THEN op:=jsonb_build_object('op','mark_uncertain','path',op->>'path','evidence_segment_ids',op->'evidence_segment_ids','note','Clinician edit retained; conflicting generated field was not applied.');END IF;ops:=ops||jsonb_build_array(op);
 END LOOP;
 new_id:=public.clinical_offer(p.actor_id,p.consultation_id,jsonb_build_object('baseRevision',expected,'throughSegmentId',p.through_segment_id,'operations',ops),'offline_fixture');
 UPDATE public.clinical_proposals SET result_kind=p.result_kind,clinical_context=p.clinical_context,source_snapshot=p.source_snapshot WHERE id=new_id;
 UPDATE public.clinical_proposals SET state='rejected' WHERE id=pid;
 r:=jsonb_build_object('consultationId',p.consultation_id,'revision',expected,'proposalId',new_id);
 INSERT INTO public.clinical_operations(actor_id,operation_key,request,response) VALUES(p.actor_id,k,req,r);RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.clinical_rebase_proposal(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinical_rebase_proposal(uuid,uuid,integer) TO authenticated;
CREATE FUNCTION private.approved_context() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE a jsonb;BEGIN
 SELECT clinical_context INTO NEW.clinical_context FROM public.clinical_drafts WHERE consultation_id=NEW.consultation_id;
 IF NEW.clinical_context<>'{}' THEN
 FOR a IN SELECT item FROM jsonb_each(NEW.clinical_context) fields,LATERAL jsonb_array_elements(fields.value) item LOOP
 IF a->>'polarity'='uncertain' AND coalesce(length(btrim(NEW.acknowledgements->>('context:'||(a->>'id')))),0)<10 THEN RAISE EXCEPTION 'CONTEXT_REVIEW_REQUIRED';END IF;
 IF a->>'kind'='prescribing' AND a->>'polarity'='absent' AND jsonb_array_length(NEW.snapshot->'medications')>0 AND coalesce(length(btrim(NEW.acknowledgements->>'context:prescribing')),0)<10 THEN RAISE EXCEPTION 'CONTEXT_REVIEW_REQUIRED';END IF;
 END LOOP;END IF;
 IF NEW.clinical_context<>'{}' THEN NEW.content_sha256:=encode(extensions.digest(convert_to(jsonb_build_object('snapshot',NEW.snapshot,'context',NEW.clinical_context)::text,'UTF8'),'sha256'),'hex');END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION private.approved_context() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER approved_context BEFORE INSERT ON public.emr_versions FOR EACH ROW EXECUTE FUNCTION private.approved_context();
CREATE FUNCTION public.clinical_context_capability() RETURNS integer LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.clinical_context_capability() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinical_context_capability() TO authenticated,service_role;
CREATE FUNCTION public.clinical_print_metadata(vid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;BEGIN
 SELECT jsonb_build_object('patientName',p.name,'patientId',p.id,'dob',p.dob,'gender',p.gender,'encounterId',c.id,'encounterAt',c.started_at,'reviewedBy',u.name) INTO r FROM public.emr_versions v JOIN public.consultations c ON c.id=v.consultation_id JOIN public.patients p ON p.id=c.patient_id JOIN public.users u ON u.id=v.reviewed_by WHERE v.id=vid AND private.can_read_approved(c.id);
 IF r IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.clinical_print_metadata(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinical_print_metadata(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
