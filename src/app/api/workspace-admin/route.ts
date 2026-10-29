import {getSupabaseServerClient} from '@/lib/supabase-server';
import {administrationView,administrationMutate} from '@/lib/server/administration/service';
import {privateJson,errorResponse,readJson,requireSameOrigin} from '@/lib/server/http';
export async function GET(request:Request){try{return privateJson({data:await administrationView(await getSupabaseServerClient(),new URL(request.url).searchParams.get('workspace')??'')});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson({data:await administrationMutate(await getSupabaseServerClient(),request.headers.get('idempotency-key')??'',await readJson(request,2048))});}catch(e){return errorResponse(e);}}
