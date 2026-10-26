BEGIN;
-- Forward-only capacity amendment. No allowance, identity, credential or flag changes.
ALTER TABLE public.speech_operations DROP CONSTRAINT speech_operations_duration_ms_check;
ALTER TABLE public.speech_operations ADD CONSTRAINT speech_operations_duration_ms_check CHECK(duration_ms BETWEEN 1 AND 60000);
ALTER TABLE public.speech_operations DROP CONSTRAINT speech_operations_byte_count_check;
ALTER TABLE public.speech_operations ADD CONSTRAINT speech_operations_byte_count_check CHECK(byte_count BETWEEN 46 AND 1920044);
ALTER TABLE public.speech_operations ADD COLUMN raw_provider_response jsonb CHECK(octet_length(raw_provider_response::text)<=131072);
-- Keep the unreviewed provider result separate from mutable clinical segments.
-- The existing result function retains ownership, lease and state-transition fences.
CREATE FUNCTION public.speech_result_with_raw(oid uuid,next_state text,transcript text,request_id text,raw jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE accepted boolean;
BEGIN
 IF raw IS NULL OR jsonb_typeof(raw)<>'object' OR octet_length(raw::text)>131072 THEN RAISE EXCEPTION 'INVALID_SPEECH_RESPONSE'; END IF;
 accepted:=public.speech_result(oid,next_state,transcript,request_id);
 IF accepted AND next_state='responded' THEN
  UPDATE public.speech_operations SET raw_provider_response=raw WHERE id=oid;
 END IF;
 RETURN accepted;
END $$;
REVOKE ALL ON FUNCTION public.speech_result_with_raw(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.speech_result_with_raw(uuid,text,text,text,jsonb) TO service_role;
COMMIT;
