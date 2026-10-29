BEGIN;
-- Replace the finite-demo's unconditional minute floor with a minimum debounce
-- plus the verified GPT-OSS-20B Free account window. Existing allowances, counters,
-- authorizations and next_send_at remain unchanged. This enables no provider.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.provider_allowances'::regclass
 AND contype='c' AND pg_get_constraintdef(oid) LIKE '%min_interval_seconds >= 60%'
 LOOP EXECUTE format('ALTER TABLE public.provider_allowances DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE public.provider_allowances ADD CONSTRAINT live_allowance_bounded_cadence
 CHECK(mode='offline_fixture' OR (max_per_day<=10 AND max_actor_day<=3 AND min_interval_seconds>=5 AND ends_at-starts_at<=interval '30 days'));

ALTER FUNCTION public.ai_reserve(uuid,integer,text,text,integer,integer,text) RENAME TO ai_reserve_before_quota_window;
REVOKE ALL ON FUNCTION public.ai_reserve_before_quota_window(uuid,integer,text,text,integer,integer,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.ai_reserve(jid uuid,f integer,execution_mode text,model_name text,input_bound integer,output_bound integer,budget_ref text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tokens bigint;calls integer;daily_tokens bigint;daily_calls integer;resume_at timestamptz;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('cliniq-ai-global-send',0));
 IF execution_mode='live' AND model_name='openai/gpt-oss-20b' THEN
  IF input_bound IS NULL OR output_bound IS NULL OR input_bound NOT BETWEEN 1 AND 5000 OR output_bound NOT BETWEEN 1 AND 3000 OR input_bound+output_bound>8000 THEN RAISE EXCEPTION 'INVALID_BUDGET';END IF;
  -- Unknown outcomes keep their full reservation. A confirmed response releases
  -- only the unused part. All authorization refs share this account/model window.
  SELECT coalesce(sum(coalesce(p.actual_input,p.reserved_input)+coalesce(p.actual_output,p.reserved_output)),0),count(*)::integer,min(p.created_at)+interval '61 seconds'
  INTO tokens,calls,resume_at FROM public.provider_attempts p JOIN public.provider_budgets b ON b.id=p.budget_id
  WHERE b.mode='live' AND b.model=model_name AND p.created_at>clock_timestamp()-interval '61 seconds';
  SELECT coalesce(sum(coalesce(p.actual_input,p.reserved_input)+coalesce(p.actual_output,p.reserved_output)),0),count(*)::integer
  INTO daily_tokens,daily_calls FROM public.provider_attempts p JOIN public.provider_budgets b ON b.id=p.budget_id
  WHERE b.mode='live' AND b.model=model_name AND p.created_at>date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  IF daily_tokens+input_bound+output_bound>200000 OR daily_calls>=1000 THEN
   UPDATE public.document_jobs SET status='exhausted',lease_until=NULL,error_code='ACCOUNT_DAILY_QUOTA' WHERE id=jid AND status='running' AND fence=f AND provider_attempt_id IS NULL;
   RETURN NULL;
  END IF;
  IF tokens+input_bound+output_bound>8000 OR calls>=30 THEN
   UPDATE public.document_jobs SET status='queued',available_at=resume_at,lease_until=NULL,error_code='TOKEN_WINDOW' WHERE id=jid AND status='running' AND fence=f AND provider_attempt_id IS NULL;
   UPDATE public.provider_allowances SET next_send_at=greatest(next_send_at,resume_at) WHERE authorization_ref=budget_ref;
   RETURN NULL;
  END IF;
 END IF;
 RETURN public.ai_reserve_before_quota_window(jid,f,execution_mode,model_name,input_bound,output_bound,budget_ref);
END $$;
REVOKE ALL ON FUNCTION public.ai_reserve(uuid,integer,text,text,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_reserve(uuid,integer,text,text,integer,integer,text) TO service_role;

COMMIT;
