import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {speechContext,speechView,readAudio,transcribeClip,recoverSpeech,speechAvailability} from '@/lib/server/speech/service';
import {errorResponse,HttpError,privateJson,requireSameOrigin,readJson} from '@/lib/server/http';
export const runtime='nodejs';export const maxDuration=120;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const cid=(await params).id,client=await getSupabaseServerClient();const key=new URL(request.url).searchParams.get('operation');return privateJson({data:key?await speechView(client,cid,key):await speechAvailability(client,getSupabaseAdminClient,cid)});}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{requireSameOrigin(request);const cid=(await params).id,client=await getSupabaseServerClient();await speechContext(client,cid);
 if(request.headers.get('content-type')?.split(';')[0].trim()==='application/json'){
  const body=await readJson(request,1024);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join()!=='action,operationKey'||(body as{action?:unknown}).action!=='save_retained'||typeof(body as{operationKey?:unknown}).operationKey!=='string')throw new HttpError(400,'INVALID_COMMAND','A retained speech operation is required.');
  const data=await recoverSpeech(client,cid,(body as{operationKey:string}).operationKey);return privateJson({data},data.state==='saved'?200:202);
 }
 const integer=(name:string)=>{const v=request.headers.get(name);if(!v||!/^\d{1,6}$/.test(v))throw new HttpError(400,'INVALID_COMMAND','A saved revision and segment position are required.');return Number(v);};const sequence=integer('x-sequence'),expectedRevision=integer('x-expected-revision');const data=await transcribeClip(client,getSupabaseAdminClient(),{cid,key:request.headers.get('idempotency-key')??'',segmentId:request.headers.get('x-segment-id')??'',sequence,expectedRevision,bytes:await readAudio(request),signal:request.signal});return privateJson({data},data.state==='saved'?200:202);}catch(e){return errorResponse(e);}}

