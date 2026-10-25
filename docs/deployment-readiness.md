# Deployment preparation and unconsumed live proposal

Main/production release is separate from branch CI and visual preview. Never copy production secrets into preview or infer that a public preview has an isolated backend.

## Isolated preview evidence — 24 October 2026

The owner-approved new Free Mumbai preview baseline is provisioned, with six synthetic Auth accounts explicitly mapped to application users, two workspaces, RLS and private document/audio buckets. The private provisioning journal reconciles against the database and all 14 committed migration hashes. Historical projects and production remain unchanged. Do not rerun the empty-project adapter.

PR #3 uses exact `codex/v2-containment` Netlify branch overrides. General preview and production values were not populated or replaced. Secret variables retain Builds/Functions/Runtime scopes on this Free account; Functions-only scope selection is unavailable. Application imports and public-bundle checks must therefore enforce server credential separation.

Actual hosted acceptance has now exercised patient upload, reload and returning login, private-original download, care-only denial, explicit provider sharing and revocation, typed transcript/manual findings and clinician approval. Real deployed workers completed UTF-8 text and a two-page PDF, reclaimed one deliberately expired synthetic lease with a higher fence, rejected stale publication and purged deleted test bytes. These are bounded synthetic checks, not production acceptance or proof that preview schedules run. Detailed private evidence stays outside the public repository.

Builds publish only an allowlisted `build-identity.json` (source SHA, parser hash and migration hashes). The HTML source attribute, `/api/build`, and deployed worker log expose safe source identifiers independently. Schema identity remains the applied private provisioning record; a later application build does not imply a new migration. Check all sources after deployment. Missing identity is reported as `unavailable`, never guessed from the current Git branch.

Live AI and speech remain disabled. The complete release matrix, authenticated peripheral journeys, actual 200% zoom and separately blocked scheduling SQL behavior still require reconciliation. V2 and the hosted release are not complete.

## Required environment names

- `APP_ORIGIN`: exact origin for that environment.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: verified isolated project for preview.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only byte/worker services; never browser responses.
- `DOCUMENT_DISPATCH_SECRET`: server-only random secret of at least32 characters, shared by the existing background dispatch path.
- `AI_ENABLED=false`: keep disabled unless a separate live allowance is recorded.
- `GOOGLE_AUTH_ENABLED=false`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`: server admission and visible Google sign-in are independently off by default. Prepared callback completion verifies the principal/role and announces a session change before navigation. It has offline regressions, not real Google consent acceptance. Enable only on the exact approved preview override after the owner completes the intended OAuth client/provider setup.
- `GROQ_API_KEY`, `AI_TEXT_MODEL`, `LIVE_AI_AUTHORIZATION_REF`: optional server-only live configuration, insufficient without exact durable allowance/scope rows.
- `SPEECH_ENABLED=false`, `SPEECH_PROVIDER_VERIFIED=false`, `DEEPGRAM_API_KEY`, `LIVE_SPEECH_AUTHORIZATION_REF`, `AI_SPEECH_MODEL=nova-2`: prepared server-only retained transport; exact durable audio scope and separately authorized account verification are still required. See `speech.md`.
- Optional OCR configuration and additive schema are described in [reviewed OCR](ocr.md). Its server/public/verification flags default off; it has no approved live allowance.

The historical default text model is preserved. Do not replace it merely to make an account probe succeed. Verify actual model/account/free eligibility and per-request/minute limits before proposing enablement; stop for a concrete incompatibility rather than automatically switching.

## Official documentation check — 24 October 2026

[Deepgram's model/language table](https://developers.deepgram.com/docs/models-languages-overview) lists Hindi `hi` for the retained `nova-2`; its `nova-2-medical` entry lists English. This does not establish Hindi medical accuracy, Hinglish quality or the owner's historical runtime. Keep the existing adapter/model unchanged and disabled pending exact account and audio-allowance verification.

[Groq's supported-model table](https://console.groq.com/docs/models) and [the retained model page](https://console.groq.com/docs/model/llama-3.3-70b-versatile) currently label `llama-3.3-70b-versatile` Enterprise. It is absent from the displayed Free limits table. Its zero-spend availability to the intended organization is therefore **not established**; no live probe or automatic replacement is appropriate. [Groq's limits documentation](https://console.groq.com/docs/rate-limits) directs exact entitlement/limits checks to the organization's account settings. Preserve the code and keep generation disabled if that account cannot use this model at zero spend. Any alternative requires a separately reviewed compatibility/quality decision, not a tournament.

[Netlify documents background functions](https://docs.netlify.com/build/functions/background-functions/) for credit-based plans including Free and Enterprise, with a 15-minute platform maximum, immediate invocation acceptance and possible platform retries. [Its usage guide](https://docs.netlify.com/build/functions/usage-and-billing/) excludes most Legacy plans. The inspected account is Free, and the preview background worker has completed bounded jobs; neither guarantees remaining future allowance. The SQL fences/operation ledger remain authoritative under platform retries. [Scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/) require published-environment acceptance; the inspected preview reconciler is Manual, so preview cron is not assumed.

[Supabase's Free plan documentation](https://supabase.com/docs/guides/platform/billing-on-supabase) describes a two-project allowance, and [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing) can affect availability. Account inspection and the owner's separately created, verified isolated preview establish this deployment's target; public documentation alone does not. Do not create another project, upgrade a plan or copy production credentials to satisfy a test.

Authenticated read-only provider inspection on 25 October found Groq's intended account on Free, with the retained Llama model absent from both displayed limits and organization/project model pickers. Exact access and remaining allowance for that model remain unverified. Deepgram showed $200 promotional credit on Pay As You Go, auto-reload off and zero requests for the inspected week; promotional expiry and account concurrency were not displayed. This is no authorization to consume credit, call providers or substitute models.

## Identity and environment distinctions

The intended production application callback is `https://cliniqplus.netlify.app/auth/callback`; this is a configured-site target, not evidence of completed OAuth consent. An isolated preview uses its exact preview origin and separately verified Auth redirect configuration. The Supabase provider callback is `https://<verified-project-ref>.supabase.co/auth/v1/callback`. Obtain the intended project identity from the owner/account inventory; do not guess it. Owner account selection/consent/2FA remains an account-only action.

