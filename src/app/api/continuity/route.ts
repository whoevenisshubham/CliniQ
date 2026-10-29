import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {continuityView,continuityMutate} from '@/lib/server/continuity/service';
import {errorResponse,privateJson,readJson,requireSameOrigin} from '@/lib/server/http';
export async function GET(request:Request){try{return privateJson({data:await continuityView(await getSupabaseServerClient(),new URL(request.url).searchParams.get('encounter'))});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);const data=await continuityMutate(await getSupabaseServerClient(),request.headers.get('idempotency-key')??'',await readJson(request,8192));let processing='pending';try{const r=await getSupabaseAdminClient().rpc('continuity_reconcile');if(!r.error)processing='reconciled';}catch{/* The committed preference remains saved; scheduled recovery can materialize tasks. */}return privateJson({data:{...data,processing}});}catch(e){return errorResponse(e);}}
