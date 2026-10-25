# Speech transport: prepared live wiring, disabled by default

`SpeechCapture` uses the bounded local PCM capture adapter, then sends a complete16kHz mono16-bit WAV to `/api/clinical/:id/speech`. The handler resolves the real current clinician and encounter before reading/admitting bytes. A stable operation key, segment UUID, expected revision, sequence and server-computed audio hash bind the request. Only final validated output can reach the existing `clinical_mutate` transcript authority. Speech provenance and clip-relative timings are committed in the same SQL transaction; speaker/language remain unknown rather than pretending diarization or detection ran.

Live execution defaults off. The server transport now requires `SPEECH_ENABLED=true`, `SPEECH_PROVIDER_VERIFIED=true`, a server-only `DEEPGRAM_API_KEY` and `LIVE_SPEECH_AUTHORIZATION_REF`, plus an exact durable live actor/encounter/model/language/audio allowance. A key alone never sends. The retained adapter also accepts an explicitly injected offline transmitter. Its fixed HTTPS endpoint refuses redirects, reads at most64KiB of response, uses the request/deadline signal and never retries automatically. Its medical vocabulary is the original CliniQ vocabulary, shared with the retained hook. Existing Groq/Llama extraction prompts and typed proposal/review/finalization remain in use after the saved transcript. No actual provider request has been made by this offline implementation.

## Boundaries and recovery

- Complete WAV validation: at most1MiB/30 seconds; the UI prefers one15-second clip.
- Read-only preflight hides capture when no matching allowance remains or live pacing applies. Its remaining audio bound caps the existing capture window; preflight never reserves or transmits. The authoritative reservation checks run again after the complete WAV is validated.
- At most20 admitted operations/day and200 retained operations/actor. No reset/deletion when caps are reached.
- Explicit service-only allowances bind mode, retained model/language, actor+encounter, requests and actual audio milliseconds. Global transmission concurrency1; live reservations enforce at least60 seconds between sends. The additive live-mode migration is prepared for isolated rehearsal only; it inserts no allowance and has not been applied to the hosted preview.
- A durable send marker precedes transmission. Abort, disconnect, expiry or ambiguous response conservatively retains its usage; no automatic resend.
- Shared local/background/scheduled recovery reconciles at most20 expired operations per call. Pre-send admission expiry cancels; post-marker expiry remains outcome_unknown. Valid retained responses are not retransmitted.
- Saved speech segments retain their operation/hash/requested configuration and offline provenance. Returning-session UI labels synthetic offline speech explicitly.
- A durable final response can be committed after interruption without another transcription. Stale revisions and revoked access cannot publish a segment. Retry cannot duplicate its stable segment.
- The client uses an explicit JSON `save_retained` command on the same scoped speech endpoint. Recovery checks the original operation and calls only the existing commit fence; it never resends audio or reaches transcription transport. Admitted/transmitting/unknown states remain unresolved and cannot unlock new capture merely through inspection.
- Interim, empty or oversized output is rejected. Audio is held in request/browser memory only; it is not written to disk, SQL or Storage. Leaving the capture workspace aborts capture/request and discards local bytes. Saved operation/result history remains private.
- The current adapter is bounded clip transcription, not proof of continuous streaming latency or historical transcription accuracy. The original streaming hook is retained; unsafe browser-key distribution remains contained.

## Provider compatibility evidence and live prerequisites

The inspected CliniQ hook uses `nova-2` + `hi`. Deepgram's current [model/language table](https://developers.deepgram.com/docs/models-languages-overview/) lists Hindi for Nova-2 and English for Nova-2 Medical. This supports preserving the inspected configuration; it does not prove the owner's remembered winning configuration, Hindi/Hinglish medical accuracy or account access. No automatic model/language/provider switch was made. The [pre-recorded endpoint](https://developers.deepgram.com/docs/pre-recorded-audio) accepts WAV bytes; [streaming final/interim semantics](https://developers.deepgram.com/reference/speech-to-text/listen-streaming) are a separate acceptance concern.

Before any live enablement, verify the intended account, exact adapter/model/language, free eligibility, no paid fallback and enforceable account/audio allowance. The existing unconsumed proposal is at most2 synthetic clips of15 seconds each, total30 seconds, concurrency1, at least60 seconds apart, application/SDK retries0; reserve one clip for final hosted-path verification. Approval must specify exact synthetic actor/patient/encounter scope and account/provider/model. This remains a proposal, not authorization. Text keeps its separate proposed two-request allowance; OCR is not included in either allowance.

## Evidence scope

The speech integration suite exercises the actual authenticated handler and isolated Auth/Postgres with offline provider envelopes; external fetches are rejected by its test wrapper. It covers disabled admission, role/workspace denial, final-only persistence, returning sessions, idempotency/hash conflicts, audio allowance, concurrency/abort, retained-response recovery and revocation. A passing handler test is not authenticated listening-HTTP/browser capture acceptance or live STT acceptance. Inspect the current CI result before claiming this suite passed.

Local Docker stopped during implementation and its restart log reported an inaccessible inference-manager IPC endpoint. No factory reset, database reset or deletion of Docker runtime files was performed. Local application of migration008 is unverified until that engine is healthy; fresh CI applies the maintained migration independently.
