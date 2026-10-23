import { getSupabaseServerClient } from "@/lib/supabase-server";
import { clinicalDetail } from "@/lib/server/clinical/service";
import { errorResponse, privateJson } from "@/lib/server/http";
export async function GET(_request: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        return privateJson({ data: await clinicalDetail(await getSupabaseServerClient(), (await ctx.params).id) });
    }
    catch (e) {
        return errorResponse(e);
    }
}
