import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  errorResponse,
  privateJson,
  requireSameOrigin,
  readJson,
  HttpError,
} from "@/lib/server/http";
import { documentDetail, changeDocument } from "@/lib/server/documents/service";
import { dispatchDocumentWork } from "@/lib/server/jobs/dispatch";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return privateJson(
      await documentDetail(
        await getSupabaseServerClient(),
        (await context.params).id,
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new HttpError(400, "INVALID_REQUEST", "Send a record action.");
    const result = await changeDocument(
      await getSupabaseServerClient(),
      (await context.params).id,
      body as Record<string, unknown>,
    );
    await dispatchDocumentWork();
    return privateJson(result);
  } catch (e) {
    return errorResponse(e);
  }
}
