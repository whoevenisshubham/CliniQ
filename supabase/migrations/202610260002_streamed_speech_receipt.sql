BEGIN;
-- Additive stream receipt around existing identity, allowance and publication fences.
-- A session reserves its full cap. Unused milliseconds are not refunded/replayed.
CREATE FUNCTION public.speech_stream_capability() RETURNS integer LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.speech_stream_capability() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.speech_stream_capability() TO authenticated,service_role;
CREATE FUNCTION public.speech_stream_mark(oid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations; BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'transmitting' OR o.mode<>'live' OR o.request ? 'transport' OR o.created_at<now()-interval '10 seconds' THEN RETURN false;END IF;
 UPDATE public.speech_operations SET request=request||jsonb_build_object('transport','streaming','reservedAudioMs',duration_ms,'reservationHash',audio_sha256),lease_until=created_at+interval '90 seconds' WHERE id=oid;
 RETURN true;
END $$;
CREATE FUNCTION public.speech_stream_receipt(oid uuid,sha text,pcm_bytes integer,transcript text,request_id text,raw jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations; BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'transmitting' OR o.request->>'transport'<>'streaming' OR o.lease_until<now() THEN RETURN false;END IF;
 IF sha IS NULL OR sha!~'^[a-f0-9]{64}$' OR pcm_bytes IS NULL OR pcm_bytes NOT BETWEEN 2 AND 1920000 OR pcm_bytes%2<>0 THEN RAISE EXCEPTION 'INVALID_AUDIO';END IF;
 UPDATE public.speech_operations SET audio_sha256=sha,duration_ms=ceil(pcm_bytes/32.0)::integer,byte_count=pcm_bytes+44 WHERE id=oid;
 RETURN public.speech_result_with_raw(oid,'responded',transcript,request_id,raw);
END $$;
REVOKE ALL ON FUNCTION public.speech_stream_mark(uuid),public.speech_stream_receipt(uuid,text,integer,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.speech_stream_mark(uuid),public.speech_stream_receipt(uuid,text,integer,text,text,jsonb) TO service_role;
COMMIT;
