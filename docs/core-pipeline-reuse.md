# Core speech-to-EMR reuse

The owner recalls Nova medical plus Groq Llama as a successful historical pairing
after speech-provider trials. The exact winning runtime configuration is not yet
proven. No provider configuration, speech hook, extraction model or prompt was
switched in the identity/isolation increment. Inference remains unavailable.

| Source pin and path | Reusable behavior | Necessary repair / integration |
|---|---|---|
| CliniQ d2fadb62: `src/hooks/useMedicalScribe.ts` | Microphone processing, MediaRecorder Opus negotiation, 250 ms streaming, interim/final distinction, Hindi/Hinglish hints, medical keyword list, capture/error cleanup | M3: retain adapter and behavior; replace key distribution with a bounded authenticated transport, cancellation, durable transcript IDs and admission/budget controls. Source selects `nova-2`, `language=hi`; not proof of Nova medical runtime or measured latency |
| CliniQ d2fadb62: `src/components/admin/AdminSettingsClient.tsx` | Existing settings presentation | `nova-2-medical` is a displayed value, not evidence it configures capture. Bind reviewed provider capability/configuration only when implemented; do not silently switch providers |
| CliniQ d2fadb62: `src/app/api/extract/route.ts` | Source-only extraction instructions, structured output fields, missing-information prompts, existing Llama adapter | M3/M5: preserve extraction prompt investment; server-load authorized saved transcript, validate strict bounded proposals, preserve review/version provenance, admit durable budgeted jobs. Source uses `llama-3.3-70b-versatile`; recurring differential probabilities and client context are not trusted foundations. Endpoint remains closed |
| CliniQ d2fadb62: `src/store/consultationStore.ts`, `LiveTranscriptPanel.tsx`, `ActiveConsultationClient.tsx` | Transcript/editor state, manual edits, clinician review panels and clinical density | M3: bind actor + actual encounter + revision, truthful save/finalize results, atomic approved versions, source links. Memory resets at logout; old global caches are preserved without automatic import |
| MediFlow 45fbfb85: `src/hooks/useSTT.ts` | PCM/audio processing, final segment accumulation, transcript hydrate/save concepts | M3: preserve Sarvam adapter source (`saaras:v3`), fix transport/session/ownership and durable-save semantics. This source is not evidence of a winning provider |
| MediFlow 047d4667: `src/hooks/useSTT.ts`, `app/api/transcripts/upsert/route.ts` | Nova streaming, interim/final parsing, hydrate/upsert lifecycle | M3: retain as an implementation candidate; source selects `nova-3`, Hindi. Repair stable-ID retries, resource authorization and response checking; reject permanent-key response route |
| MediFlow 45fbfb85: `src/hooks/useEMRExtraction.ts`, `src/lib/emr/extractDeltaPrompt.ts`, `src/lib/emr/merge.ts` | Incremental extraction cursor, evidence segment references, delta operations | M3/M5: adapt substantial operation workflow with typed allowlisted paths, bounded indices, prototype-key rejection, source IDs and optimistic concurrency. Do not import arbitrary-path mutation unchanged |
| MediFlow 45fbfb85: `src/lib/emr/normalizeMedications.ts`, `summaries.ts`, relevant `types.ts` | Complete medication-alias normalization and deterministic source-fact formatting | Adapted into `src/lib/clinical/` and used by the repaired provider-only EMR GET reader. Object coercion rejected; strings/arrays bounded; original medication JSON retained alongside DTO. These formatters make no provider call or clinical inference |
| MediFlow 45fbfb85: `src/lib/mongodb/repo.ts`, `src/lib/supabase/types.ts` | Explicit patient-doctor links, nullable unknown demographics, transcript/EMR domain fields and persistence intent | M1: relationship semantics adapted into relational `care_relationships` with workspace, purpose, active membership and revocation; nullable DOB/phone retained. MongoDB storage code is not imported because this product retains one PostgreSQL authority; existing CliniQ UUID/domain tables are preserved |
| MediFlow 45fbfb85: `app/api/consultations/context/[id]/route.ts`; 047d4667 history/audit implementations | Encounter context/history organization, changed-path/source provenance | M3: reuse workflow and presentation with current scoped relational repositories; serialize authoritative audit/finalization writes in PostgreSQL rather than retaining independent collection writes |

M1 repairs infrastructure around the original pipeline. It does not establish live
speech accuracy, medical-model/language compatibility, latency or free eligibility.
Before live enablement: verify the exact intended account/model/language, zero-spend
eligibility and enforceable limits under a separately granted allowance. No tournament,
blind benchmark, paid fallback or automatic provider switch is part of this work.

Source provenance: CliniQ history/contributors remain intact. Adapted MediFlow helpers
retain attribution to Sujit Jaju and contributors at the stated revision. No blanket
license is invented; applicable third-party notices remain authoritative.
