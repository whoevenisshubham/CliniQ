# Medicines, self-reports and in-app tasks

`/continuity` uses authenticated `/api/continuity` and guarded SQL transactions. Patient ownership comes from the active application identity; callers cannot nominate an owner. Clinicians open follow-up intentions from an authorized consultation. Reception has no access. `/design/continuity` is a labelled, nonpersistent visual fixture.

## Reproducible journey

1. In the isolated environment, a treating clinician reviews and approves a record containing a medicine. Approval retains the exact dose, frequency, duration and instructions, including unknown fields.
2. The patient opens Medicines & tasks. A saved prescription reference does not establish current use. They explicitly choose optional tracking times, dates and one of the supported zones: Asia/Kolkata or UTC. No free-form instruction is parsed into a schedule. Tracking is bounded to eight times per day and a maximum 90-day interval.
3. The SQL commit saves the preference and operation outcome. A bounded server reconciler materializes dated tasks. Reload and returning Auth sessions read the persisted state. A failed immediate reconciliation returns `processing: pending` while retaining the committed preference; the shared worker/scheduled runner recovers it.
4. For a past task the patient can report taken, missed or not recorded. Missing reports are never treated as missed doses. Each correction requires the saved revision and a reason, retaining immutable previous states. A stable operation key deduplicates retries; a different body cannot reuse it.
5. An authorized clinician can save a dated follow-up intention against their current approved version. It creates no appointment. Read, completed, dismissed, source-cancelled and adherence-report states remain distinct. No SMS, WhatsApp or other external delivery is implemented.

## Sources, recovery and concurrency

Tracking edits cancel obsolete task intentions without deleting reports. An approved amendment disables tracking based on its previous version and cancels obsolete medicine/follow-up intentions; the replacement prescription gets no inferred tracking preference. Appointment source changes have a transactional intention trigger and a bounded missing-intention backfill. Their scheduling race acceptance remains separately incomplete.

Source-row locking serializes preference/follow-up creation with clinical amendments. The materializer locks each schedule and uses a bounded cursor, at most ten schedules and two days per schedule per call; unique source/revision/time keys prevent duplicate publication. The shared runner handles catch-up. No browser timer is the durable authority.

The UI retains unsaved tracking input across refreshes and captures its original revision. Conflicting saves require reviewing the latest saved preference. Uncertain requests expose same-key reconciliation. Access failures hide private state. Clinician views filter each medicine source through the original approved-record permission; an unrelated care relationship does not grant it.

## Evidence boundary

The focused real-Auth integration suite covers patient/staff/cross-provider boundaries, exact approved wording, explicit tracking, deduplication, corrections, stale revisions, returning sessions, time-zone conversion, unclaimed-patient null-recipient privacy and source amendment invalidation. Results must be read from the tested source's CI artifact; suite presence alone is not acceptance. Local Docker is currently unavailable, so this new migration is not locally accepted. Listening HTTP/browser, hosted deployment, actual 200% zoom and the previously blocked scheduling suite remain separate open gates.

No refill prediction, treatment outcome, adherence percentage, automatic medical schedule or external message-delivery claim is made.
