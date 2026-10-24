import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { id } from "@/lib/server/documents/service";
import { errorResponse, HttpError } from "@/lib/server/http";
import { approvedReport } from "@/lib/clinical/approved-report";
export async function GET(_req: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const client = await getSupabaseServerClient();
        await resolvePrincipal(client);
        const versionId = id((await ctx.params).id);
        const r = await client.from("emr_versions").select("id,reviewed_at,source_revision,snapshot,amended_from_id").eq("id", versionId).maybeSingle();
        if (r.error)
            throw new HttpError(503, "CLINICAL_UNAVAILABLE", "Approved record unavailable.");
        if (!r.data)
            throw new HttpError(404, "NOT_FOUND", "Approved record unavailable.");
        const html = approvedReport(r.data);
        const recheck = await client.from("emr_versions").select("id").eq("id", versionId).maybeSingle();
        if (recheck.error)
            throw new HttpError(503, "CLINICAL_UNAVAILABLE", "Approved record unavailable.");
        if (!recheck.data)
            throw new HttpError(404, "NOT_FOUND", "Approved record unavailable.");
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": 'inline; filename="approved-record.html"', "Cache-Control": "private, no-store", "Vary": "Cookie, Origin", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff" } });
    }
    catch (e) {
        return errorResponse(e);
    }
}
