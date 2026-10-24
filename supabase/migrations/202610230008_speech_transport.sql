BEGIN;
-- No live allowance can be represented by this migration. Audio bytes are never
-- retained here or in Storage: only an immutable request hash and bounded result.
CREATE TABLE public.speech_operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES public.users(id),
 consultation_id uuid NOT NULL REFERENCES public.consultations(id),operation_key uuid NOT NULL,
 request jsonb NOT NULL,segment_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence BETWEEN 0 AND 999),
 expected_revision integer NOT NULL CHECK(expected_revision>=0),audio_sha256 text NOT NULL CHECK(audio_sha256~'^[a-f0-9]{64}$'),
 duration_ms integer NOT NULL CHECK(duration_ms BETWEEN 1 AND 30000),byte_count integer NOT NULL CHECK(byte_count BETWEEN 46 AND 1048576),
 status text NOT NULL DEFAULT 'admitted' CHECK(status IN ('admitted','transmitting','responded','saved','unavailable','cancelled','rejected','stale','outcome_unknown')),
 mode text CHECK(mode='offline_fixture'),provider text NOT NULL DEFAULT 'deepgram' CHECK(provider='deepgram'),
 model text NOT NULL DEFAULT 'nova-2' CHECK(model='nova-2'),requested_language text NOT NULL DEFAULT 'hi' CHECK(requested_language='hi'),
 response_text text CHECK(length(response_text) BETWEEN 1 AND 8000),response jsonb,error_code text,lease_until timestamptz,
 provider_request_id text CHECK(length(provider_request_id)<=200),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,operation_key),UNIQUE(consultation_id,segment_id)
);
CREATE TABLE public.speech_allowances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),authorization_ref text NOT NULL CHECK(length(authorization_ref) BETWEEN 1 AND 160),
 actor_id uuid NOT NULL REFERENCES public.users(id),consultation_id uuid NOT NULL REFERENCES public.consultations(id),
 mode text NOT NULL DEFAULT 'offline_fixture' CHECK(mode='offline_fixture'),enabled boolean NOT NULL DEFAULT false,
 starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz NOT NULL,
 max_requests integer NOT NULL CHECK(max_requests BETWEEN 1 AND 10),max_audio_ms integer NOT NULL CHECK(max_audio_ms BETWEEN 1 AND 300000),
 used_requests integer NOT NULL DEFAULT 0 CHECK(used_requests>=0),used_audio_ms integer NOT NULL DEFAULT 0 CHECK(used_audio_ms>=0),
 CHECK(ends_at>starts_at AND ends_at-starts_at<=interval '1 day'),CHECK(used_requests<=max_requests AND used_audio_ms<=max_audio_ms),
 UNIQUE(authorization_ref,actor_id,consultation_id)
);
ALTER TABLE public.speech_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_allowances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.speech_operations,public.speech_allowances FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.speech_operations,public.speech_allowances TO service_role;
GRANT SELECT ON public.speech_operations TO authenticated;
CREATE POLICY speech_treating ON public.speech_operations FOR SELECT TO authenticated USING(actor_id=private.current_app_user_id() AND private.can_edit_encounter(consultation_id));
CREATE FUNCTION public.speech_admit(k uuid,cid uuid,sid uuid,seq integer,expected integer,sha text,duration integer,bytes integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();o public.speech_operations;c public.consultations;req jsonb;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF k IS NULL OR sid IS NULL OR seq IS NULL OR expected IS NULL OR sha IS NULL OR duration IS NULL OR bytes IS NULL THEN RAISE EXCEPTION 'INVALID_AUDIO';END IF;
 IF NOT private.can_edit_encounter(cid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 req:=jsonb_build_object('consultationId',cid,'segmentId',sid,'sequence',seq,'expectedRevision',expected,'sha256',sha,'durationMs',duration,'bytes',bytes);
 PERFORM pg_advisory_xact_lock(hashtextextended('speech:'||a::text,0));
 SELECT * INTO o FROM public.speech_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF o.request<>req THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN o.id;END IF;
 SELECT * INTO c FROM public.consultations WHERE id=cid FOR UPDATE;
 IF c.status<>'active' OR c.revision<>expected THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=c.workspace_id AND is_demo) THEN RAISE EXCEPTION 'SYNTHETIC_ONLY';END IF;
 IF seq<>(SELECT count(*) FROM public.clinical_segments WHERE consultation_id=cid) THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF (SELECT count(*) FROM public.speech_operations WHERE actor_id=a AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF (SELECT count(*) FROM public.speech_operations WHERE actor_id=a)>=200 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 INSERT INTO public.speech_operations(actor_id,consultation_id,operation_key,request,segment_id,sequence,expected_revision,audio_sha256,duration_ms,byte_count) VALUES(a,cid,k,req,sid,seq,expected,sha,duration,bytes) RETURNING id INTO o.id;RETURN o.id;
END $$;
CREATE FUNCTION public.speech_reserve(oid uuid,budget_ref text,sha text,duration integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;b public.speech_allowances;BEGIN
 PERFORM 1 FROM public.consultations WHERE id=(SELECT consultation_id FROM public.speech_operations WHERE id=oid) FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('speech-global',0));
 UPDATE public.speech_operations SET status='outcome_unknown',error_code='LEASE_EXPIRED' WHERE status='transmitting' AND lease_until<now();
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'admitted' OR o.audio_sha256<>sha OR o.duration_ms<>duration OR NOT private.actor_can_edit_encounter(o.actor_id,o.consultation_id) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.consultations WHERE id=o.consultation_id AND status='active' AND revision=o.expected_revision) THEN UPDATE public.speech_operations SET status='stale',error_code='REVISION_CONFLICT' WHERE id=oid;RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.speech_operations WHERE status='transmitting') THEN RETURN false;END IF;
 SELECT * INTO b FROM public.speech_allowances WHERE authorization_ref=budget_ref AND actor_id=o.actor_id AND consultation_id=o.consultation_id AND enabled AND starts_at<=now() AND ends_at>now() ORDER BY id FOR UPDATE LIMIT 1;
 IF NOT FOUND OR b.used_requests>=b.max_requests OR b.used_audio_ms+duration>b.max_audio_ms THEN UPDATE public.speech_operations SET status='unavailable',error_code='NO_AUDIO_ALLOWANCE' WHERE id=oid;RETURN false;END IF;
 UPDATE public.speech_allowances SET used_requests=used_requests+1,used_audio_ms=used_audio_ms+duration WHERE id=b.id;
 UPDATE public.speech_operations SET status='transmitting',mode='offline_fixture',lease_until=now()+interval '60 seconds' WHERE id=oid;RETURN true;
