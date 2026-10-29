import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { readPrivateContent } from "@/lib/server/documents/content";
import { errorResponse } from "@/lib/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const client = await getSupabaseServerClient();
    await resolvePrincipal(client);
    return await readPrivateContent(client,getSupabaseAdminClient,(await context.params).id,new URL(_request.url).searchParams.get("version")??undefined);
  } catch(error) { return errorResponse(error); }
}
