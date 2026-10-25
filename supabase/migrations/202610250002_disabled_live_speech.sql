BEGIN;
-- Offline-prepared only. No allowance rows, credentials or hosted changes.
ALTER TABLE public.speech_operations DROP CONSTRAINT speech_operations_mode_check;
ALTER TABLE public.speech_operations ADD CONSTRAINT speech_operations_mode_check CHECK(mode IN ('offline_fixture','live'));
ALTER TABLE public.speech_allowances DROP CONSTRAINT speech_allowances_mode_check;
ALTER TABLE public.speech_allowances ADD CONSTRAINT speech_allowances_mode_check CHECK(mode IN ('offline_fixture','live'));
ALTER TABLE public.speech_allowances ADD COLUMN model text NOT NULL DEFAULT 'nova-2' CHECK(model='nova-2');
ALTER TABLE public.speech_allowances ADD COLUMN requested_language text NOT NULL DEFAULT 'hi' CHECK(requested_language='hi');
ALTER TABLE public.speech_allowances ADD COLUMN min_interval_seconds integer NOT NULL DEFAULT 60 CHECK(min_interval_seconds BETWEEN 0 AND 3600);
ALTER TABLE public.speech_allowances ADD COLUMN next_send_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.speech_allowances ADD CONSTRAINT live_speech_pacing CHECK(mode='offline_fixture' OR min_interval_seconds>=60);
DROP FUNCTION public.speech_reserve(uuid,text,text,integer);
CREATE FUNCTION public.speech_reserve(oid uuid,budget_ref text,sha text,duration integer,execution_mode text DEFAULT 'offline_fixture') RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;b public.speech_allowances;BEGIN
 IF execution_mode IS NULL OR execution_mode NOT IN ('offline_fixture','live') THEN RETURN false;END IF;
 PERFORM 1 FROM public.consultations WHERE id=(SELECT consultation_id FROM public.speech_operations WHERE id=oid) FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('speech-global',0));
 UPDATE public.speech_operations SET status='outcome_unknown',error_code='LEASE_EXPIRED' WHERE status='transmitting' AND lease_until<now();
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'admitted' OR o.audio_sha256<>sha OR o.duration_ms<>duration OR NOT private.actor_can_edit_encounter(o.actor_id,o.consultation_id) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.consultations WHERE id=o.consultation_id AND status='active' AND revision=o.expected_revision) THEN UPDATE public.speech_operations SET status='stale',error_code='REVISION_CONFLICT' WHERE id=oid;RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.speech_operations WHERE status='transmitting') THEN RETURN false;END IF;
 SELECT * INTO b FROM public.speech_allowances WHERE authorization_ref=budget_ref AND mode=execution_mode AND model=o.model AND requested_language=o.requested_language AND actor_id=o.actor_id AND consultation_id=o.consultation_id AND enabled AND starts_at<=now() AND ends_at>now() ORDER BY id FOR UPDATE LIMIT 1;
 IF NOT FOUND OR b.used_requests>=b.max_requests OR b.used_audio_ms+duration>b.max_audio_ms THEN UPDATE public.speech_operations SET status='unavailable',error_code='NO_AUDIO_ALLOWANCE' WHERE id=oid;RETURN false;END IF;
 IF b.mode='live' AND b.next_send_at>now() THEN UPDATE public.speech_operations SET status='unavailable',error_code='AUDIO_PACING' WHERE id=oid;RETURN false;END IF;
 UPDATE public.speech_allowances SET next_send_at=CASE WHEN mode='live' THEN now()+make_interval(secs=>min_interval_seconds) ELSE next_send_at END,used_requests=used_requests+1,used_audio_ms=used_audio_ms+duration WHERE id=b.id;
 UPDATE public.speech_operations SET status='transmitting',mode=execution_mode,lease_until=now()+interval '60 seconds' WHERE id=oid;RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.speech_result(oid uuid,next_state text,transcript text DEFAULT NULL,request_id text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF NOT private.actor_can_edit_encounter(o.actor_id,o.consultation_id) THEN UPDATE public.speech_operations SET status='stale',response_text=NULL,error_code='ACCESS_CHANGED' WHERE id=oid;RETURN false;END IF;
 IF o.status='admitted' AND next_state=ANY(ARRAY['unavailable','cancelled']) THEN UPDATE public.speech_operations SET status=next_state,error_code=CASE WHEN next_state='unavailable' THEN 'LIVE_SPEECH_DISABLED' ELSE 'CANCELLED_BEFORE_SEND' END WHERE id=oid;RETURN true;END IF;
 IF o.status<>'transmitting' THEN RETURN false;END IF;
 IF o.lease_until<now() THEN UPDATE public.speech_operations SET status='outcome_unknown',error_code='LEASE_EXPIRED' WHERE id=oid;RETURN false;END IF;
 IF next_state<>ALL(ARRAY['responded','rejected','outcome_unknown','unavailable']) OR next_state IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 IF next_state='responded' AND (transcript IS NULL OR length(btrim(transcript)) NOT BETWEEN 1 AND 8000) THEN RAISE EXCEPTION 'INVALID_FINAL_TRANSCRIPT';END IF;
 UPDATE public.speech_operations SET status=next_state,response_text=CASE WHEN next_state='responded' THEN transcript ELSE NULL END,provider_request_id=request_id,error_code=CASE WHEN next_state='unavailable' THEN 'SPEECH_PROVIDER_UNAVAILABLE' WHEN next_state='rejected' THEN 'INVALID_FINAL_TRANSCRIPT' WHEN next_state='outcome_unknown' THEN 'TRANSCRIPTION_OUTCOME_UNKNOWN' END WHERE id=oid;RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.speech_reserve(uuid,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.speech_reserve(uuid,text,text,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
