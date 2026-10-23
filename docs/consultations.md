# Persistent consultation foundation

`/consultations` is the manual clinician/patient workspace. Providers choose a patient from their active care relationship, create a real encounter and initial draft in one transaction, add final typed segments, save findings, review the committed revision and approve. Patients see approved versions only. `/design/consultation` is a labelled non-persistent visual fixture of the same component.

## Authority and recovery

The authenticated `POST /api/clinical` accepts a bounded allowlisted command and an actor-scoped UUID `Idempotency-Key`. PostgreSQL owns admission, serialization and all writes through `clinical_mutate`. Ordinary callers have read-only table privileges. Creation ignores query-string display names; patient/workspace IDs must match current care and membership. Current account, membership and care rows are locked during mutation admission.

Every committed transcript or finding edit increments the encounter and draft revision. Typed transcript IDs and sequence remain stable across retries; speaker/language may explicitly be unknown. No audio timing or automatic diarization is invented. Final text is append-only; later corrections belong in clinician findings and linked approved amendments. Historical CliniQ transcripts and drafts are preserved separately without guessing which duplicate was authoritative.

The client isolates state by authenticated application actor and encounter. Failed/conflicting saves retain edits in memory, show a truthful state and require reconciliation. Ambiguous transport failures retain the exact operation/key for retry. Reload reads committed server content; it does not automatically replay old global offline caches. Navigating away with unsaved work warns before unloading. No private transcript is written to browser persistent storage.

## Review and approval

Finalization checks the expected encounter and reviewed draft revision, clinician confirmation, medication fields or explicit unknown values with reasoned acknowledgements. An exact medication-name/saved-allergy match and conflicting explicitly recorded units require review reasons. These limited factual notices are not drug-interaction coverage or proof of safety.

One SQL transaction inserts the immutable approved `emr_versions` snapshot and prescription set, completes the encounter and an explicitly typed matching queue link, appends a versioned per-encounter audit event and creates a recipient-owned in-app notification intent. An authoritative failure rolls all of these back. Duplicate operation retries return the same approval; a competing new finalize conflicts. The audit is a server-serialized hash chain, not a legal certification or independent tamper-proof ledger.

Starting a correction creates a linked encounter and draft from an approved version. Finalizing it creates a new linked approval; the previous version remains unchanged. Each parent has at most one direct correction. Corrections do not silently stop medicines from another version. Historical prescriptions remain dated references, not a claim of current medication use.

The approved HTML export loads the caller-authorized immutable version, rechecks access, escapes all text, retains exact doses/units and labels absent summaries. Its restrictive content policy disables scripts/network loads. Use the browser print/save-as-PDF action. No FHIR/regulatory conformance is claimed.

## Verification scope

Focused isolated tests exercise real Auth/JWT/PostgreSQL and actual route handlers, with only the Next cookie adapter supplied. They cover returning sessions, access boundaries, draft conflict, duplicate finalization, injected prescription/audit/notification failure, linked amendments and hostile export text. These tests do not establish authenticated listening-HTTP/browser behavior or hosted acceptance.

Speech capture adapters, medical hints, original extraction prompts and provider choices remain retained. Live execution stays disabled. Bounded offline audio/proposal integration and the full M3 completion gate remain in progress; this foundation is not a claim of completed M3 or V2.
