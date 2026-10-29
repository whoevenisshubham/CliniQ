# Isolated baseline and forward upgrade

`001_domain.sql` retains CliniQ's inspected UUID domain tables, fields, indexes
and timestamp triggers from d2fadb6. Seeds and permissive policies are excluded.
Apply it before the active forward migrations in a fresh isolated environment.
`scripts/migration-plan.mjs` is the authoritative discovery/execution/evidence
plan: only 12–14 digit version prefixes followed by a descriptive lowercase name
are active, ordered by version; duplicate versions fail. Historical short-numbered
seed/permissive SQL is excluded. All active migrations are applied atomically by
the isolated rehearsal. Neither the baseline nor forward DDL provisions people
or guesses identity.
Do not replay the historical numbered migrations as a fresh setup sequence.

The forward migration preserves existing application UUIDs and clinical payloads.
It adds explicit Auth links, memberships and revocable purpose-specific care links,
adapting MediFlow's patient_doctors relationship within PostgreSQL. It removes
39 exact known legacy policies; unexpected policies/identity types or duplicate
patient ownership stop the transaction for explicit reconciliation. Existing
unlinked accounts stay unlinked. Nullable demographics follow MediFlow's model.

Before a hosted upgrade: inspect actual schema, policies, privileges, views,
RPCs, buckets and aggregate duplicates; verify backup/recovery and exact identity
link evidence. This migration is validated against the representative isolated
fixture, not an unknown live schema. No hosted upgrade is automatic or authorized
by running tests. Existing Storage policies deliberately require reconciliation.

Storage has no authenticated SELECT/signing policy. This prevents direct bearer
signed downloads surviving revocation. Private content is served by the byte
proxy, which reads metadata through caller RLS before requesting the exact key.
Uploads require pre-registered owned metadata. The document forward migration
implements admission quotas, upload sagas, grant/revoke transactions and parsing;
see `docs/documents.md` for the actual journey and remaining hosted acceptance.

Preservation evidence records each active path once, exact committed Git-blob
SHA-256, raw working-tree SHA-256, LF-normalized execution SHA-256 and whether
executed text matches the committed source. SQL checkout endings are pinned to LF
by `.gitattributes`. Older artifacts used raw checkout hashes and are retained with
that original scope; they are not silently reinterpreted as canonical blob hashes.
