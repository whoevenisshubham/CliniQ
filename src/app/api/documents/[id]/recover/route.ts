import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {resolvePrincipal} from '@/lib/server/auth/context';
import {id,documentDetail} from '@/lib/server/documents/service';
import {executeWork} from '@/lib/server/jobs/execution';
import {privateJson,errorResponse,HttpError,requireSameOrigin} from '@/lib/server/http';
export const runtime='nodejs';export const maxDuration=120;
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{requireSameOrigin(request);const client=await getSupabaseServerClient(),actor=await resolvePrincipal(client),did=id((await context.params).id);if(actor.role!=='patient')throw new HttpError(403,'OWNER_REQUIRED','The patient owner can recover document processing.');await documentDetail(client,did);const result=await executeWork(getSupabaseAdminClient(),{documentId:did});return privateJson({data:{status:result.status}});}catch(e){return errorResponse(e);}}
