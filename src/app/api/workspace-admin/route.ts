import {getSupabaseServerClient} from '@/lib/supabase-server';
import {administrationView,administrationMutate,administrationOperation,administrationWorkerStatus} from '@/lib/server/administration/service';
import {privateJson,errorResponse,readJson,requireSameOrigin} from '@/lib/server/http';
export async function GET(request:Request){try{const u=new URL(request.url),c=await getSupabaseServerClient(),w=u.searchParams.get('workspace')??'';return privateJson({data:u.searchParams.has('operation')?await administrationOperation(c,w,u.searchParams.get('operation')??''):u.searchParams.get('worker')==='1'?await administrationWorkerStatus(c,w):await administrationView(c,w)});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson({data:await administrationMutate(await getSupabaseServerClient(),request.headers.get('idempotency-key')??'',await readJson(request,2048))});}catch(e){return errorResponse(e);}}
