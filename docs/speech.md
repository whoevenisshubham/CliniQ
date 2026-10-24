# Speech transport: disabled/offline integration

`SpeechCapture` uses the bounded local PCM capture adapter, then sends a complete16kHz mono16-bit WAV to `/api/clinical/:id/speech`. The handler resolves the real current clinician and encounter before reading/admitting bytes. A stable operation key, segment UUID, expected revision, sequence and server-computed audio hash bind the request. Only final validated output can reach the existing `clinical_mutate` transcript authority. Speech provenance and clip-relative timings are committed in the same SQL transaction; speaker/language remain unknown rather than pretending diarization or detection ran.

Live execution is hard-disabled. No environment key or client flag enables it. The retained Deepgram request/response adapter accepts an explicitly injected offline transmitter; the application has no global-fetch fallback in this path. Its medical vocabulary is the original CliniQ vocabulary, shared with the retained hook. Existing Groq/Llama extraction prompts and typed proposal/review/finalization remain in use after the saved transcript.

## Boundaries and recovery

- Complete WAV validation: at most1MiB/30 seconds; the UI prefers one15-second clip.
- At most20 admitted operations/day and200 retained operations/actor. No reset/deletion when caps are reached.
- Explicit service-only offline allowances bind actor+encounter, requests and actual audio milliseconds. Global transmission concurrency1; no live allowance can be stored by this schema.
- A durable send marker precedes transmission. Abort, disconnect, expiry or ambiguous response conservatively retains its usage; no automatic resend.
- A durable final response can be committed after interruption without another transcription. Stale revisions and revoked access cannot publish a segment. Retry cannot duplicate its stable segment.
- Interim, empty or oversized output is rejected. Audio is held in request/browser memory only; it is not written to disk, SQL or Storage. Leaving the capture workspace aborts capture/request and discards local bytes. Saved operation/result history remains private.
- The current adapter is bounded clip transcription, not proof of continuous streaming latency or historical transcription accuracy. The original streaming hook is retained; unsafe browser-key distribution remains contained.

## Provider compatibility evidence and live prerequisites

The inspected CliniQ hook uses `nova-2` + `hi`. Deepgram's current [model/language table](https://developers.deepgram.com/docs/models-languages-overview/) lists Hindi for Nova-2 and English for Nova-2 Medical. This supports preserving the inspected configuration; it does not prove the owner's remembered winning configuration, Hindi/Hinglish medical accuracy or account access. No automatic model/language/provider switch was made. The [pre-recorded endpoint](https://developers.deepgram.com/docs/pre-recorded-audio) accepts WAV bytes; [streaming final/interim semantics](https://developers.deepgram.com/reference/speech-to-text/listen-streaming) are a separate acceptance concern.

Before any live enablement, verify the intended account, exact adapter/model/language, free eligibility, no paid fallback and enforceable account/audio allowance. Prepare at most3 synthetic clips of15 seconds each, total45 seconds, concurrency1, at least60 seconds apart, application/SDK retries0. Approval must specify exact synthetic actor/patient/encounter scope and account/provider/model. This is a proposal, not an authorization. Text verification keeps its separate unconsumed aggregate allowance.

## Evidence scope

The speech integration suite exercises the actual authenticated handler and isolated Auth/Postgres with offline provider envelopes; external fetches are rejected by its test wrapper. It covers disabled admission, role/workspace denial, final-only persistence, returning sessions, idempotency/hash conflicts, audio allowance, concurrency/abort, retained-response recovery and revocation. A passing handler test is not authenticated listening-HTTP/browser capture acceptance or live STT acceptance. Inspect the current CI result before claiming this suite passed.

Local Docker stopped during implementation and its restart log reported an inaccessible inference-manager IPC endpoint. No factory reset, database reset or deletion of Docker runtime files was performed. Local application of migration008 is unverified until that engine is healthy; fresh CI applies the maintained migration independently.
