-- Same read-only digest query before/after. Preserve output privately and compare
-- exactly. Omits ONLY the explicitly additive columns in these two migrations.
-- No row text/IDs or credentials are output, and no temporary objects are written.
BEGIN READ ONLY;
SELECT tablename,query_to_xml(format(
 'SELECT count(*) AS rows,md5(coalesce(string_agg(x::text,''|'' ORDER BY x::text),'''')) AS digest FROM (SELECT to_jsonb(t)-%L::text[] AS x FROM public.%I t) s',
 CASE tablename
 WHEN 'document_versions' THEN '{reviewed_ocr}'
 WHEN 'upload_operations' THEN '{reviewed_ocr}'
 WHEN 'provider_allowances' THEN '{ocr_max_input,ocr_max_output}'
 WHEN 'provider_budgets' THEN '{ocr_max_input,ocr_max_output}'
 WHEN 'speech_allowances' THEN '{model,requested_language,min_interval_seconds,next_send_at}'
 ELSE '{}' END,tablename),false,true,'') AS original_column_digest
 FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT 'private.ai_sources_current(public.document_jobs)'::regprocedure::oid AS source_function_oid;
ROLLBACK;
