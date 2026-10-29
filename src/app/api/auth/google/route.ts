import { getSupabaseServerClient } from "@/lib/supabase-server";
import { errorResponse,HttpError,privateJson,requireSameOrigin } from "@/lib/server/http";

export async function POST(request:Request) {
 try {
  requireSameOrigin(request);
  if(process.env.GOOGLE_AUTH_ENABLED!=='true') throw new HttpError(503,'OAUTH_UNAVAILABLE','Google sign-in has not been enabled for this workspace.');
  const client=await getSupabaseServerClient();
  const {data,error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:new URL("/auth/callback",process.env.APP_ORIGIN).href,skipBrowserRedirect:true}});
  if(error || !data.url) throw new HttpError(503,"OAUTH_UNAVAILABLE","Google sign-in is temporarily unavailable.");
  return privateJson({data:{url:data.url},meta:{requestId:crypto.randomUUID()}});
 } catch(error) { return errorResponse(error); }
}
