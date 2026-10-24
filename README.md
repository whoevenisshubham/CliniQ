# CLINIQ+

Private health records and clinician-reviewed documentation, built on Next.js and Supabase PostgreSQL/Auth/Storage. This is an educational synthetic-data product in development. V2 and hosted acceptance are incomplete; no clinical validation or regulatory certification is claimed.

## Working document foundation

Patients can save a supported file, return in a new session, read the private original, share it explicitly with an eligible clinician, revoke future access, retain replacement versions and delete it. A care relationship alone does not reveal files. Replacement revokes existing grants; sharing the new source is a separate choice. Already downloaded copies cannot be recalled.

Uploads are bounded to 4 MiB each, 10 live records, 10 retained versions per record and 40 MiB per patient including reserved uploads and retained originals. The server checks MIME, file signatures/extensions, UTF-8 and actual byte size. Upload intent, immutable bytes, SQL commit and queued parsing have separate states. Retries use idempotency keys. Reconciliation removes only exact recorded orphan keys.

PDF/text parsing is local and bounded: 20 pages, 100,000 extracted characters, 100 chunks and a 30-second parser deadline. Page references and Unicode source offsets are retained. Scanned images, encrypted PDFs, unsupported bounds and empty text have explicit states. Patient-entered transcripts are separate, labelled versions linked to the retained original. No OCR, inference or embedding is invoked.

The original speech-to-EMR hooks, adapters, prompts and clinical review components remain in the repository. Most legacy clinical write endpoints are still contained. Provider/model choices were preserved; the exact historically successful runtime is not asserted. See the [reuse map](docs/core-pipeline-reuse.md).

## Manual consultation foundation

The `/consultations` workspace adds authorized encounter creation, durable typed transcripts and clinician findings, revision-checked review, atomic approval and linked corrections. Patients read only approved records and prescriptions, including returning sessions. See [consultation contracts and limitations](docs/consultations.md). `/design/consultation` is a labelled rendered fixture with persistence disabled. The retained speech path now has authenticated bounded admission, durable offline-double transport and transcript recovery; live transport remains disabled. See [speech boundaries and the unconsumed verification proposal](docs/speech.md). Authenticated browser and hosted acceptance remain open.

## Continuing care

`/care` connects synthetic availability, patient appointments, scoped reception intake and the clinician queue. Its specifically blocked scheduling behavioral suite remains incomplete; endpoints or fixtures do not establish race acceptance. See [continuing-care scope](docs/continuing-care.md).

`/continuity` connects exact approved medicine references, explicitly chosen tracking times, durable in-app tasks, follow-up intentions and self-reported adherence with correction history. A follow-up intention is not a booking. No schedule is inferred from medical directions, and no external message delivery is claimed. See [medicines and task operations](docs/medicines-tasks.md).

`/patient/account` persists owner-controlled profile, purpose preferences and explicit family history, with approved measurements grouped by source/date/unit. It uses no mock patient fallback or unexplained health score. Preferences do not replace document grants. See [account, family and trends](docs/account-trends.md).

Approved encounters link to [illustrative billing](docs/illustrative-billing.md): clinician-selected items, a dated explicitly provisioned synthetic tariff, integer paise and retained review history. No transcript-triggered charges, assumed tax, payment, live stock or automatic substitution is implemented. `/design/continuity`, `/design/account` and `/design/billing` are labelled visual fixtures.

## Source review and offline orchestration

`/evidence` connects private source text, approved versions, persistent conversations and durable job states. Authorization precedes retrieval ranking; revocation/version/deletion invalidates results. External generation defaults off and is labelled unavailable/evidence-only. Offline provider-double output is never called working live AI. See [AI architecture, budgets and evaluation](docs/ai.md) and [deployment preparation](docs/deployment-readiness.md).

## Setup and verification

Use Node 22.20 or later within the supported Node 22 line and Docker for isolated integration tests.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx --no-install supabase start --workdir tests/infra
npm run test:integration:prepare
npm run test:integration
npm run jobs:local
```

The prepare command requires an empty, verified local test database; it refuses to reset existing data. It tests a seed-free baseline and representative legacy forward migration, then explicitly provisions bounded synthetic accounts. Integration suites explicitly provision additional isolated synthetic identities. Credentials stay private under ignored `tests/infra/.runtime/` or test-process memory. Never publish runtime credentials or infrastructure startup output. Public `/api/seed` remains unavailable.

Copy `.env.example` for an independently verified development environment. Never use production credentials for preview. Intended hosted upgrades require inventory, backup and reconciliation first. See [identity and isolation](docs/identity-isolation.md), [document lifecycle and reproduction](docs/documents.md), and [baseline migration protocol](supabase/baseline/README.md).

The application opens patient/provider accounts at `/records`; `/patient/reports` and `/doctor/documents` redirect there. `/design/documents` is a clearly labelled synthetic visual fixture, not a connected demo or an AI explanation. Real route integration, rendered visual fixtures and hosted acceptance are separate evidence layers.

## Worker operation

See the [route/role/action map](docs/routes-and-roles.md) and [operational recovery contract](docs/operations-recovery.md) for connected navigation, partial failures and remaining acceptance boundaries.

Admission commits a durable job before dispatch. Configure a server-only `DOCUMENT_DISPATCH_SECRET` of at least 32 characters for authenticated background dispatch. The worker claims one job with a 90-second lease, increasing fence and at most three attempts. Publication checks the current document revision/version and unexpired claim. The scheduled reconciler performs a bounded exact-key cleanup and dispatches the same runner. Preview schedules are not assumed to run; use explicit maintenance or the isolated local runner.

Background-function availability, packaged assets, deadlines and hosted environment configuration require verification on the intended Netlify account before hosted acceptance. No paid resource or fallback is required or enabled by the local tests. All inference remains disabled.

## Provenance and limits

CliniQ history and original clinical modules are preserved. Suitable MediFlow helpers retain contributor/source attribution; one PostgreSQL authority is used. Geist fonts are bundled locally from Fontsource, with their SIL OFL notices retained in the installed packages and [third-party notices](docs/third-party-notices.md).

The implementation is not a completed EMR or a medical recommendation system. Local/isolated service checks, visual fixtures, authenticated browser workflows and hosted acceptance have different coverage. Remaining milestone acceptance is explicit in the linked contracts. Historical feature descriptions in Git history are not acceptance evidence.
