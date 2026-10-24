import { getSupabaseServerClient } from "@/lib/supabase-server";
import { completeCallback, validateCallback } from "@/lib/server/auth/callback";
import { errorResponse } from "@/lib/server/http";

export async function GET(request:Request) {
  try {
    const input=validateCallback(request);
    const target=await completeCallback(await getSupabaseServerClient(),input.code,input.next);
    return new Response(null,{status:303,headers:{Location:new URL(target,process.env.APP_ORIGIN).href,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","Vary":"Cookie"}});
  } catch(error) {
    const response=errorResponse(error);response.headers.set("Referrer-Policy","no-referrer");return response;
  }
}
