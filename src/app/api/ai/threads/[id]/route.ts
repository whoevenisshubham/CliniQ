import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase-server';
import { admitAI, threadView } from '@/lib/server/ai/service';
import { runAIJob } from '@/lib/server/ai/runner';
import { providerConfiguration } from '@/lib/server/ai/provider';
import { dispatchDocumentWork } from '@/lib/server/jobs/dispatch';
import { errorResponse, privateJson, readJson, requireSameOrigin } from '@/lib/server/http';
export async function GET(_r: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    return privateJson({ data: await threadView(await getSupabaseServerClient(), (await ctx.params).id, getSupabaseAdminClient()) });
}
catch (e) {
    return errorResponse(e);
} }
export async function POST(request: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        requireSameOrigin(request);
        const jobId = await admitAI(await getSupabaseServerClient(), request.headers.get('idempotency-key') ?? '', (await ctx.params).id, await readJson(request, 4096));
        // Default unavailable/evidence-only operation uses the same bounded worker
        // inline, so an unconfigured deployment cannot imply working generation.
        if (!providerConfiguration().enabled)
            await runAIJob(getSupabaseAdminClient(), jobId);
        else
            await dispatchDocumentWork();
        return privateJson({ data: { jobId, status: 'queued', pollAfterMs: 2000 } }, 202);
    }
    catch (e) {
        return errorResponse(e);
    }
}
