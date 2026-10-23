import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { errorResponse, HttpError, privateJson, requireSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const client = await getSupabaseServerClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new HttpError(503, "SIGNOUT_FAILED", "Sign-out could not be completed. Try again.");
    (await cookies()).delete("nexusmd_session");
    return privateJson({ data: { signedOut: true }, meta: { requestId: crypto.randomUUID() } });
  } catch (error) { return errorResponse(error); }
}
