# Identity and isolated verification

Normal admission verifies Supabase Auth, resolves an explicit active application
account, then resolves active memberships matching its database role. Database
policies additionally require an existing Auth session. A signed access JWT from
a logged-out session therefore cannot continue reading application rows. Patient
ownership, treating-provider care scope and document-specific grants are separate.
Admin/reception membership does not grant clinical content. No metadata/email
merge, staff self-promotion or automatic provisioning occurs at login.

The PKCE callback accepts only the configured application origin and exact
allowlisted relative returns. Supabase exchanges the one-use code using its verifier
cookie. Bootstrap derives the actor from the authenticated, active Auth session,
requires verified email, serializes first-account creation, and creates only one
patient profile with unknown demographics nullable. A legacy email collision fails
for explicit linking; returning identities retain their application UUIDs. Callback
and private responses are no-store and callback referrers are suppressed.

`/api/me`, provider-scoped `GET /api/consultations/:id/emr`, and the private document
byte reader are available through authenticated user clients. The other 34 legacy
HTTP exports remain contained, including clinical draft writes/finalization and all
inference/speech endpoints. The EMR reader preserves original medication JSON beside
normalized fields and labels deterministic source formatting. Multiple historical
drafts require reconciliation rather than silently choosing one.

Private Storage denies authenticated direct downloads, signing, listing, replacement
and deletion. Owner uploads require an exact pre-registered object row. The byte
reader checks caller RLS, loads only the registered key using the server capability,
and rechecks current access/version before returning bytes. This stops publication
after a concurrent revocation; already delivered bytes cannot be recalled. M2 still
must implement quotas, admission/storage sagas and grant/revoke transactions/UI.

## Local test setup

Use Node 22 and Docker. `npm ci --ignore-scripts` installs the pinned Supabase CLI.
`tests/infra/supabase/config.toml` identifies only `cliniq-v2-m1-isolated`; migrations
and seeding are disabled during service startup. Start it explicitly with:

```sh
npx --no-install supabase start --workdir tests/infra
npm run test:integration:prepare
npm run test:integration
```

CLI startup/status may print local credentials. Keep those outputs private. CI
captures startup output privately and uploads only preservation hashes/counts.

Preparation refuses an existing application schema; it never resets or reseeds it.
It verifies an empty fresh baseline in a rolled-back setup transaction, then applies
an inspected representative legacy fixture and the forward migration, comparing all
original fields across 15 tables before explicitly linking newly provisioned Auth IDs.
Fixture credentials live only in ignored `.runtime/fixture.json`; do not publish them.
Existing data is retained on repeat attempts. Use a separately named isolated project
when a new fresh-setup run is needed. Infrastructure failure fails this gate, not a skip.

`npm run setup:demo:local` explicitly provisions constrained synthetic workspaces
against that verified local project only. It refuses hosted URLs, non-demo workspaces
and configured inventory caps, uses random separate Auth identities, never resets
passwords or merges by email, and stores credentials only in ignored `.runtime/`.
It is not an HTTP seed route or a hosted provisioning implementation.

The integration suite uses actual Auth, PostgreSQL/PostgREST and Storage services.
Only the Next cookie-access adapter is supplied when invoking HTTP handlers without
a Next server; principals and policies are real. PKCE uses local captured mail, never
an external email/speech/model provider. Google owner consent remains hosted acceptance
work; local magic-link PKCE is not proof of Google OIDC.

The previously rejected local Next server command has not been retried. Browser
runtime, network cookie/CDN behavior and authenticated visual checks remain unverified
locally. No production schema/configuration mutation or provider request is authorized
by these tests. See the baseline guide before preparing any intended hosted upgrade.
