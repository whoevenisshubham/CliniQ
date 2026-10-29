-- Read-only; do not confuse schema readiness with enabled provider capability.
BEGIN READ ONLY;
SELECT public.optional_capabilities(); -- expected {ocr:1,speech:1}
SELECT p.oid::regprocedure AS function,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('ocr_admit','ocr_review_admit','ocr_cancel','ocr_claim','ocr_reserve','ocr_before_send_fail','optional_capabilities','speech_reserve') ORDER BY p.proname;
SELECT id,public FROM storage.buckets WHERE id IN ('clinical-documents','clinical-audio-temp') ORDER BY id;
SELECT 'provider_allowances' AS ledger,count(*) AS existing_rows,count(*) FILTER(WHERE enabled) AS enabled_rows FROM public.provider_allowances
 UNION ALL SELECT 'provider_budgets',count(*),count(*) FILTER(WHERE enabled) FROM public.provider_budgets
 UNION ALL SELECT 'speech_allowances',count(*),count(*) FILTER(WHERE enabled) FROM public.speech_allowances;
SELECT conrelid::regclass AS relation,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('public.document_jobs'::regclass,'public.provider_budgets'::regclass,'public.speech_operations'::regclass,'public.speech_allowances'::regclass) ORDER BY conrelid,conname;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;
ROLLBACK;
