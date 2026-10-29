# Scoped research and safety

These routes use existing CliniQ components and the same Supabase identity, clinical sources and reviewed records. They do not restore the historical mock research datasets or claim comprehensive medication safety.

## Research

`/research` requires an active workspace research membership **and** a separate current authorization from that workspace's existing administrator. `/admin/research` manages only existing research members; it cannot create identities, grant global roles or acquire clinical-table access. The owner separately opts into this narrow activity-count use from the patient account page. Existing preference/consent fields are not silently treated as this authorization.

Releases contain two rounded lower bounds: distinct participants and reviewed visits in a fixed, completed UTC calendar quarter. At least five explicitly consenting participants are required; counts are rounded down to multiples of five. Small cohorts are withheld without a zero or complementary total. A quarter can be sealed once, including a withheld quarter; at most twenty quarters and 5,000 source visits per release are supported. There are no identifying rows, arbitrary filters, condition-level inference, ZK proofs or certified anonymization claims. CSV repeats only the quarter and these two numeric bounds after a fresh permission/source check.

Private provenance binds the contributing reviewed versions and consent revisions. Withdrawal, an amended/missing source, or revoked researcher authorization prevents future access/download. Consent re-enablement cannot resurrect an earlier release. Already downloaded information cannot be recalled. Disease/epidemiology analyses and individual case datasets still require an expressly authorized data contract; they are not implied by this activity aggregate.

No privileged hosted identities, permissions, patient authorizations or releases are provisioned by the migration. Real Auth integration fixtures exist only in the isolated CI database.

## Medication review

The original pair detector is retained, with a narrow independently checked presentation allowlist. Sources checked on 2026-10-29:

- [Warfarin DailyMed label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8ad881e0-ca41-42ad-9d7d-eb85b3a30af0): the bleeding-risk interaction section identifies aspirin.
- [Atorvastatin DailyMed label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=604a011e-6c64-4895-8f6e-d28f119c4c22): clarithromycin requires dose/clinical-context review.

The page distinguishes current medication history from new prescriptions, excludes explicitly superseded history, surfaces recorded name/allergy matches and incomplete information, and links its sources. It does not recommend substitutions, declare a combination safe, implement brand/class cross-reactivity, or determine renal/dose suitability. At most 200 findings are displayed, with explicit incomplete-coverage notice if capped.

Review/dismiss receipts require a reason and the exact saved clinical source. A server-only bounded presentation attests eligible finding IDs; authenticated clients cannot mint arbitrary matched-rule receipts directly through RPC. Revision, allergy, medicine, reviewed-version or amendment changes invalidate the context. A stale receipt remains history, never a current safety clearance. Clinical approval/treatment is a separate clinician decision.

## Recovery

The worker awaits a bounded claim/execution and durable observation before reporting success. Service-only observation records contain source SHA, time, duration and outcome, not clinical bytes. Recent/stale/unknown last-success status comes from the database, never a caller-supplied timestamp. Admin metadata does not establish scheduling or per-workspace document delivery. The release recovery example remains outside `.github/workflows`, uses a separate credential and is not enabled as an unattended scheduler.
