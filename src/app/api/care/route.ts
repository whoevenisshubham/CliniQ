import { getSupabaseServerClient } from '@/lib/supabase-server';
import { careView, careMutate } from '@/lib/server/scheduling/service';
import { errorResponse, privateJson, readJson, requireSameOrigin } from '@/lib/server/http';
export async function GET(request: Request) { try {
    const u = new URL(request.url);
    return privateJson({ data: await careView(await getSupabaseServerClient(), u.searchParams.get('workspace'), u.searchParams.get('q') ?? '') });
}
catch (e) {
    return errorResponse(e);
} }
export async function POST(request: Request) { try {
    requireSameOrigin(request);
    return privateJson({ data: await careMutate(await getSupabaseServerClient(), request.headers.get('idempotency-key') ?? '', await readJson(request, 4096)) });
}
catch (e) {
    return errorResponse(e);
} }
