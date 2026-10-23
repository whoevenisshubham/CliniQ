import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { id } from "@/lib/server/documents/service";
import { errorResponse, HttpError, privateJson } from "@/lib/server/http";
export async function GET(_request: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const client = await getSupabaseServerClient();
        const p = await resolvePrincipal(client);
        const key = id((await ctx.params).id);
        const r = await client.from("clinical_operations").select("response").eq("actor_id", p.id).eq("operation_key", key).maybeSingle();
        if (r.error)
            throw new HttpError(503, "CLINICAL_UNAVAILABLE", "Operation reconciliation is temporarily unavailable.");
        return privateJson({ data: r.data?.response ?? null });
    }
    catch (e) {
        return errorResponse(e);
    }
}
