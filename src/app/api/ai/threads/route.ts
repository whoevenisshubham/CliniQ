import { getSupabaseServerClient } from '@/lib/supabase-server';
import { resolvePrincipal } from '@/lib/server/auth/context';
import { createThread } from '@/lib/server/ai/service';
import { errorResponse, HttpError, privateJson, readJson, requireSameOrigin } from '@/lib/server/http';
export async function GET() { try {
    const c = await getSupabaseServerClient();
    await resolvePrincipal(c);
    const r = await c.from('ai_threads').select('id,consultation_id,created_at').order('created_at', { ascending: false }).limit(50);
    if (r.error)
        throw new HttpError(503, 'AI_UNAVAILABLE', 'Conversations are unavailable.');
    return privateJson({ data: r.data });
}
catch (e) {
    return errorResponse(e);
} }
export async function POST(request: Request) { try {
    requireSameOrigin(request);
    const b = await readJson(request, 1024);
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some(k => k !== 'consultationId'))
        throw new HttpError(400, 'INVALID_COMMAND', 'Only encounter context is accepted.');
    const c = (b as {
        consultationId?: unknown;
    }).consultationId;
    if (c !== undefined && c !== null && typeof c !== 'string')
        throw new HttpError(400, 'INVALID_COMMAND', 'A consultation UUID is required.');
    return privateJson({ data: { threadId: await createThread(await getSupabaseServerClient(), request.headers.get('idempotency-key') ?? '', c as string ?? null) } });
}
catch (e) {
    return errorResponse(e);
} }
