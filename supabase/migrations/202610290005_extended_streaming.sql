BEGIN;
-- Streaming capacity only. No allowance, counter, identity or provider flag changes.
-- HTTP WAV validation retains its independent one-minute/1,920,044-byte bound.
ALTER TABLE public.speech_operations DROP CONSTRAINT speech_operations_duration_ms_check;
ALTER TABLE public.speech_operations ADD CONSTRAINT speech_operations_duration_ms_check CHECK(duration_ms BETWEEN 1 AND 180000);
ALTER TABLE public.speech_operations DROP CONSTRAINT speech_operations_byte_count_check;
ALTER TABLE public.speech_operations ADD CONSTRAINT speech_operations_byte_count_check CHECK(byte_count BETWEEN 46 AND 5760044);
CREATE OR REPLACE FUNCTION public.speech_stream_mark(oid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'transmitting' OR o.mode IS DISTINCT FROM 'live' OR o.request ? 'transport' OR o.created_at<now()-interval '10 seconds' OR o.duration_ms NOT BETWEEN 1 AND 180000 THEN RETURN false;END IF;
 UPDATE public.speech_operations SET request=request||jsonb_build_object('transport','streaming','reservedAudioMs',duration_ms,'reservationHash',audio_sha256),lease_until=created_at+(duration_ms+30000)*interval '1 millisecond' WHERE id=oid;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.speech_stream_receipt(oid uuid,sha text,pcm_bytes integer,transcript text,request_id text,raw jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'transmitting' OR (o.request->>'transport') IS DISTINCT FROM 'streaming' OR o.lease_until<now() THEN RETURN false;END IF;
 IF sha IS NULL OR sha!~'^[a-f0-9]{64}$' OR pcm_bytes IS NULL OR pcm_bytes NOT BETWEEN 2 AND 5760000 OR pcm_bytes%2<>0 OR pcm_bytes>coalesce((o.request->>'reservedAudioMs')::integer,0)*32 THEN RAISE EXCEPTION 'INVALID_AUDIO';END IF;
 UPDATE public.speech_operations SET audio_sha256=sha,duration_ms=ceil(pcm_bytes/32.0)::integer,byte_count=pcm_bytes+44 WHERE id=oid;
 RETURN public.speech_result_with_raw(oid,'responded',transcript,request_id,raw);
END $$;
-- CREATE OR REPLACE preserves the existing service-only EXECUTE privileges.
NOTIFY pgrst,'reload schema';
COMMIT;
