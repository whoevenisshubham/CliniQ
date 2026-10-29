# Reviewed illustrative billing and catalogue

An authorized approved visit links to `/billing?encounter=<id>`. Only its treating clinician can review selections; the owning patient can read reviewed versions. Reception, unrelated providers, other patients and other workspaces cannot access them. No real payment, insurance submission, autonomous substitution or live-stock integration exists.

The dated `synthetic-2026-10-24-v1` tariff adapts 38 retained CliniQ descriptions/prices from `src/lib/billing-engine.ts` at d2fadb62a87137ff0f7920803cc06563dcce282a. The original engine is retained; its transcript detection, elapsed-time charge and assumed 5% tax are not invoked. The catalogue is an explicit synthetic edition, not a current market price source. Provisioning inserts it only into explicitly guarded local synthetic workspaces; no page/API request seeds a tariff. A host requires separate reviewed configuration.

The server looks up immutable workspace tariff items and multiplies bounded integer quantities by integer paise. Clients cannot submit prices or totals. Duplicate selections, fractional/negative quantities, unknown items, missing confirmation, stale revisions, excessive totals and superseded approved sources are rejected. Taxes are unassessed; the displayed item total is not a payable invoice.

Forward migration converts existing NUMERIC(10,2) values to paise with exact decimal multiplication. It preserves original rupee fields, line items, IDs and status. New reviews write separate fields plus immutable billing revisions containing the previous record. No legacy draft is silently displayed as a clinician-reviewed bill. Amendments label previous review sources superseded; they do not infer new selections or silently transfer a previous review.

The UI retains selections after failure/refresh, requires source/revision reconciliation before overwriting a changed review and exposes same-key retry for uncertain outcomes. Retained Jan Aushadhi data is available as a clearly historical molecule lookup; its price validity, stock and equivalence remain unknown. It makes no automated recommendation and is not a prescription or substitution service.

Acceptance requires the focused real-Auth billing suite and the tested-source preservation report. Rendered fixtures, handler integration, listening HTTP/browser and actual hosted acceptance are different scopes.
