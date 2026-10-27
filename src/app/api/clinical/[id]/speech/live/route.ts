import {upgradeWebSocket} from '@vercel/functions';
import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {speechAvailability,speechContext} from '@/lib/server/speech/service';
import {relaySpeech} from '@/lib/server/speech/stream';
import {errorResponse,HttpError,requireSameOrigin} from '@/lib/server/http';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=240;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);
  if(process.env.SPEECH_STREAMING_ENABLED!=='true'||request.headers.get('upgrade')?.toLowerCase()!=='websocket')throw new HttpError(503,'LIVE_SPEECH_UNAVAILABLE','Live capture is unavailable.');
  const client=await getSupabaseServerClient(),cid=(await params).id,admin=getSupabaseAdminClient();
  if(new URL(request.url).searchParams.get('probe')==='1'){
   await speechContext(client,cid);
   return upgradeWebSocket(socket=>{socket.send(JSON.stringify({type:'transport_ready',providerCalls:0}));socket.close(1000,'Transport probe complete');},{maxPayload:1024});
  }
  const availability=await speechAvailability(client,()=>admin,cid);
  const capability=await client.rpc('speech_stream_capability');
  if(!availability.available||availability.mode!=='live'||capability.error||capability.data!==1)throw new HttpError(503,'LIVE_SPEECH_UNAVAILABLE','No scoped live speech allowance is available.');
  const q=new URL(request.url).searchParams,key=q.get('operation')??'',segmentId=q.get('segment')??'';
  const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  const sequence=Number(q.get('sequence')),revision=Number(q.get('revision'));
  if(!uuid.test(key)||!uuid.test(segmentId)||!q.has('sequence')||!q.has('revision')||!Number.isSafeInteger(sequence)||sequence<0||sequence>999||!Number.isSafeInteger(revision)||revision<0)throw new HttpError(400,'INVALID_COMMAND','Saved transcript position is required.');
  return upgradeWebSocket(socket=>relaySpeech(socket,client,admin,{cid,key,segmentId,sequence,revision,capMs:Math.floor(availability.maxClipMs!),ref:process.env.LIVE_SPEECH_AUTHORIZATION_REF!}),{maxPayload:32768});
 }catch(e){return errorResponse(e);}
}
