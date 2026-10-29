BEGIN;
CREATE INDEX speech_transmission_expiry ON public.speech_operations(lease_until) WHERE status='transmitting';
CREATE INDEX speech_admission_expiry ON public.speech_operations(created_at) WHERE status='admitted';
CREATE FUNCTION public.speech_reconcile() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE changed integer;BEGIN
 WITH expired AS(SELECT id FROM public.speech_operations WHERE (status='transmitting' AND lease_until<now()) OR (status='admitted' AND created_at<now()-interval '5 minutes') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20)
 UPDATE public.speech_operations o SET status=CASE WHEN o.status='transmitting' THEN 'outcome_unknown' ELSE 'cancelled' END,error_code=CASE WHEN o.status='transmitting' THEN 'LEASE_EXPIRED' ELSE 'ADMISSION_EXPIRED_BEFORE_SEND' END,response_text=NULL FROM expired WHERE o.id=expired.id;
 GET DIAGNOSTICS changed=ROW_COUNT;RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.speech_reconcile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.speech_reconcile() TO service_role;
ALTER TABLE public.clinical_segments ADD COLUMN speech_provenance jsonb;
CREATE OR REPLACE FUNCTION public.speech_commit(oid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;c public.consultations;r jsonb;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid;
 IF NOT FOUND OR o.actor_id IS DISTINCT FROM private.current_app_user_id() OR NOT private.can_edit_encounter(o.consultation_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO c FROM public.consultations WHERE id=o.consultation_id FOR UPDATE;
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF o.status='saved' THEN RETURN o.response;END IF;
 IF o.status<>'responded' THEN RAISE EXCEPTION 'RESULT_UNAVAILABLE';END IF;
 IF c.status<>'active' OR c.revision<>o.expected_revision THEN UPDATE public.speech_operations SET status='stale',error_code='REVISION_CONFLICT' WHERE id=oid;RETURN jsonb_build_object('state','stale','operationId',oid);END IF;
 r:=public.clinical_mutate(o.operation_key,jsonb_build_object('action','transcript','consultationId',c.id,'expectedRevision',c.revision,'segment',jsonb_build_object('id',o.segment_id,'sequence',o.sequence,'text',o.response_text,'speaker','unknown','language','unknown','startMs',NULL,'endMs',NULL)));
 UPDATE public.clinical_segments SET source_type='speech',start_ms=0,end_ms=o.duration_ms,speech_provenance=jsonb_build_object('mode',o.mode,'provider',o.provider,'model',o.model,'requestedLanguage',o.requested_language,'operationId',o.id,'audioSha256',o.audio_sha256,'durationMs',o.duration_ms) WHERE id=o.segment_id AND consultation_id=c.id;
 r:=r||jsonb_build_object('state','saved','operationId',oid,'segmentId',o.segment_id,'mode',o.mode);
 UPDATE public.speech_operations SET status='saved',response=r,lease_until=NULL WHERE id=oid;RETURN r;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
