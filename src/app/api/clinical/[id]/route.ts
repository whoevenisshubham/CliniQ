import { getSupabaseServerClient } from "@/lib/supabase-server";
import { clinicalDetail,clinicalRevision } from "@/lib/server/clinical/service";
import { errorResponse, privateJson } from "@/lib/server/http";
export async function GET(_request: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        return privateJson({ data: await (new URL(_request.url).searchParams.get('revisionOnly')==='true'?clinicalRevision:clinicalDetail)(await getSupabaseServerClient(), (await ctx.params).id) });
    }
    catch (e) {
        return errorResponse(e);
    }
}
