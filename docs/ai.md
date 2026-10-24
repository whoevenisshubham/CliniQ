# Source review and offline AI orchestration

`/evidence` connects private conversations, durable jobs, current source text and saved result states. It uses the same queue as document parsing. External execution defaults off. Evidence-only output is not generated AI; synthetic provider-double output has its own label. Saved generated results are labelled saved/cached, with current source authorization checked on every read.

## Actual application path

`POST /api/ai/threads` creates an actor-owned conversation. A patient context comes from the explicit Auth/application mapping. A provider context must come from their authorized real encounter. `POST /api/ai/threads/:id` accepts a bounded question, operation kind and optional source IDs, not arbitrary client medical context or role messages. It commits a durable job before processing/dispatch. `GET /api/jobs/:id` and the conversation reader expose current authorized state. The default disabled path runs the same bounded worker inline to record an honest unavailable/evidence-only result.

PostgreSQL materializes authorized patient/document/version candidates before ranking. Private document grants must match the conversation's workspace; being assigned to the patient alone never grants document access. Approved records are separate sources; superseded approvals are excluded from current retrieval. Full-text ranking normalizes letter/number boundaries without altering stored text. Explicit summarization of a selected source can retain that source even when the generic question has no matching medical term. Limits are six chunks and10,000 source characters. Questions requiring unsupported treatment advice return insufficient evidence without provider transmission.

Source snapshots retain exact IDs, versions, page/offset references, hashes and manual-transcript classification. Source instructions remain untrusted text. Authorization and source identity are checked before transmission, publication and later reads. Revocation cancels affected provider jobs; replacement/amendment makes old results stale. Deletion also redacts automatically copied source text from retained job snapshots while preserving identifiers/hashes. Already delivered/downloaded copies cannot be recalled.

## Durable budgets and recovery

`document_jobs` is extended rather than replaced with another queue. Claims use90-second leases, increasing fences and at most three claims. One worker processes one bounded item. Existing parser/purge claims remain restricted to their original kinds. The background function and local runner share the same dispatch/claim path. A bounded reconciler recovers expired pre-send work and classifies transmitted uncertainty; preview schedules are not assumed to run.

An enabled exact provider/model/operation budget is insufficient by itself. Admission also requires an aggregate authorization allowance and an explicit actor/patient synthetic scope. Ordinary accounts cannot write any allowance, scope or attempt row. Operation-specific budgets cannot multiply an aggregate allowance. Global concurrency is one; live allowances enforce UTC daily/per-actor caps and at least60-second pacing. Current ceilings are60 lifetime requests per allowance,10/day and3/actor/day for a live allowance; actual authorization can and should be lower. No live allowance is provisioned by migrations or application startup.

Worst-case input/output is reserved before transmission. UTF-8 message bytes plus overhead conservatively bound input tokens; output is capped at3,000. SDK retries are zero. A marker precedes transmission, so a crash in the narrow pre-send gap is conservatively uncertain. Timeout/disconnect without a definite outcome consumes the reservation and never auto-retries. Known HTTP provider failures are recorded separately, with safe categories and no raw diagnostics. Malformed/truncated/ungrounded output is rejected and still consumes its attempt. Known usage may release unused token reservation; missing/invalid usage retains the bound.

A validated response is saved before publication. A crash or publication failure recovers from that durable result without another provider request. Fences, current permissions, source revision and encounter state guard publication. A delayed extraction becomes a retained review-required/stale proposal; it cannot replace a clinician correction. Approving the record remains a separate clinician transaction.

## Validation and limitations

The local validator enforces the supplied version1 answer schema, complete JSON/finish state, real admitted citations, exact normalized quoted support, numeric/unit fidelity, bounded reference definitions and prohibited-action/instruction checks. This initial conservative gate requires factual sentences to be source spans; it does not certify semantic entailment of free paraphrases. Basic English/Hindi/Hinglish negation regressions are covered; complex linguistic/clinical negation is not universally solved.

Extraction reuses the original CliniQ Groq/Llama prompt and MediFlow's typed operation/cursor vocabulary. The new delta contract overrides obsolete arbitrary paths, default directions and unreviewed inference. Full candidate schema is validated before saving a proposal. Patient/unknown-speaker statements cannot become clinician-stated diagnoses. Missing dose/route remains null. No proposal can approve, prescribe or change an immutable approval independently.

The historical default text model remains `llama-3.3-70b-versatile`; no automatic model/provider switch is implemented. Actual account access, zero-spend eligibility, compatibility, generated quality and speech acceptance are unverified. The capture/streaming adapters and medical hints are preserved. Bounded offline PCM/WAV/capture tests are not an enabled server speech transport or proof of live transcription accuracy.

## Reproduce the finite offline evaluation

After the isolated setup in README:

```sh
npm run eval:offline
```

This command uses real local Auth/PostgreSQL/Storage and the normal services/runner, with explicit synthetic provider doubles. `tests/fixtures/ai/EVAL_CASES.json` contains16 versioned cases. The suite also tests role/workspace boundaries, durable aggregate/daily caps, concurrency, outcome uncertainty, crash recovery, source replacement/deletion and returning sessions. Results are written under ignored `tests/infra/.runtime/ai-evaluation-results.json` and included in CI's safe evidence artifact. A finite offline pass is not a live model score, clinical validation or authenticated-browser acceptance.

Conversations return the latest30 requests; older rows are retained. Admission is bounded to30 requests/day and200 retained jobs/actor, and50 conversations/actor. Reaching a cap refuses new work rather than deleting history or silently resetting usage.

## Supported-source mode and fidelity limits

Accepted factual output is a complete source sentence/line or the complete admitted excerpt, with exact citations. Reviewed reference definitions are displayed separately. This is **supported excerpt mode**, not accepted explanatory paraphrasing or proof of general clinical understanding. A finite topical gate rejects clearly unrelated measurement answers; it does not establish semantic answer quality. Temperature questions also recognize explicit °C/°F source units without silently converting them.

Focused adversarial cases cover negation with intervening words, family versus patient history, uncertain/rule-out/resolved/previously treated conditions, stopped medicines, patient versus clinician statements and Hindi/Hinglish context. Diagnoses require an explicit clinician assessment label and retained assessment context. Qualified medication context is rejected for manual review. These conservative gates can reject otherwise useful extraction; they never justify guessing or weakening source checks.

Numeric token comparison rejects prefixes such as 12.4 extracted from 12.45. Medication proposals are stable-ID deltas: omission does not erase another saved medicine. Changed fields retain proposal provenance while unchanged fields retain prior clinician provenance. Existing stale-revision protection remains authoritative.

Provider401/403 and429 have explicit authentication/rate-limit states, without assuming zero consumption or refunding an unknown usage bound. HTTP408/5xx, unrecognized errors and transport/timeouts remain outcome_unknown. No automatic retry follows either outcome. The offline live-allowance proposal remains unconsumed.

During hardening, schema validation was moved before context validation to retain the existing malformed-schema failure contract. The complete-context gate initially rejected a valid two-sentence medication excerpt and was corrected to allow the complete admitted source. The topical gate initially missed temperature units without the word "temperature"; it now recognizes explicit °C/°F while retaining both source values/units. The versioned16-case fixture and its expectations were not weakened.
