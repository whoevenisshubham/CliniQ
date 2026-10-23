import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase-server';
import { jobView } from '@/lib/server/ai/service';
import { errorResponse, privateJson } from '@/lib/server/http';
export async function GET(_r: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    return privateJson({ data: await jobView(await getSupabaseServerClient(), getSupabaseAdminClient(), (await ctx.params).id) });
}
catch (e) {
    return errorResponse(e);
} }
