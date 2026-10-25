# Prepared additive optional-provider rollout (not executed)

Only target: existing isolated **vjlbulywfkixfdsibqgc**, exact PR3 `codex/v2-containment` configuration. Production and historical projects are excluded. No remote apply/configuration/allowance change was made for this preparation. Preserve the private provisioning journal and all six mapped actors; never rerun its empty-project adapter.

Last reconciled schema source: `e04fbcabcd3d6555ac6aa186b61e55348843953c`, through `202610240001_care_owner_correction.sql`. The exact 14-file baseline/forward manifest is `rollout/accepted-schema.json`; current remote equality must be established later, not inferred from a frontend build identity.

| Order | Committed file | SHA-256 of Git blob (LF) |
| --- | --- | --- |
| 1 | `supabase/migrations/202610250001_reviewable_ocr.sql` | `c1731e7c655f41762a46c4b1110d362809f6b2306a014e2bc5a82fb1d2fc552e` |
| 2 | `supabase/migrations/202610250002_disabled_live_speech.sql` | `cc261b4af2b3917384b1bae92560c13feb63a8cf75f6f502a85c035b743176d7` |

`node scripts/prepare-optional-rollout.mjs` validates the unchanged accepted manifest, exactly these two ordered files and their committed/working/executed hashes. It writes `tests/infra/.runtime/optional-rollout.json`; CI retains it beside the worker package smoke. No database/API connection is made by this generator. Compare hashes to the exact committed source before any execution; do not execute pasted or stale copies.

## Before/after preservation

Later, within the existing approved preview scope, independently verify TLS hostname/official CA and the project reference, take/retain an available non-destructive backup, confirm the preserved journal/manifest, and run `scripts/optional-rollout-preflight.sql` read-only. Stop on schema drift, wrong target, active/transmitting provider work or unexpected existing optional objects. Keep all live flags off and pause optional dispatch while reconciling work; do not reset credentials or create another journal.

Run `scripts/optional-preservation-snapshot.sql` before and after, retain outputs privately and compare exact original-column row counts/digests plus source-function OID. It omits only the explicitly additive columns, never rewrites data and exposes no row text. Compare pre/post policies, private buckets, grants, stable document/version/chunk IDs, parent relationships, clinical segments/approved snapshots/prescriptions and completed jobs. Existing allowance rows/counters and Auth mappings must be identical. If they differ, stop enablement and preserve evidence.

Apply only the ordered transactional migrations; then run `scripts/optional-rollout-postflight.sql` read-only. It reports capabilities, constraints, function ACLs, bucket privacy, existing allowance counts and policies. Expected: no new tables/buckets/policies; unchanged existing policies/RLS; OCR provenance columns on versions/uploads; OCR per-request ceiling columns on both existing ledgers; extended job/budget kinds and speech mode constraints; source/claim/retrieval functions replaced in place; OCR family/provenance/attempt triggers. New OCR read/admit/review/cancel functions permit authenticated scoped operations; OCR claim/reserve/pre-send-fail and speech reservation remain service-only. Anonymous execution is denied. `optional_capabilities()` is authenticated/service-only and returns OCR1/speech1. No allowance/scope rows are inserted or enabled, and no existing counter is reset.

The second migration replaces the four-argument speech-reserve signature with a five-argument function whose last argument defaults to `offline_fixture`, preserving existing offline callers. Default speech/live/OCR flags remain disabled. The application checks optional schema readiness before new calls; missing optional RPC/cache fails closed, ordinary document/manual-clinical/account jobs continue, and queued disabled OCR does not starve local document work. Migration apply and capability enablement are separate operations.

## Isolated rehearsal and packaging

The guarded fresh CI preparation first applies only the older accepted schema, uses actual Auth principals to upload/parse/share a private document and manually approve a clinical record, checks account/manual/worker access and accidentally flipped flags, snapshots every existing public table, then applies these two migrations. It compares original-column row hashes, existing policies and function identity and re-reads the authorized bytes/shared document/approved record/account after upgrade. `optional-upgrade.json` is the evidence artifact. Fresh-empty provisioning and the original 15-table/27-row legacy preservation remain separate checks. A failed rehearsal is not acceptance.

The staged Netlify smoke resolves `scripts/ocr-image-worker.mjs` from the function bundle working directory and loads the explicitly packaged native canvas/PDF.js modules, CMaps and standard fonts there. TOML uses `external_node_modules` plus included scripts/assets; the smoke changes to its staged directory and renders PNG and scanned PDF there. It does not establish the actual hosted archive's layout, native ABI, RSS or execution. Those require hosted archive/worker verification later.

## Minimal later authenticated acceptance

1. With flags off on the upgraded preview, returning patient/clinician sessions must retain private documents, explicit grants, manual transcripts, approved records and account data. Care-only/cross-owner/workspace reads stay denied. Check real dispatched established parsing/recovery, not merely HTTP202.
2. After separate exact model/accounting and finite live authorization only, configure the branch-only server variables/rows in [the one account checklist](account-handoff.md). Verify effective build/functions/background scopes without printing values. A missing profile/allowance, stale schema or UI flag alone cannot enable a send.
3. Perform one bounded synthetic OCR operation using privately stored original bytes, observe the actual hosted claim/reservation/render/provider result and valid usage, then correct/confirm/save/reload/sign-out/in. Verify separate transcription, original bytes/version and nonascending original-page mapping; no medicine/approved record is created.
4. Explicit-share/provider read/revoke and cross-owner/workspace denials; replace/delete/cancel before/after transmission must invalidate drafts/results and reject stale publication. Recover retained response/unknown save using the same request without another provider send. Verify actual worker assets/deadline/recovery and retained budget for uncertainty. No preview schedule assumption.

Rollback: disable optional server/public flags and optional dispatch, retain schema/data/journal and recover only established jobs. Current compatible app can keep manual/document/account flows running; if pinning an earlier app, use the reviewed containment build and keep optional flags off. **No destructive down migration, reset, reseed, provisioning rerun or deletion.** Investigate failure before any re-enable. This package is readiness work, not hosted/live/clinical-quality acceptance.
