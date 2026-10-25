# Account handoff — configuration remains disabled

No login, key, billing or provider action is needed during offline development. Production and historical projects must remain unchanged.

| Capability | Server-only variables | Proposed/retained model |
| --- | --- | --- |
| Text | `AI_ENABLED=false`, `GROQ_API_KEY`, `LIVE_AI_AUTHORIZATION_REF`, `AI_TEXT_MODEL` | Retained `llama-3.3-70b-versatile` |
| Speech | `SPEECH_ENABLED=false`, `SPEECH_PROVIDER_VERIFIED=false`, `DEEPGRAM_API_KEY`, `LIVE_SPEECH_AUTHORIZATION_REF`, `AI_SPEECH_MODEL` | Retained Deepgram `nova-2`, `hi`, existing medical hints |
| OCR | `OCR_ENABLED=false`, `OCR_PROVIDER_VERIFIED=false`, `LIVE_OCR_AUTHORIZATION_REF`, server-only `GROQ_API_KEY`, `OCR_VISION_MODEL`; UI flag `NEXT_PUBLIC_OCR_ENABLED=false` | Proposed `qwen/qwen3.8-27b`; multimodal capability/account eligibility unverified |
| Google | `GOOGLE_AUTH_ENABLED=false`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`; client credentials belong in the isolated Supabase Google provider | Separate preview-only Web OAuth client, owner consent required |

Configuration location: exact Netlify `codex/v2-containment` branch override for PR3 only, never global/production. Credentials remain server-only and private. Before enabling new flags, review/apply only newly versioned migrations to the approved isolated backend after preservation/rollback review; do not rerun the empty-project adapter. Enablement also needs narrowly provisioned service-only allowance/budget/scope rows; no public setup endpoint is provided.

Owner setup later: establish zero-spend access and limits for the exact retained Llama model; verify Deepgram promotional expiry/limits and intended account/key; establish whether the proposed Qwen model actually accepts images within the prepared image/token bounds. No blind request, model substitution, paid fallback or terms/billing change is authorized. Owner privately completes the separate Google client/provider/consent configuration if approved.

Existing finite verification proposal remains **unapproved/unconsumed**: two15-second synthetic speech clips (30 seconds total), two bounded text requests, concurrency1, at least60 seconds apart, retries0. Keep one speech/text pair for final hosted acceptance. It requires exact account/model/actor/patient/encounter scope and durable counters. OCR needs a separate finite image/page allowance; it is not added silently to speech/text. Unknown outcomes consume reservations; recover retained responses without retransmission.

Remaining release gates: real OIDC; authorized hosted OCR/speech/text path and quality; exact account eligibility; new migration/worker-asset hosted acceptance; denied appointment SQL suite and canonical refresh; natural-expiry/browser failure evidence; actual200% zoom/true phone and remaining keyboard review. Fixtures, mocked provider envelopes and isolated service checks remain distinct from those gates. No merge, release tag or V2-complete claim is appropriate yet.
