# Continuing-care implementation status

The `/care` workspace uses real authenticated `/api/care` handlers and guarded SQL operations. `/design/care?view=patient`, `view=reception` and `view=clinician` are explicitly labelled, nonpersistent visual fixtures. No fixture confirms a booking or starts an encounter.

The scheduling/reception slice is implemented but **behavioral acceptance remains incomplete**. A combined command to create and execute its integration suite was rejected before process start. It has not been retried through another tool. Existing CI/typechecking is not a substitute for missing scheduling race, returning-session and failure checks.

## Appointments

Explicitly provisioned synthetic slots store UTC timestamps and the clinic time zone. Slot range exclusion prevents provider overlap; one confirmed appointment per slot is enforced by an index. Mutation locks slots in stable ID order and checks active provider membership, care eligibility, patient ownership and future availability. Rescheduling checks the new slot before changing the original appointment. Actor-scoped operation keys replay committed outcomes; current access is checked again on replay. Ordinary clients cannot write appointment or slot tables directly.

No availability is invented by a page load. Historical appointments remain preserved and are not silently converted into newly confirmed slot bookings. A follow-up intention is not a confirmed appointment. No external message, teleconsultation or payment integration is established.

## Reception and queue

Reception search is bounded to an active workspace and explicit intake relationships. Its DTO excludes clinical notes, allergies and documents. New intake creates separate unclaimed demographics plus scoped intake/clinical links; it never creates an Auth identity, merges by name/phone/email, or resets credentials. Verified ownership claiming remains a separate, unavailable procedure.

Provider/day queue allocation is serialized. Starting a waiting entry requires its treating clinician and calls the existing clinical transaction, linking the resulting encounter. Approval completes that same typed queue link. Reception cannot approve or prescribe.

Intake measurements require explicit units and observation time; correction events retain actor/time/reason and previous snapshots. They are observations for clinician review, not automatic approved clinical findings. Corrections are currently allowed only before consultation start. Cancellation/no-show is allowed only while waiting.

## Required acceptance still open

- Real Auth booking race, reschedule conflict/rollback, stable-key replay and returning-session checks.
- Staff/provider/workspace revocation races and scoped queue allocation/start checks.
- Intake vital validation, correction provenance and role boundaries.
- Authenticated listening-HTTP/browser workflows, hosted worker/schema acceptance and actual 200% zoom.

Medicines/adherence, continuing-care task processing, profile/privacy/family/trends and reviewed illustrative billing/catalog remain unfinished. These are not implied by the scheduling endpoints.
