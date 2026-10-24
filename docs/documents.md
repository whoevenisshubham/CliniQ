# Private document lifecycle

## Reproduce the application journey

After isolated preparation, `npm run test:integration -- tests/integration/documents.test.ts` invokes the actual multipart/list/detail/content/action/login/logout route functions against real local Auth, PostgREST and Storage. The Next cookie adapter is supplied by the harness; principals, JWTs and policies are real. It uploads a synthetic two-page text record, retries with the same key, signs out/in, lists and downloads saved bytes, shares with the eligible provider, reads as that provider, revokes and checks denied future reads. Replacement/manual versions, deletion, quotas, private Storage, interrupted requests, commit/storage failures and stale fences are also tested. These are direct handler integrations, not a listening HTTP server or rendered authenticated browser acceptance.

For a configured allowed application environment: sign in as an explicitly provisioned patient, open Records, Add a record, and wait for saved metadata/bytes. Processing is independent and can continue later. Sign out/in and reopen the source. Manage sharing lists only eligible clinician/workspace pairs; grant one explicitly. Sign in separately as that clinician to read Shared records. Revoke from the patient session; future detail/source/content requests must fail for the clinician. Use replacement to retain old originals privately while revoking existing shares; use manual transcript for unreadable sources. Delete requires confirmation and removes access before private cleanup.

## Admission and recovery

`document_admit` serializes the patient quota and operation key, reserves an opaque immutable object key and expected document revision, and charges pending bytes once. The server validates full bounded bytes and hashes before private upload. A service-only stage records stored bytes. Commit locks the operation/document, verifies the current revision, records an immutable version and enqueues ingestion in the same SQL transaction. Only then is the record ready.

A failed upload/commit marks a new record upload_failed while preserving retryable intent. Same key + same content recovers; conflicting reuse fails. After 15 minutes, expired reserved/stored operations become cleanup candidates. Reconciliation removes only their exact recorded keys, then releases reservation accounting. Tombstones remain and are revisited in bounded batches, covering a delayed upload that finishes after an earlier cleanup. Existing unrelated bucket objects are never swept.

Replacement keeps previous bytes within the quota and makes the new version current transactionally. Old versions are owner-only provenance; grants read only current sources. Manual text is a new current version with source_class=manual and a parent version; it is not automatic OCR. Both replacement and manual-version creation revoke prior grants.

Share/revoke/retry/delete lock and revise the document. They cancel old queued/running jobs, delete obsolete chunks and mark derived-result references stale. Share/revoke queue current local parsing again with the new revision. Delete denies all reads immediately, then queues bounded exact-key byte/text purge. No explanation/result-generation service is enabled.

## Parsing and workers

PDF.js 6.4.299 is pinned. A Node worker thread receives only bounded bytes; it does not load arbitrary remote URLs, execute PDF JavaScript, or request external OCR/fonts. The parser worker has a 30-second hard termination timer and memory bounds; PDF pages, extracted text and output chunks are capped. Text is page-separated with form feeds. Chunk offsets are Unicode code-point offsets within each page, with at most 150-character overlap. Tables and reading order may be ambiguous: compare the original before clinical use.

A durable job uses a 90-second lease, monotonic fence and at most three claims. Input revision/current-version checks and publication occur transactionally. A revoked/replaced/deleted resource or expired/stale fence cannot publish. Transient pre-provider errors wait 30 seconds before a bounded retry; there are no provider calls. Definitively failed or unsupported parsing is visible; manual text remains an option. Owner-triggered retry creates a fresh revision/job.

`npm run jobs:local` verifies the exact isolated Docker project/loopback endpoint, cleans a bounded set of recorded orphans and runs at most one job. Repeat explicit invocations to drain a test queue. Netlify background dispatch validates a server-only secret; the scheduled reconciler has no public application admission capability. It only cleans exact stale operations and invokes the same runner. Intended hosted asset/deadline/schedule verification remains separate.

## Access and caching

All application reads use the caller's RLS client. The byte reader checks current access, reads only the exact registered key with a server-only capability, then rechecks access/version before returning private/no-store bytes. No ordinary Storage download, signed URL, listing, overwrite, direct upload or delete path is available. Source/detail reads recheck the revision after loading content. The UI reloads current access on return/focus and uses no persistent browser cache for private text. A copy already delivered to a user cannot be recalled.

No hosted database migration, hosted account mapping, production mutation or provider call is established by these tests. The public visual sample is labelled fixture data and proves layout only.

## Client reconciliation and access changes

The document workspace retains the exact submitted body, source revision and operation key while a request outcome is uncertain. Editing inputs and starting another mutation are paused; “Reconcile saved request” resubmits that same operation for the server's durable operation lookup. It does not allocate a new key or silently advance the source revision. The pending body is held only in this mounted actor's memory; reload is not claimed to preserve an unsent local file.

A known successful commit stays reported saved even if the subsequent view refresh fails. Access failures hide private rows, source detail, eligible providers and local form contents. Selection responses are fenced against rapid document changes and ignored after unmount. Returning-session persistence and the server ledger are exercised in isolated integration; browser timeout/actor-switch acceptance remains separate.
