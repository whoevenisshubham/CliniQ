import { getSupabaseServerClient } from "@/lib/supabase-server";
import { reviewClinicalProposal } from "@/lib/server/clinical/service";
import { errorResponse, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";
export async function POST(request: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        requireSameOrigin(request);
        return privateJson({ data: await reviewClinicalProposal(await getSupabaseServerClient(), (await ctx.params).id, request.headers.get("idempotency-key") ?? "", await readJson(request, 2048)) });
    }
    catch (e) {
        return errorResponse(e);
    }
}
