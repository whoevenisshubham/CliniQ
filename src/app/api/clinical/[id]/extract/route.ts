import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {speechContext} from '@/lib/server/speech/service';
import {createThread,admitAI} from '@/lib/server/ai/service';
import {runAIJob} from '@/lib/server/ai/runner';
import {providerConfiguration} from '@/lib/server/ai/provider';
import {errorResponse,privateJson,requireSameOrigin,readJson,HttpError} from '@/lib/server/http';
import {id} from '@/lib/server/documents/service';
export const runtime='nodejs';export const maxDuration=120;
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
 const client=await getSupabaseServerClient(),visit=await speechContext(client,(await params).id),config=providerConfiguration();let available=false;
 if(config.enabled){const r=await getSupabaseAdminClient().from('provider_budgets').select('requests,max_requests,input_tokens,max_input,output_tokens,max_output').eq('authorization_ref',config.authorizationRef).eq('mode','live').eq('kind','extract_emr').eq('model',config.model).eq('enabled',true).contains('allowed_actors',[visit.actorId]).gt('ends_at',new Date().toISOString()).maybeSingle();const b=r.data;available=!r.error&&!!b&&b.requests<b.max_requests&&b.input_tokens<b.max_input&&b.max_output-b.output_tokens>=3000;}
 return privateJson({data:{available}});
 }catch(e){return errorResponse(e);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);const client=await getSupabaseServerClient(),cid=(await params).id,visit=await speechContext(client,cid);
  if(!providerConfiguration().enabled)throw new HttpError(503,'AI_UNAVAILABLE','EMR generation is disabled. Saved speech is retained.');
  const b=await readJson(request,1024) as Record<string,unknown>;
  if(!b||Object.keys(b).sort().join()!=='expectedRevision,requestKey,threadKey'||!Number.isSafeInteger(b.expectedRevision))throw new HttpError(400,'INVALID_COMMAND','Saved revision and operation keys are required.');
  if(visit.revision!==b.expectedRevision)throw new HttpError(409,'REVISION_CONFLICT','Save or reload the current draft before extraction.');
  const tid=await createThread(client,id(b.threadKey),cid);
  const jid=await admitAI(client,id(b.requestKey),tid,{kind:'extract_emr',question:'Prepare source-bound EMR changes from the saved final transcript, preserving spoken corrections, explicit negatives and unknowns.',documentIds:[]});
  const outcome=await runAIJob(getSupabaseAdminClient(),jid);
  return privateJson({data:{jobId:jid,status:outcome.status}});
 }catch(e){return errorResponse(e);}
}
