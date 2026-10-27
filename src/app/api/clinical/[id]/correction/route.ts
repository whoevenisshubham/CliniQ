import {getSupabaseServerClient} from '@/lib/supabase-server';
import {speechContext} from '@/lib/server/speech/service';
import {id} from '@/lib/server/documents/service';
import {privateJson,errorResponse,requireSameOrigin,readJson,HttpError} from '@/lib/server/http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{requireSameOrigin(request);const client=await getSupabaseServerClient(),cid=(await params).id;await speechContext(client,cid);
 const b=await readJson(request,30000)as Record<string,unknown>;
 if(!b||Object.keys(b).sort().join()!=='action,expectedRevision,sourceId,text'||b.action!=='correction'||typeof b.text!=='string'||!b.text.trim()||b.text.length>8000||!Number.isSafeInteger(b.expectedRevision))throw new HttpError(400,'INVALID_COMMAND','Provide a reviewed source correction and saved revision.');
 const r=await client.rpc('clinical_correct_source',{k:id(request.headers.get('idempotency-key')),cid,source_id:id(b.sourceId),corrected_text:b.text,expected:b.expectedRevision});
 if(r.error){const code=r.error.message,status=code==='NOT_FOUND'?404:['REVISION_CONFLICT','IDEMPOTENCY_CONFLICT'].includes(code)?409:code==='INVALID_SOURCE'?400:503;throw new HttpError(status,status===503?'CORRECTION_UNAVAILABLE':code,'Correction was not confirmed. The raw source is retained.');}
 return privateJson({data:r.data});
 }catch(e){return errorResponse(e);}
}
