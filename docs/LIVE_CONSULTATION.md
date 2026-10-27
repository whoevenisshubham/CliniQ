# Consultation capture, EMR and print

The retained consultation pipeline is speech → saved source → structured review candidate → clinician review → approved printable record. Speech and generated text never approve a record or silently replace clinician findings.

## Implementation

- The authenticated Vercel WebSocket relay retains interim/final distinction and bounded PCM capture from the original capture investment. Provider credentials stay on the server. No reconnect replays audio.
- The additive live-segment migration stages provider finals with service credentials and checkpoints them using the clinician's actual Auth session through the existing clinical mutation service. Earlier statements and later corrections remain separate sources. An interrupted stream keeps its saved checkpoints. Stop does not duplicate the combined transcript.
- Optional `LIVE_EMR_INCREMENTAL_ENABLED=true` connects those saved finals to the retained MediFlow single-flight extraction cursor. It requires separately enabled AI and an exact durable allowance; it does not create one. Work stops after rejection, unknown outcome or exhausted admission. New speech can make a prior proposal stale. Clinician edits retain revision precedence.
- Existing model adapters, original prompts, normalization and approved report style remain in the repository. The active delta prompt excludes incompatible historical full-schema/ICD/confidence instructions. GPT-OSS uses low reasoning within the same 3,000-token ceiling; this is not a model switch.
- Reviewed changes can be applied to the draft, then approved. The approved source uses the retained print styling and browser Print / Ctrl+P. Historical demo clinician identity is not fabricated in reports.

## Verified and open

One real multilingual batch speech request persisted its raw response and transcript. A protected authenticated hosted WebSocket transport probe upgraded and closed normally with no audio/provider request. This proves transport only, not live speech quality or latency.

The first live EMR acceptance request was rejected as `INCOMPLETE_OUTPUT` at its existing output ceiling. A separately owner-authorized second request using the repaired prompt and low reasoning finished within 840 output tokens, but failed `CLINICAL_SCHEMA`. Both outputs incorrectly made a negated symptom positive and treated current medicines as new prescriptions. The second also omitted the chief complaint. Neither produced an applied proposal. Both raw responses are retained privately, both allowances are disabled, and no third request was sent. The live checkpoints/correction migration passed real isolated integration and was applied to the preview with all existing row fields, policies and the original provisioning journal preserved. Live speech/EMR quality acceptance remains open.

Remaining acceptance includes a real owner microphone stream, speech-onset/interim and stop/save measurements, a successful bounded EMR proposal with correction review, and rendered print comparison against the intended format. The finite live allowance must be reconciled before another provider request. Production and historical databases remain outside this preview work.