END $$;
CREATE FUNCTION public.speech_result(oid uuid,next_state text,transcript text DEFAULT NULL,request_id text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF NOT private.actor_can_edit_encounter(o.actor_id,o.consultation_id) THEN UPDATE public.speech_operations SET status='stale',response_text=NULL,error_code='ACCESS_CHANGED' WHERE id=oid;RETURN false;END IF;
 IF o.status='admitted' AND next_state=ANY(ARRAY['unavailable','cancelled']) THEN UPDATE public.speech_operations SET status=next_state,error_code=CASE WHEN next_state='unavailable' THEN 'LIVE_SPEECH_DISABLED' ELSE 'CANCELLED_BEFORE_SEND' END WHERE id=oid;RETURN true;END IF;
 IF o.status<>'transmitting' THEN RETURN false;END IF;
 IF o.lease_until<now() THEN UPDATE public.speech_operations SET status='outcome_unknown',error_code='LEASE_EXPIRED' WHERE id=oid;RETURN false;END IF;
 IF next_state<>ALL(ARRAY['responded','rejected','outcome_unknown']) OR next_state IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 IF next_state='responded' AND (transcript IS NULL OR length(btrim(transcript)) NOT BETWEEN 1 AND 8000) THEN RAISE EXCEPTION 'INVALID_FINAL_TRANSCRIPT';END IF;
 UPDATE public.speech_operations SET status=next_state,response_text=CASE WHEN next_state='responded' THEN transcript ELSE NULL END,provider_request_id=request_id,error_code=CASE WHEN next_state='rejected' THEN 'INVALID_FINAL_TRANSCRIPT' WHEN next_state='outcome_unknown' THEN 'TRANSCRIPTION_OUTCOME_UNKNOWN' END WHERE id=oid;RETURN true;
END $$;
CREATE FUNCTION public.speech_commit(oid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;c public.consultations;r jsonb;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid;
 IF NOT FOUND OR o.actor_id IS DISTINCT FROM private.current_app_user_id() OR NOT private.can_edit_encounter(o.consultation_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO c FROM public.consultations WHERE id=o.consultation_id FOR UPDATE;
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF o.status='saved' THEN RETURN o.response;END IF;
 IF o.status<>'responded' THEN RAISE EXCEPTION 'RESULT_UNAVAILABLE';END IF;
 IF c.status<>'active' OR c.revision<>o.expected_revision THEN UPDATE public.speech_operations SET status='stale',error_code='REVISION_CONFLICT' WHERE id=oid;RETURN jsonb_build_object('state','stale','operationId',oid);END IF;
 r:=public.clinical_mutate(o.operation_key,jsonb_build_object('action','transcript','consultationId',c.id,'expectedRevision',c.revision,'segment',jsonb_build_object('id',o.segment_id,'sequence',o.sequence,'text',o.response_text,'speaker','unknown','language','unknown','startMs',NULL,'endMs',NULL)));
 UPDATE public.clinical_segments SET source_type='speech',start_ms=0,end_ms=o.duration_ms WHERE id=o.segment_id AND consultation_id=c.id;
 r:=r||jsonb_build_object('state','saved','operationId',oid,'segmentId',o.segment_id,'mode',o.mode);
 UPDATE public.speech_operations SET status='saved',response=r,lease_until=NULL WHERE id=oid;RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.speech_admit(uuid,uuid,uuid,integer,integer,text,integer,integer),public.speech_commit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.speech_admit(uuid,uuid,uuid,integer,integer,text,integer,integer),public.speech_commit(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.speech_reserve(uuid,text,text,integer),public.speech_result(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.speech_reserve(uuid,text,text,integer),public.speech_result(uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
