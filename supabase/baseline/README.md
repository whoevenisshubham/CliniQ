# Isolated baseline and forward upgrade

`001_domain.sql` retains CliniQ's inspected UUID domain tables, fields, indexes
and timestamp triggers from d2fadb6. Seeds and permissive policies are excluded.
Apply it together with `../migrations/202610230001_identity_isolation.sql` in a
fresh isolated environment. Neither file provisions people or guesses identity.
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
Uploads require pre-registered owned metadata. M2 still owns admission quotas,
upload sagas, grant/revoke transactions, parsing and the document UI.
