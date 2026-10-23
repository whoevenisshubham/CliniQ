import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { errorResponse, privateJson } from "@/lib/server/http";
import { dbError } from "@/lib/server/documents/service";
export async function GET() {
  try {
    const client = await getSupabaseServerClient();
    await resolvePrincipal(client);
    const r = await client.rpc("document_share_candidates");
    dbError(r.error);
    return privateJson({ providers: r.data });
  } catch (e) {
    return errorResponse(e);
  }
}
