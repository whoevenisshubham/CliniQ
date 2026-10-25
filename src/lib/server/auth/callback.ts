import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePrincipal } from "./context";
import { getRoleDashboardPath } from "@/lib/auth";
import { HttpError } from "../http";

const returns = new Set(["/patient","/patient/reports","/doctor","/receptionist","/admin"]);
export function completedSessionPath(home:string,next:string|null){return next&&returns.has(next)&&(next===home||next.startsWith(home+'/'))?next:home;}
export function validateCallback(request: Request) {
  const url = new URL(request.url);
  if (!process.env.APP_ORIGIN || url.origin!==process.env.APP_ORIGIN) throw new HttpError(403,"CALLBACK_ORIGIN_DENIED","Invalid callback origin.");
  const next=url.searchParams.get("next");
  if (url.searchParams.getAll("next").length>1 || (next!==null && !returns.has(next))) throw new HttpError(400,"INVALID_RETURN_PATH","Invalid return path.");
  const codes=url.searchParams.getAll("code");
  if(codes.length!==1 || !codes[0] || codes[0].length>2048 || url.searchParams.has("error")) throw new HttpError(400,"INVALID_CALLBACK","Sign-in could not be completed. Start again.");
  return { code:codes[0],next };
}

export async function completeCallback(client: SupabaseClient, code:string, next:string|null) {
  const {error}=await client.auth.exchangeCodeForSession(code);
  if(error) throw new HttpError(400,"INVALID_CALLBACK","Sign-in could not be completed. Start again.");
  try {
    const {error:bootstrapError}=await client.rpc("bootstrap_patient");
    if(bootstrapError) throw new HttpError(403,"ACCOUNT_UNAVAILABLE","Account linking requires attention. Contact the workspace owner.");
    const principal=await resolvePrincipal(client);
    const home=getRoleDashboardPath(principal.role);
    return completedSessionPath(home,next);
  } catch(error) { await client.auth.signOut({scope:"local"}); throw error; }
}
