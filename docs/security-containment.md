# Security containment status

The legacy clinical APIs are temporarily closed while identity, database policies
and scoped services are upgraded. Existing domain implementations are retained
behind explicit containment wrappers for focused repair. No runtime flag bypasses
this boundary. Signed-in users receive `503 WORKFLOW_NOT_READY`; requests without
a verified identity fail admission. Missing configuration returns an actionable
`503` without creating a fake session.

`/api/seed` returns `410` and cannot provision or reset users. `/api/transcribe`
never returns provider credentials. External AI, speech and OCR requests are
disabled by containment. The old unsigned session cookie is ignored.

Password login uses Supabase Auth. An application account must have an explicit
`auth_user_id` link and `is_active = true`. Existing application IDs are preserved;
matching email or client-supplied role metadata never links or promotes an account.
No account bootstrap, staff provisioning or schema backfill runs on login.

Copy `.env.example` to `.env.local` and configure the exact `APP_ORIGIN` plus the
intended Supabase public configuration. Keep the service-role key server-only.
The authenticated user client resolves identity. Password and logout mutations
require the exact configured Origin. Request bodies and errors are bounded.

Before reopening a legacy endpoint:

1. Inspect the actual schema, policies, privileges and private buckets with
   `scripts/inspect-schema.sql`; separately inventory migration versions and
   aggregate mapping/duplicate counts after confirming the actual column types.
2. Prepare and test a non-destructive forward migration and a fresh isolated
   baseline. Do not blindly replay the historical migrations: duplicate version
   numbers, incompatible demo inserts and permissive policies remain in them.
3. Replace its wrapper with an authenticated, resource-scoped service using the
   user's RLS client. Validate origin, fields and operation semantics.
4. Pass direct HTTP, database and Storage denial tests for multiple actors and
   workspaces, including inactive accounts and cross-resource access.

`npm run test:unit` exercises offline admission and identity handling; it does not
prove actual Supabase Auth, RLS or Storage isolation. Hosted deployment, Google
OIDC, demo provisioning, persistent workflows and release verification remain
unfinished. No remote schema changes are part of this containment increment.

The SSR client retains CliniQ's existing implementation and adapts the explicit
configuration validation from MediFlow's `src/lib/supabase/server.ts` at revision
`45fbfb853338d5236f2c34eb83e771ac4e9307ca` (Sujit Jaju and contributors).
MediFlow's custom session/doctor-as-receptionist scheme is not imported. Broader
clinical-module reuse remains part of the subsequent scoped workflow work.
