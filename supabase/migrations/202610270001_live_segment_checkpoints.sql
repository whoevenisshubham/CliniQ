BEGIN;
-- A provider final is staged by the service, then saved by the real caller JWT
-- through clinical_mutate. No principal substitution or permissive table policy.
CREATE FUNCTION public.speech_stream_stage(oid uuid,span_ms integer,transcript text,raw jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;entry jsonb;BEGIN
 PERFORM 1 FROM public.consultations WHERE id=(SELECT consultation_id FROM public.speech_operations WHERE id=oid) FOR UPDATE;
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'transmitting' OR o.lease_until<=now() OR o.request->>'transport' IS DISTINCT FROM 'streaming' OR NOT private.actor_can_edit_encounter(o.actor_id,o.consultation_id) THEN RETURN false;END IF;
 IF span_ms IS NULL OR span_ms<0 OR span_ms>=o.duration_ms OR transcript IS NULL OR length(btrim(transcript)) NOT BETWEEN 1 AND 8000 OR raw IS NULL OR octet_length(raw::text)>131072 THEN RAISE EXCEPTION 'INVALID_STREAM_FINAL';END IF;
 SELECT x INTO entry FROM jsonb_array_elements(coalesce(o.request->'streamSegments','[]')) x WHERE (x->>'startMs')::integer=span_ms;
 IF FOUND THEN IF entry->>'text' IS DISTINCT FROM btrim(transcript) THEN RAISE EXCEPTION 'FINAL_SPAN_CHANGED';END IF;RETURN true;END IF;
 IF o.request ? 'streamPending' THEN RAISE EXCEPTION 'CHECKPOINT_PENDING';END IF;
 IF jsonb_array_length(coalesce(o.request->'streamSegments','[]'))>=128 OR length(transcript)+(SELECT coalesce(sum(length(x->>'text')),0) FROM jsonb_array_elements(coalesce(o.request->'streamSegments','[]')) x)>8000 OR octet_length(coalesce(o.raw_provider_response,'{}')::text)+octet_length(raw::text)>60000 THEN RAISE EXCEPTION 'STREAM_RESULT_LIMIT';END IF;
 UPDATE public.speech_operations SET request=request||jsonb_build_object('streamPending',jsonb_build_object('startMs',span_ms,'text',btrim(transcript),'id',gen_random_uuid(),'raw',raw)) WHERE id=oid;
 RETURN true;
END $$;
CREATE FUNCTION public.speech_stream_checkpoint(oid uuid,span_ms integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;c public.consultations;entry jsonb;r jsonb;seq integer;sid uuid;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid;
 IF NOT FOUND OR o.actor_id IS DISTINCT FROM private.current_app_user_id() OR NOT private.can_edit_encounter(o.consultation_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO c FROM public.consultations WHERE id=o.consultation_id FOR UPDATE;
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF o.status<>'transmitting' OR o.lease_until<=now() OR o.request->>'transport' IS DISTINCT FROM 'streaming' THEN RAISE EXCEPTION 'RESULT_UNAVAILABLE';END IF;
 IF c.status<>'active' OR c.revision<>o.expected_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 SELECT x INTO entry FROM jsonb_array_elements(coalesce(o.request->'streamSegments','[]')) x WHERE (x->>'startMs')::integer=span_ms;
 IF FOUND THEN RETURN entry||jsonb_build_object('consultationId',c.id,'revision',c.revision);END IF;
 entry:=o.request->'streamPending';
 IF entry IS NULL OR (entry->>'startMs')::integer IS DISTINCT FROM span_ms THEN RAISE EXCEPTION 'UNSTAGED_FINAL';END IF;
 sid:=(entry->>'id')::uuid;seq:=o.sequence+jsonb_array_length(coalesce(o.request->'streamSegments','[]'));
 r:=public.clinical_mutate(sid,jsonb_build_object('action','transcript','consultationId',c.id,'expectedRevision',c.revision,'segment',jsonb_build_object('id',sid,'sequence',seq,'text',entry->>'text','speaker','unknown','language','unknown','startMs',NULL,'endMs',NULL)));
 UPDATE public.clinical_segments SET source_type='speech',start_ms=span_ms,speech_provenance=jsonb_build_object('mode',o.mode,'provider',o.provider,'model',o.model,'requestedLanguage',o.requested_language,'operationId',oid,'transport','streaming') WHERE id=sid AND consultation_id=c.id;
 entry:=(entry-'raw')||jsonb_build_object('revision',r->'revision','sequence',seq);
 UPDATE public.speech_operations SET expected_revision=(r->>'revision')::integer,request=(request-'streamPending')||jsonb_build_object('streamSegments',coalesce(request->'streamSegments','[]')||jsonb_build_array(entry)),raw_provider_response=jsonb_build_object('transport','streaming','finalResults',coalesce(raw_provider_response->'finalResults','[]')||jsonb_build_array(o.request->'streamPending'->'raw')) WHERE id=oid;
 RETURN entry||r;
END $$;
ALTER FUNCTION public.speech_commit(uuid) RENAME TO speech_commit_clip;
REVOKE ALL ON FUNCTION public.speech_commit_clip(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.speech_commit(oid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;c public.consultations;r jsonb;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid;
 IF NOT FOUND OR o.actor_id IS DISTINCT FROM private.current_app_user_id() OR NOT private.can_edit_encounter(o.consultation_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF jsonb_array_length(coalesce(o.request->'streamSegments','[]'))=0 THEN RETURN public.speech_commit_clip(oid);END IF;
 SELECT * INTO c FROM public.consultations WHERE id=o.consultation_id FOR UPDATE;
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF o.status='saved' THEN RETURN o.response;END IF;
 IF o.status<>'responded' OR o.request ? 'streamPending' THEN RAISE EXCEPTION 'RESULT_UNAVAILABLE';END IF;
 IF c.status<>'active' OR c.revision<>o.expected_revision THEN UPDATE public.speech_operations SET status='stale',error_code='REVISION_CONFLICT' WHERE id=oid;RETURN jsonb_build_object('state','stale','operationId',oid);END IF;
 r:=jsonb_build_object('state','saved','operationId',oid,'consultationId',c.id,'revision',c.revision,'segmentId',(o.request->'streamSegments'->0)->>'id','mode',o.mode);
 UPDATE public.speech_operations SET status='saved',response=r,lease_until=NULL WHERE id=oid;RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.speech_stream_stage(uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.speech_stream_stage(uuid,integer,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.speech_stream_checkpoint(uuid,integer),public.speech_commit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.speech_stream_checkpoint(uuid,integer),public.speech_commit(uuid) TO authenticated;
CREATE FUNCTION public.speech_checkpoint_capability() RETURNS integer LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.speech_checkpoint_capability() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.speech_checkpoint_capability() TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
