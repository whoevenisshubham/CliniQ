-- Owner/account-authorized read-only inventory. Does not read patient rows,
-- credentials or object bytes. Definitions can contain deployment-sensitive text:
-- retain all output privately. Never apply a migration here.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SELECT current_database() database_name,version() database_version;
SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default
 FROM information_schema.columns WHERE table_schema IN ('public','storage') ORDER BY table_schema,table_name,ordinal_position;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
 FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;
SELECT n.nspname schema_name,c.relname table_name,c.relrowsecurity rls,c.relforcerowsecurity force_rls
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage') AND c.relkind='r' ORDER BY 1,2;
SELECT n.nspname schema_name,p.proname function_name,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef security_definer,p.proconfig configuration,md5(pg_get_functiondef(p.oid)) definition_hash
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f' ORDER BY 1,2,3;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema IN ('public','storage') AND grantee IN ('anon','authenticated','service_role','PUBLIC') ORDER BY 1,2,3,4;
SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2,3;
SELECT event_object_schema,event_object_table,trigger_name,action_timing,event_manipulation FROM information_schema.triggers WHERE event_object_schema IN ('public','storage') ORDER BY 1,2,3;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;
SELECT to_regclass('supabase_migrations.schema_migrations') migration_history_relation;
SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
 THEN query_to_xml('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version',false,true,'')
 ELSE NULL END actual_migration_versions;
SELECT n.nspname schema_name,c.relname table_name,k.conname constraint_name,k.contype constraint_kind,pg_get_constraintdef(k.oid,true) definition,k.convalidated validated
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','storage') ORDER BY 1,2,3;
SELECT n.nspname schema_name,p.proname function_name,pg_get_function_identity_arguments(p.oid) arguments,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,a.privilege_type
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE n.nspname IN ('public','private') AND p.prokind='f' ORDER BY 1,2,3,4;
SELECT n.nspname schema_name,p.proname function_name,pg_get_functiondef(p.oid) security_definer_definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f' AND p.prosecdef ORDER BY 1,2;
SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname IN ('public','private') ORDER BY 1,2;
SELECT count(*) duplicate_patient_owner_groups FROM (SELECT user_id FROM public.patients WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*)>1) x;
ROLLBACK;
