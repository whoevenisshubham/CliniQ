# Consultation capture, clinical meaning and print

The retained journey is speech → saved source → structured review candidate → clinician review → selected approved printable version. Speech never approves a record or silently replaces clinician findings.

## Diagnosis from the two retained live responses

The actual raw Groq responses already labelled denied fever as positive and current medicines as prescriptions, before normalization. The old single snapshot contract had a positive-only symptoms array and a medications field that finalization converts into prescriptions. Existing medicine history had no first-class destination. The review UI called that prescription field “Medication review”. These ambiguities encouraged the wrong mapping; a closed JSON shape by itself cannot correct it. The first request also exhausted 3,000 output tokens; the second finished in 840 but failed clinical validation. Neither was applied.

The trace is `clinical_mutate`/`ai_admit` saved source → `runner.ts` messages → `format.ts` wire schema → retained `provider_attempts.raw_response` → `clinical-meaning.ts` source/polarity validation → `clinical_proposals` → explicit review in `ConsultationReview`. Original prompt/adapters and legacy normalization remain available; no model switch was made.

## Repairs

- Compact facts distinguish present, denied and uncertain symptoms, medication history, explicit new clinician prescriptions, history/allergy statements and measurements. Closed shape is only the first check. Complete exact source quotations, bounded source indices, finite bilingual paraphrase equivalences, local negation scope, numeric fidelity and prescription context are independently checked. Unsupported paraphrases and ambiguous speech remain rejected or uncertain; this finite validator is not a general medical entailment engine.
- `clinical_context` is additive on drafts, proposals and approved versions. Existing medicine history never feeds prescription/task creation. “No new medicine prescribed” remains visible and requires explicit review if the clinician nevertheless records a new prescription. Uncertain assertions require acknowledgement before approval.
- Raw STT is immutable source history. A reviewed transcript correction appends a separate linked segment. Incremental input includes new finals, two preceding segments and explicitly linked correction targets. Earlier and corrected assertions remain visible. There is no patient/drug/value-specific production rule.
- Late proposals stay fenced by revision. An explicit review rebase offers only additions that do not replace a newer clinician-edited field. Rebase is idempotent and never runs inference.
- The real-time relay retains original interim/final handling and bounded PCM. Final checkpoints persist once, with no duplicate aggregate insertion. Extraction is single-flight; pending finals coalesce while the durable pacing interval is respected. Disconnect/cancel/access loss halts pending sends; an already reserved uncertain call is never replayed. Editing remains responsive during capture; writes wait for saved-source boundaries.
- Print uses the existing project report generator/stylesheet as the design reference, improved for A4, repeated table headings, long text and page breaks. It prints the selected approved version, actual available patient/encounter/reviewer metadata, context and source references, with current medication history separate from new prescriptions. No clinician registration, signature, diagnosis or prescription is invented. No unavailable external template match is claimed.

## Evidence boundaries

The small regression set includes both exact retained synthetic failures, bilingual negatives, genuine prescription versus existing medicine, named dose correction, ambiguous STT and late clinician edits. Provider doubles and mocked browser components prove contract behavior, not live model accuracy.

The owner’s saved raw recording says BP 138/68 and HbA1c 7.2%; it is not replaced by the script. The one completed speech test was batch: 18,341 ms send-to-saved and 18,408 ms capture-end-to-saved. A prior authenticated hosted WebSocket probe proved transport with zero provider calls. Neither proves streaming quality or latency. Both previous EMR calls failed. No third inference is authorized or enabled.

## Proposed next interactive session — not enabled

One owner-triggered synthetic Nova-3-medical/multi stream, at most 60,000 ms / 1,920,000 bytes of 16 kHz mono 16-bit PCM, no reconnect/retry/fallback. Two incremental Groq EMR calls on the existing model, each at most 5,000 input and 3,000 output tokens; aggregate at most 10,000/6,000. Enforce at least 65 seconds between sends and the existing Free-only conditions. The second extraction may complete after recording stops; this proposal does not promise continuously regenerated EMR at sub-minute intervals. The owner can speak an initial fact and an explicit named correction; raw finals, both candidates and reviewed output remain separate.

Before enablement, bind new exact actor/patient/encounter scopes and reconcile current free allowance. Rejection, unknown outcome, access loss, timeout or rate-limit response stops remaining sends. Disable allowances and temporary flags afterward. No OCR, model comparison, billing change or other provider call is included. Capture start→interim, stop→saved final and saved-final→persisted EMR are measured directly. Energy-onset/end timing is an explicitly labelled proxy, not independently annotated speech ground truth. WER requires a faithful actual spoken reference.

## Approved owner demonstration — 27 October continuation

The owner approved one <=60-second Nova-3-medical/multi stream and at most two GPT-OSS-20b EMR calls, <=5,000 input / <=3,000 output each, aggregate <=10,000 / <=6,000, at least 65 seconds apart. It uses one exact authorization ledger; previous unrelated failed acceptances are preserved. The packet cannot retry, reconnect or fallback. The current implementation is retained: original capture/medical hints/interim-final behavior and MediFlow's extraction cursor inside V2's ownership, durable persistence and explicit review boundaries. A new engine is not introduced.

The live screen retains initial and later candidates together. A local microphone check must pass before the stream button becomes available; the check sends no audio. Batch controls are hidden while streaming is selected. A completed/failed stream cannot auto-restart. Exact finite demonstration ledgers close on completion, terminal extraction status or disconnect; temporary deployment flags are restored during acceptance closeout. New live extraction is scoped to the exact encounter as well as actor/patient and budget.

A scoped, authenticated read-only readiness route checks the existing Deepgram project's available USD balance using the server-held key. It never transcribes or exposes that key. Inference allowances stay disabled until credit readiness passes. If management scope is unavailable, no inference is sent and the exact account dependency is reported. The existing UI may require a read-only owner sign-in to verify credit; no account creation, new key, billing or terms change is authorized.

The verified Groq limit is 8,000 TPM. A request reserving up to 5,000 input plus 3,000 output can consume that whole minute; RPM alone cannot justify faster cadence. Compact finals coalesce and one request runs at a time. The approved 65-second floor remains a demonstration constraint, not a claim of the desired final product cadence. Faster future cadence needs measured smaller reservations and token-window headroom, without silently reducing clinical content or raising the packet budget.

## Owner streaming attempt: transport failure, 28 October 2026

The owner-triggered stream consumed its single speech reservation; zero EMR requests started. Hosted logs show an unusable ws masking/unmasking implementation: TypeError `b.unmask is not a function` about2.5seconds after admission, then `b.mask is not a function` and process exit129. No final segments, raw transcript or EMR jobs were retained. The speech operation remains outcome_unknown with its provider request ID; the full60,000ms counter is a reservation, not a measurement of successfully transcribed audio. The allowance auto-closed. No resend or budget reset is allowed.

The repair externalizes ws from the Next bundle and sets the approved branch's WS_NO_BUFFER_UTIL=1 to select ws's supported JavaScript path. The inferred packaging defect is backed by the exact runtime stack; no provider-latency or clinical-quality conclusion can be drawn. Trace checks now require the real ws files and exercise masked binary/text payloads without a listener or provider. The authenticated no-audio connection check exchanges a >32-byte masked frame; the older handshake-only probe missed that path. The UI also names the60-second test cutoff and reports close codes.

Execution flags are off. A new real speech attempt requires one specific additional <=60-second owner-triggered session; the two originally authorized EMR calls remain unused. No automatic retry or new inference is performed during repair.
