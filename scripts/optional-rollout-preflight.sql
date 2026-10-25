-- Read-only. Run privately only after target identity is independently verified.
-- No secret, actor text, password, key or function source is returned.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_setting('server_version') AS database_version;
SELECT to_regprocedure('public.optional_capabilities()') IS NULL AS optional_schema_absent,
 to_regprocedure('public.document_claim(uuid)') IS NOT NULL AS established_document_worker,
 to_regprocedure('public.ai_reconcile()') IS NOT NULL AS established_recovery;
SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN ('document_jobs','document_versions','provider_allowances','provider_budgets','speech_operations','speech_allowances') ORDER BY table_name,ordinal_position;
SELECT kind,status,count(*) FROM public.document_jobs GROUP BY kind,status ORDER BY kind,status;
SELECT count(*) FILTER(WHERE active>0) AS active_provider_budgets FROM public.provider_budgets;
SELECT count(*) FILTER(WHERE status='transmitting') AS transmitting_speech FROM public.speech_operations;
SELECT id,public FROM storage.buckets WHERE id IN ('clinical-documents','clinical-audio-temp') ORDER BY id;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;
-- Capture complete original-column row digests privately with the guarded
-- isolated rehearsal's snapshot method; compare after upgrade. Do not publish
-- Auth IDs or data. Confirm the 14-file accepted manifest in optional-rollout.json
-- against the preserved provisioning journal, not frontend build metadata alone.
ROLLBACK;
