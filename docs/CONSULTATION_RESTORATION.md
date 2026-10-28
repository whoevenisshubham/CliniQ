# Consultation restoration

The active consultation is `/consultations`. It uses scoped V2 identities,
encounters, immutable source statements, proposals and reviewed versions. The
legacy public mutation endpoints remain contained.

| Earlier source | Active destination | Restored behavior / necessary adaptation |
| --- | --- | --- |
| CliniQ `d2fadb62a87137ff0f7920803cc06563dcce282a`, `src/components/doctor/LiveTranscriptPanel.tsx` | That component, rendered by `LiveSpeechCapture` and `ConsultationReview` | Direct reuse of the Ambient Scribe header, transcript viewport, interim cursor, word/segment indicators and visual hierarchy. V2 supplies authenticated controls; saved sources have no reset button. Following new text is confined to the inner viewport. |
| Same revision, `ActiveConsultationClient.tsx` | `ConsultationReview.tsx`, `restored-consultation.css` | Compact patient/encounter toolbar, transcript beside sectioned EMR, local save/review actions and reviewed-version print. The old hardcoded clinician identity and unrestricted finalization are excluded. |
| Same revision, `src/hooks/useMedicalScribe.ts` and original medical hints | `src/lib/clinical/capture.ts`, `src/lib/server/speech/{stream,medical-hints}.ts` | Existing retained PCM capture/cleanup, interim/final handling and vocabulary investment. Provider secrets and durable admission stay server-side. The WebSocket package/masked-frame repair remains active. |
| MediFlow `047d4667f4aa00b4c8177f063f27b72b6806576a`, `src/hooks/useSTT.ts`, `src/components/doctor/consultation/ConsultationWorkspace.tsx` | `LiveSpeechCapture.tsx`, `server/speech/incremental.ts`, existing checkpoint/cursor SQL | Transcript lifecycle, finalized-segment cursor, single-flight delta drain, stop/flush and coalescing. Actual finals update the screen from checkpoint events without reloading all history or remounting capture. No permanent browser token, automatic retry or duplicate final extraction is restored. |
| MediFlow `45fbfb853338d5236f2c34eb83e771ac4e9307ca`, `src/lib/emr/merge.ts`; `047d4667`, `extractDeltaPrompt.ts` | `clinical/proposals.ts`, `server/ai/{prompts,runner,clinical-meaning}.ts` | Partial medication field merge and anti-drop/correction delta rules. Stable medication IDs replace index mutation; allowlisted operations and reviewed source assertions replace arbitrary paths. Existing medicines remain history, separate from new prescriptions. Retractions and uncertain facts require review. |
| CliniQ original `src/lib/report-generator.ts` and stylesheet | `clinical/{approved-report,report-style}.ts`, `/api/clinical/approved/[id]` | Existing report format retained with escaped clinical text, selected-version identity, A4 print CSS, wrapping and page-break rules. No invented identity, signature, diagnosis or prescription. |

## Runtime and responsiveness

Live interim text is provisional; checkpoint acknowledgements represent durable
finals. Suggestions appear beside the EMR and require an explicit review action.
They do not overwrite clinician fields. A later source or clinician revision
makes an earlier candidate stale. Both source statements remain available.

Findings saves update the authoritative revision from the receipt instead of
refetching patient history, prescriptions, documents and all source text. A later
local edit survives that receipt. Background checkpoint events preserve the
editor's node, focus and caret. Capture is keyed to the encounter, never to each
new revision. Ordinary statuses stay local to the responsible action.
Microphone and start/stop controls precede the transcript, so the initial screen
does not require scrolling through source text to begin. The branch deployment
selects the single Mumbai function region beside its isolated database through
`vercel.json`; project-wide settings and production are not changed.

Finalized speech coalesces for 1.2 seconds, with one extraction in flight.
The 120-character opening threshold avoids spending a request on a fragment;
stopping flushes shorter remaining speech. Failed or uncertain provider sends
are never retried automatically. A quota refusal **before** transmission can
coalesce newer source while the same bounded session remains open.

## Free-account limits and finite demonstrations

The verified GPT-OSS-20B account limits were 30 RPM, 1,000 RPD, 8,000 TPM and
200,000 TPD. The database enforces the token/request window across authorization
refs, in addition to the stricter finite allowances, actor scope and single-flight
reservation. Confirmed usage releases unused reservation; unknown outcomes keep
the full reservation. Input remains at most 5,000 bounded tokens, output at most
3,000, with the combined request fitting 8,000. No token limit was raised.

The additive quota migration permits a minimum five-second configured cadence;
it does not change or enable any existing allowance. A future finite packet can
use a 15-second minimum send interval, subject to the actual rolling token window.
Large requests may still require roughly a minute. This is a Free-quota
limitation, not a claim of continuous real-time EMR performance. Provider and
end-to-end timings require actual execution; UI/double checks do not establish
them.

The earlier failed stream remains consumed and outcome-unknown. All temporary
speech/AI execution flags and allowances remain disabled. Its two unused EMR
slots do not authorize a new microphone stream. A new finite demonstration must
name its encounter, time window and remaining request/audio/token ceilings.

## Acceptance boundary

Persisted offline fixtures exercise source/correction review, manual edits,
save/recovery, returning reads and selected-version print. They are labelled as
fixtures and do not establish inference accuracy. The original successful batch
result is batch evidence only. The repaired hosted masked-frame probe is
transport evidence only. Actual provider streaming, later spoken corrections,
incremental EMR quality and latency remain owner-demonstration gates.

Print HTML can be visually inspected. Browser print-dialog pagination, actual
200% zoom and the previously blocked scheduling behavioral check remain separate
gates until a permitted verification path is available.
