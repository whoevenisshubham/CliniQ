-- Run read-only against the intended project BEFORE preparing a forward upgrade.
-- Reports schema metadata only. Do not export medical rows or credential values.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT current_database() AS database_name, current_user AS inspection_role,
       current_setting('server_version') AS postgres_version;

SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema IN ('public', 'storage')
ORDER BY table_schema, table_name, ordinal_position;

SELECT n.nspname AS schema_name, c.relname AS relation_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p')
ORDER BY 1, 2;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public', 'storage')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema IN ('public', 'private')
ORDER BY routine_schema, routine_name, grantee;

SELECT n.nspname AS schema_name, c.relname AS relation_name, con.conname,
       pg_get_constraintdef(con.oid) AS definition, con.convalidated
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' ORDER BY 1, 2, 3;

-- Bucket names/configuration only; never object paths or signed URLs.
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;

-- Confirm existence before running optional per-project inventory queries.
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_ledger,
       to_regclass('public.users') AS application_users,
       to_regclass('public.workspace_memberships') AS memberships;

ROLLBACK;
