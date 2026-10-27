import {getSupabaseServerClient} from '@/lib/supabase-server';
import {resolvePrincipal} from '@/lib/server/auth/context';
import {id} from '@/lib/server/documents/service';
import {requireSameOrigin,readJson,privateJson,errorResponse,HttpError} from '@/lib/server/http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{requireSameOrigin(request);const client=await getSupabaseServerClient();await resolvePrincipal(client);const b=await readJson(request,1024)as Record<string,unknown>;
 if(!b||Object.keys(b).join()!=='expectedRevision'||!Number.isSafeInteger(b.expectedRevision))throw new HttpError(400,'INVALID_COMMAND','Saved revision required.');
 const r=await client.rpc('clinical_rebase_proposal',{k:id(request.headers.get('idempotency-key')),pid:id((await params).id),expected:b.expectedRevision});
 if(r.error)throw new HttpError(r.error.message==='NOT_FOUND'?404:409,r.error.message==='NOT_FOUND'?'NOT_FOUND':'STALE_PROPOSAL','The suggestion cannot be rebased over newer speech or an unavailable record.');return privateJson({data:r.data});
 }catch(e){return errorResponse(e);}
}
