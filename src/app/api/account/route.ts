import {getSupabaseServerClient} from '@/lib/supabase-server';
import {accountView,accountMutate} from '@/lib/server/account/service';
import {errorResponse,privateJson,readJson,requireSameOrigin} from '@/lib/server/http';
export async function GET(){try{return privateJson({data:await accountView(await getSupabaseServerClient())});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson({data:await accountMutate(await getSupabaseServerClient(),request.headers.get('idempotency-key')??'',await readJson(request,16384))});}catch(e){return errorResponse(e);}}
