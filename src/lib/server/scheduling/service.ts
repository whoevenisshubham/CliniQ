import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePrincipal } from '../auth/context';
import { HttpError } from '../http';
import { id } from '../documents/service';
function check(error: {
    message: string;
    code: string;
} | null) {
    if (!error)
        return;
    const codes: Record<string, number> = { AUTH_REQUIRED: 401, NOT_FOUND: 404, INVALID_COMMAND: 400, INVALID_VITALS:422,CORRECTION_REASON_REQUIRED:422, REVISION_CONFLICT: 409, IDEMPOTENCY_CONFLICT: 409, SLOT_TAKEN: 409, OPERATION_LIMIT: 429 };
    const status = codes[error.message] ?? (['23505', '23P01'].includes(error.code) ? 409 : ['22P02', '22007', '22008', '23514'].includes(error.code) ? 422 : 503);
    throw new HttpError(status, status === 503 ? 'CARE_UNAVAILABLE' : error.message in codes ? error.message : 'INVALID_CARE_INPUT', status === 409 ? 'Availability or queue state changed. Refresh and review before retrying. Your original booking is retained if rescheduling failed.' : status === 503 ? 'Continuing-care services are temporarily unavailable.' : 'This request is unavailable. Check the selected workspace, values and current access.');
}
export async function careView(client: SupabaseClient, workspace: string | null, q = '') { await resolvePrincipal(client); if (workspace)
    id(workspace); if (q.length > 100)
    throw new HttpError(400, 'INVALID_QUERY', 'Search is limited to100 characters.'); const r = await client.rpc('care_view', { w: workspace, q }); check(r.error); return r.data; }
export async function careMutate(client: SupabaseClient, key: string, command: unknown) { await resolvePrincipal(client); id(key); const r = await client.rpc('care_mutate', { k: key, command }); check(r.error); return r.data; }
