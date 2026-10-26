BEGIN;
-- Unreviewed provider text is kept apart from accepted operations/corrections.
-- provider_attempts remains service-only; no new client/table privileges.
ALTER TABLE public.provider_attempts ADD COLUMN raw_response text CHECK(octet_length(raw_response)<=65536);
CREATE FUNCTION public.ai_raw_capability() RETURNS integer LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT 1 $$;
CREATE FUNCTION public.ai_retain_raw(aid uuid,raw text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF raw IS NULL OR octet_length(raw)>65536 THEN RAISE EXCEPTION 'INVALID_PROVIDER_RESPONSE';END IF;
 UPDATE public.provider_attempts SET raw_response=raw WHERE id=aid AND state='sent' AND raw_response IS NULL;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.ai_raw_capability(),public.ai_retain_raw(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_raw_capability(),public.ai_retain_raw(uuid,text) TO service_role;
COMMIT;
