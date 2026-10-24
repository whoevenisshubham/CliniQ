import {
  getSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase-server";
import {
  errorResponse,
  privateJson,
  requireSameOrigin,
} from "@/lib/server/http";
import { uploadDocument } from "@/lib/server/documents/service";
import { multipartUpload } from "@/lib/server/documents/upload-request";
import { dispatchDocumentWork } from "@/lib/server/jobs/dispatch";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const input = await multipartUpload(request);
    input.documentId = (await context.params).id;
    const result = await uploadDocument(
      await getSupabaseServerClient(),
      getSupabaseAdminClient(),
      input,
    );
    await dispatchDocumentWork();
    return privateJson(result, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
