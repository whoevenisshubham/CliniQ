# Durable work and recovery

SQL owns document/AI jobs, speech operations and continuing-care intentions. No browser timer is the durable queue. Local explicit maintenance, the background function and the scheduled function use shared recovery code.

## Partial failures

AI, speech and continuity reconciliation run independently and report their own completed/failed stages. A failed AI recovery prevents AI execution, including an explicitly requested AI job; it does not starve independent document parsing/purge work. The caller receives `degraded: true` even if that document succeeds. No result calls a partial recovery fully completed. A healthy empty queue returns `idle`; an empty queue with dependency failure returns `recovery_degraded`.

Scheduled maintenance attempts exact-key cleanup and dispatch even if another independent stage fails. Missing dispatch configuration or a non-202 dispatch response is reported as pending with a 503 maintenance outcome. A 202 means invocation accepted, not completed parsing. The background result reports the actual bounded job status and returns failure for degraded recovery; platform background responses/logs still need deployed acceptance. The explicit local runner exits unsuccessfully on degraded recovery or cleanup failure while retaining the authoritative SQL state.

Diagnostics contain bounded job/operation IDs, stage, input revision/fence where relevant, status and allowlisted failure/recovery category. They exclude credentials, clinical text, provider output and audio. Dependency error messages are not forwarded in recovery reports.

## Existing fences and bounds

Document claims have a 90-second lease, increasing fence and at most three attempts. Failed local work waits 30 seconds before retry. Results distinguish `retry_queued`, `failed` and a stale claim; a lost/expired claim cannot report a successful failure transition. Current document version/revision is checked again before publication. Existing real isolated cases cover lease reclaim, stale publication, retry exhaustion, version/delete invalidation and exact recorded orphan-key cleanup; retain their source scope.

Orphan cleanup claims at most five recorded operations and runs for a bounded interval. It removes exact keys, never enumerates a bucket by prefix. Only an acknowledged cleanup increments its completed count. Repeated task materialization uses source/revision/time uniqueness and bounded schedule cursors. AI/speech ambiguous transmission conserves its reservation and is never automatically resent. Speech expiry distinguishes admission-before-send from unknown outcome after the send marker.

The new recovery regression uses a real isolated patient, private bytes, actual parser worker and SQL publication while injecting only an AI-recovery outage. That case is service integration, not hosted/listening-browser acceptance. The separately rejected scheduling suite is not executed by this work.

## Deployment boundary

The parser starts `scripts/document-parser-worker.mjs` relative to the function working directory. `netlify.toml` includes that file, PDF.js legacy build, CMaps and standard fonts, with PDF.js externalized. Local asset paths use forward slashes and the trailing slash required by the pinned PDF.js API on Windows and Linux. PDF.js disables external system/font-face loading; Geist is bundled from local Fontsource packages.

`node scripts/verify-worker-package.mjs` builds both function entries using the installed esbuild and stages their configured parser/assets. It runs multilingual UTF-8 text and a one-page synthetic Latin PDF through a worker from that staged directory. The small `worker-package-smoke` artifact labels this exact scope. It is not the actual Netlify archive; it does not establish arbitrary multilingual PDF coverage or a hosted worker. Required runtime resolution, representative document fonts/CMaps, worker-thread availability, memory/time caps and the actual function archive must still be verified on the intended host. A Next build or substitute local bundle is insufficient proof of that archive.

Docker runtime availability is independent from execution approval. Preserve existing volumes and the isolated stack when diagnosing its engine IPC failure. Do not reset/reseed or use an alternate launcher for the recorded denied Next startup.
