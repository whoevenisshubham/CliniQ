# Client privacy and request recovery

The repaired document, care, continuity, billing, account, clinical, evidence and speech clients distinguish a confirmed response from an unknown request outcome. This is client reliability, not evidence of authenticated hosted acceptance.

## Response boundaries

`readJsonResponse` retains HTTP access-denial status even if an intermediary returns HTML, empty text, null or malformed JSON. It uses curated status/code guidance for access, quotas, review and correction requirements; raw dependency bodies are never shown. Each workspace validates the success envelope and the fields it consumes before replacing state or acknowledging a save. An invalid 2xx mutation response remains uncertain. Network timeout, abort and 5xx do not prove that SQL failed to commit.

Access loss hides private loaded content and local forms, aborts pending reads and invalidates their generations. Actor/source routes remain keyed by current principal and encounter/document context. Unmount/context changes invalidate older callbacks even if a network double ignores abort. A definitive lost-access state cannot be repopulated by a late successful read.

## Saved operations

| Client | Reconciliation authority | Retained scope |
|---|---|---|
| Documents | Same request to the durable upload/mutation ledger | Exact body, operation key, destination and document revision |
| Care | Same key/body to existing care operation ledger | Original command, slot/appointment/queue identifiers and expected revision |
| Medicines/tasks | Same key/body to continuity ledger | Exact tracking/report/task command and expected revision |
| Account | Same key/body to account ledger | Exact profile/preference/family command and expected revision |
| Billing | Same key/body to reviewed billing ledger | Original encounter destination, source/tariff, selections and revision |
| Consultation | Actor-scoped operation lookup, then same-key submission only if absent | Original command/path, segment identity, revision and review acknowledgements |
| Evidence | Same key/body to thread/job admission ledger | Exact thread, question and source identifiers |
| Speech | Read original operation; save-only retained-result command | Original operation/segment identity and server revision fence; no audio resend |

An unresolved operation blocks another mutation from replacing it. Recovery buttons remain usable when the outcome is uncertain; edit/confirmation controls remain locked. Pending request bodies are mounted actor memory, not a promise of unsent input survival across reload. Server ledgers retain committed operations and durable work independently.

A confirmed save remains reported saved if the following read fails. Dirty clinical findings and tracking/account/billing forms are retained during recoverable refresh/conflict states. They are discarded only by an explicit user action, an acknowledged save or definitive access loss. A follow-up read failure pauses new edits rather than inventing a second successful operation.

Speech JSON `save_retained` accepts only its explicit bounded command. It verifies current clinician/encounter/operation access and invokes the existing SQL commit fence for an already validated retained response. It creates no reservation or provider attempt and sends no audio. Merely checking admitted, transmitting or outcome-unknown state cannot enable another capture. Live providers remain disabled/unaccepted.

## Evidence distinctions

Offline mounted tests use actual React components, jsdom and bounded HTTP doubles. They exercise private-content hiding, late actor responses, input retention, same-key recovery, usable recovery controls and confirmed-save/failed-refresh behavior. The one development-only DOM dependency does not enter production code. Existing isolated Auth/database/Storage tests check real handler envelopes and speech save-only access/idempotency with a zero provider-call counter.

These checks do not start a local server, exercise actual browser authentication, prove scheduling SQL races, inspect the deployed hosting archive or establish mobile/200% zoom acceptance. The specific recorded execution rejections remain in force.
