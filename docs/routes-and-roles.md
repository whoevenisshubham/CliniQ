# Connected routes and role boundaries

Every authenticated page resolves verified Auth to its active application account. Service/SQL authorization is still required after navigation. A visible link is not an access grant. Listening-browser acceptance is separate from the isolated handler suites and labelled visual fixtures.

| Route | Roles | Available journey / authority |
|---|---|---|
| `/records?document=<id>` | Patient, doctor | Owner library or explicitly granted documents; private originals, source detail, versioning and owner share/revoke/delete |
| `/consultations?id=<id>` | Doctor, patient | Treating clinician draft/transcript/review/approval; patient's approved-record reader |
| `/evidence?thread=<id>&consultation=<id>&document=<id>` | Doctor, patient | Scoped source navigation and durable evidence conversations; generation off by default |
| `/care` | Patient, doctor, receptionist | Appointments or scoped operational queue/intake; scheduling behavioral acceptance remains open |
| `/continuity?encounter=<id>` | Patient, doctor | Owner medicine tracking/reports/tasks; clinician follow-up intentions from a current approved source |
| `/patient/account` | Patient | Owner profile, purpose preferences, patient-entered family history and authorized measurement sources |
| `/billing?encounter=<id>` | Doctor, patient | Explicit treating-clinician illustrative review; owner reads retained reviewed selections |
| `/admin` and its existing subroutes | Admin | Workspace-scoped staff status management, operational encounter metadata, actual counts, transactional membership-change receipts and read-only configuration; no automatic clinical access or global-role editing |
| `/research` | Research, admin | Explicit unavailable state; no aggregate data/export acceptance |
| `/staff` | Nurse | Explicit unavailable state; nursing membership does not grant clinician approval |

Doctor and patient home routes now render the original role shell with scoped real clinical listings. `/doctor/patients` searches up to 50 authorized patients and links to patient-filtered encounters; `/doctor/alerts` displays recorded allergies only, without comprehensive safety-screening claims. `/patient` lists actual reviewed versions and links to documents, medicines/tasks, appointments and profile. Legacy entry points redirect to these implementations: `/patient/reports`, `/doctor/documents` → records; `/doctor/emr` → `/consultations?view=history` (completed encounters); `/doctor/consultation` → consultations; `/patient/appointments`, `/receptionist` → care; `/patient/prescriptions` → continuity; `/doctor/billing` → billing; `/patient/chat` → evidence. Context-sensitive links inside the repaired workflows carry the actual document, encounter or approved source. A bare legacy billing link asks the user to select an approved visit rather than inventing one.

The document workspace is keyed by actor and incoming document; evidence is keyed by actor and all source/thread parameters. Selection responses are fenced against another document and ignored after unmount. Consultation, care, continuity, account and billing are actor-keyed. Logout reloads the application after successful server sign-out. This source design and the offline actor-cache checks do not replace real cross-account browser verification.

Care actions pause after a failed refresh, and 401/403/404 hides private state. Intake correction forms capture their base revision and retain unsaved values when refreshed data changes. The owner cancel/reschedule correction separates ownership from staff care relationships: owners need no care relationship to themselves. It is a targeted forward repair; booking races, slot release, queue sequencing and returning-session scheduling acceptance are still missing under the recorded test rejection.

`/design/*` routes are nonpersistent synthetic layout fixtures. Their labels and role-specific navigation distinguish them from the actual authenticated journeys. They do not prove persistence, live AI or deployed access policy acceptance.

The original DashboardShell/AppSidebar is reused across the scoped document, consultation, care, continuity, evidence, billing and account workspaces through a server-verified display context. It does not grant access. Sidebar destinations use the canonical routes, preserving active navigation after legacy redirects. Patient selected-visit links read only approved versions; they do not request clinician draft endpoints. The original root page redirected to login; the current public landing preserves the added V2 explanation rather than inventing an older landing reference.
