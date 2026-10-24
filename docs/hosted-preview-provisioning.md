# Guarded new-preview provisioning

`scripts/hosted-preview.mjs` is an explicit, single-use owner-approved setup adapter for a **new empty Free** `cliniqplus-v2-preview` in Mumbai. It is not a historical project upgrade/reset tool, an application endpoint, or an automatic seed. `pg` is a development-only Postgres transport to the existing Supabase stack.

Before execution, verify the actual new project/ref, Free plan, region and creation incident status in the owner account. Preserve historical projects and production. Prepare a private approval JSON outside Git with:

```json
{
  "version": 1,
  "projectName": "cliniqplus-v2-preview",
  "projectRef": "<verified-new-project-reference>",
  "region": "ap-south-1",
  "plan": "Free",
  "newEmptyProject": true,
  "sourceSha": "<reviewed-clean-committed-source>",
  "databaseHost": "<verified-direct-or-Mumbai-session-pooler-host>",
  "maxActors": 6,
  "workspaces": 2,
  "liveProviders": false,
  "migrations": {"<every-active-plan-path>": "<exact-committed-sha256>"}
}
```

Generate the source/hash template with read-only `node scripts/hosted-preview.mjs --plan` from a clean committed checkout. It leaves the project reference/host unassigned and creates no account or connection. Use all paths/hashes from `loadMigrationPlan`, not the example's placeholder entry. Optionally supply `caPath` to the privately retained official project CA certificate. Never disable certificate validation. The exact approval-file SHA256 is an execution argument, so changes require deliberate review. It is an accidental-target/change guard, not a cryptographic owner signature or an automatic verification of account plan/region.

Provide only the new project's `CLINIQ_PREVIEW_DATABASE_URL` and `CLINIQ_PREVIEW_SERVICE_ROLE_KEY` through secure process configuration, never command arguments, chat or public files. The direct host must be `db.<exact-ref>.supabase.co` with `postgres`; a Mumbai session pooler must use `postgres.<exact-ref>` and the separately verified exact hostname. Only port 5432 is accepted; URI query/TLS overrides and transaction pooling are refused. Legacy service JWTs must identify the same ref and service role. Both historical project-reference hashes are permanently refused. Current-source/manifest/clean-tree validation precedes connections.

After adapter verification and target authorization, the explicit command is:

```text
node scripts/hosted-preview.mjs --apply-hosted-preview <private-approval.json> <approval-file-sha256> <new-directory-under-user-.codex/private>
```

The command does not load a general `.env` automatically. Its private credential vault requires Windows current-user DPAPI. The vault stores generated synthetic passwords encrypted before any mutation; progress stores only stages and explicit IDs. No credential value is printed. Keep the journal/vault private and together. Do not execute this CLI in CI or against a historical project. The separate fresh-local CI rehearsal invokes only the orchestration with a verified local connection and memory-only synthetic credentials; it does not weaken the hosted CLI's transport guard.

The adapter takes a session advisory lock, refuses existing application relations/routines, unknown schemas, Auth users, buckets/objects and migration history. It applies the same committed baseline/forward plan in one SQL transaction, recording source/hash identity in a private administrative table. It then creates at most six synthetic Auth users: patient A/B, doctor A/B, unrelated doctor U, and reception. Returned Auth IDs are linked explicitly to new application IDs in a second SQL transaction with exactly two workspaces, two patients, four staff memberships, three care relationships and two explicitly synthetic tariffs. No clinical findings, prescriptions, document grants or availability/booking actions are fabricated. RLS and private buckets are checked after commit. Live providers are never invoked or enabled.

Auth and SQL cannot share one atomic transaction. Before each Auth creation, current IDs must exactly match this run's known created IDs. Unknown creation/commit stops immediately; no account is located/merged by email or metadata, no create is resent, and no password/account/schema is reset or deleted. The private journal retains the unknown stage and known identifiers. An interrupted run requires inspection and a separately reviewed forward-recovery plan; it must not be rerun with a new journal to evade preservation checks. A confirmed database commit with failed journal write remains uncertain in the journal, not rolled back by destructive cleanup.

Guard/orchestration unit tests use doubles. The dedicated fresh CI job separately rehearses actual baseline SQL, six real Auth creations and transactional mappings, followed by four real logins/scoped patient reads. These do not establish remote TLS credentials, hosted application/browser persistence, Netlify runtime, worker archive, scheduling behavior or live-provider acceptance. The specifically rejected scheduling suite remains absent.
