import { getSupabaseServerClient } from "@/lib/supabase-server";
import { clinicalList, mutateClinical } from "@/lib/server/clinical/service";
import { errorResponse, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";
export async function GET() {
    try {
        return privateJson({ data: await clinicalList(await getSupabaseServerClient()) });
    }
    catch (e) {
        return errorResponse(e);
    }
}
export async function POST(request: Request) {
    try {
        requireSameOrigin(request);
        const body = await readJson(request, 131072);
        if (!body || typeof body !== "object" || Array.isArray(body))
            throw new HttpError(400, "INVALID_COMMAND", "A clinical command is required.");
        return privateJson({ data: await mutateClinical(await getSupabaseServerClient(), request.headers.get("idempotency-key") ?? "", body) });
    }
    catch (e) {
        return errorResponse(e);
    }
}
