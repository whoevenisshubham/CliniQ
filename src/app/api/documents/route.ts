import {
  getSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase-server";
import {
  errorResponse,
  privateJson,
  requireSameOrigin,
} from "@/lib/server/http";
import { listDocuments, uploadDocument } from "@/lib/server/documents/service";
import { multipartUpload } from "@/lib/server/documents/upload-request";
import { dispatchDocumentWork } from "@/lib/server/jobs/dispatch";
export const runtime='nodejs';export const maxDuration=120;
export async function GET() {
  try {
    return privateJson({
      documents: await listDocuments(await getSupabaseServerClient()),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const result = await uploadDocument(
      await getSupabaseServerClient(),
      getSupabaseAdminClient(),
      await multipartUpload(request),
    );
    await dispatchDocumentWork({documentId:result.document_id});
    return privateJson(result, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