Before a hosted forward migration: inventory actual schema/migrations/policies/functions/duplicate ownership, verify the intended project and environment, take a backup/recovery artifact and rehearse preservation against its representative isolated copy. Apply the maintained seed-free baseline only to a verified empty environment; apply only newly versioned forward migrations to existing environments. Unknown policies, incompatible IDs and ambiguous identity/history mappings require explicit reconciliation. Never reset/reseed an existing project or mark migrations repaired blindly.

Recovery preserves original IDs/history. Roll application traffic back to a compatible contained version if necessary; additive schema should remain in place until reviewed. Do not drop approved records or run a destructive down migration as a shortcut. Record actual source/worker/schema identities after deployment.

## Worker acceptance to perform in the isolated hosted environment

Verify PDF.js worker code/assets and local font packaging in the actual bundle. Invoke the authenticated background function, observe a durable claim and completed bounded parse/job, simulate lost dispatch and expiry, and confirm fencing, byte purge and snapshot redaction. Verify actual platform task/deadline limits, auth header handling, shared configuration and secret separation. A dispatch202 is invocation acceptance only. Scheduled functions run on the published environment; do not assume preview cron executes. Explicit preview reconciliation must use the same runner.

Authenticated listening-HTTP/browser tests must then exercise upload/return/share/revoke and transcript/draft/review/approve/returning patient reads, cookie expiry/CDN/no-store behavior, errors/loading/conflicts and both themes/device sizes. Actual200% browser zoom remains a separate missing check; a narrow viewport is not its substitute.

## Proposed live text allowance — not granted or consumed

After the above compatibility/free-account checks, propose a single aggregate authorization for at most3 synthetic text requests: one explanation, one Q&A and one extraction. Aggregate input <=12,000 tokens and completion <=9,000; output <=3,000 per call, global concurrency1, at least60 seconds between calls, SDK/application retries0. Reduce these bounds to fit the verified account's actual per-request/minute limits before approval. Limit the allowance to exact synthetic actor/patient pairs and the unchanged reviewed model/provider. Separate operation budgets must fit inside that aggregate ledger. Ambiguous transmission consumes reservation; no automatic repeat or paid fallback.

This is a prepared proposal, not permission to execute it or enable public generation. Speech is excluded; its exact adapter/model/language, server transport and bounded audio allowance need their own verification/proposal. Ongoing public demo traffic needs a different, explicitly authorized allowance and synthetic scope; it must not drain privileged verification allowance. No billing change, paid resource, production mutation or owner consent is authorized by these instructions.
