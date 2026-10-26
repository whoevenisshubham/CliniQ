-- Prepared forward extension; NOT part of the two approved/applied migrations.
-- Apply only after separate review. Preserves all historical Nova-2/hi rows.
BEGIN;
ALTER TABLE public.speech_operations DROP CONSTRAINT speech_operations_model_check;
ALTER TABLE public.speech_operations DROP CONSTRAINT speech_operations_requested_language_check;
ALTER TABLE public.speech_operations ADD CONSTRAINT speech_operations_model_language CHECK ((model='nova-2' AND requested_language='hi') OR (model='nova-3-medical' AND requested_language='multi'));
ALTER TABLE public.speech_allowances DROP CONSTRAINT speech_allowances_model_check;
ALTER TABLE public.speech_allowances DROP CONSTRAINT speech_allowances_requested_language_check;
ALTER TABLE public.speech_allowances ADD CONSTRAINT speech_allowances_model_language CHECK ((model='nova-2' AND requested_language='hi') OR (model='nova-3-medical' AND requested_language='multi'));
CREATE FUNCTION public.speech_bind_target(oid uuid,budget_ref text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.speech_operations;BEGIN
 SELECT * INTO o FROM public.speech_operations WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR o.status<>'admitted' OR o.mode IS NOT NULL OR NOT private.actor_can_edit_encounter(o.actor_id,o.consultation_id) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.speech_allowances WHERE authorization_ref=budget_ref AND actor_id=o.actor_id AND consultation_id=o.consultation_id AND mode='live' AND model='nova-3-medical' AND requested_language='multi' AND enabled AND starts_at<=now() AND ends_at>now()) THEN RETURN false;END IF;
 UPDATE public.speech_operations SET model='nova-3-medical',requested_language='multi' WHERE id=oid;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.speech_bind_target(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.speech_bind_target(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.optional_capabilities() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT '{"ocr":1,"speech":1,"speech_model_binding":1}'::jsonb $$;
NOTIFY pgrst,'reload schema';
COMMIT;
