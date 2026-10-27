import 'server-only';
import WebSocket from 'ws';
import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {SpeechStreamText} from '@/lib/clinical/speech-stream';
import {MEDICAL_KEYWORDS} from '@/lib/clinical/medical-hints';
import {speechConfiguration} from './transport';
import {incrementalExtraction} from './incremental';
import {closeConsultationDemo} from './demo';

// All upstream bytes and credentials remain in this authenticated function instance.
// Reconnects create no implicit reservation and never resume/replay audio.
export async function relaySpeech(socket:WebSocket,client:SupabaseClient,admin:SupabaseClient,command:{cid:string;key:string;segmentId:string;sequence:number;revision:number;capMs:number;ref:string}){
 const text=new SpeechStreamText(),hash=createHash('sha256');let upstream:WebSocket|undefined,oid:string|undefined,total=0,ended=false,finishing=false,requestId:string|undefined,revision=command.revision,checkpointEnabled=false;
 let checkpointQueue=Promise.resolve();
 const checkpointed=new Set<string>();
 let timer:ReturnType<typeof setTimeout>|undefined,accessTimer:ReturnType<typeof setInterval>|undefined,drain:ReturnType<typeof setTimeout>|undefined;
 const send=(v:unknown)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(v));};
 const clear=()=>{if(timer)clearTimeout(timer);if(accessTimer)clearInterval(accessTimer);if(drain)clearTimeout(drain);};
 const extraction=incrementalExtraction(client,admin,command.cid,event=>{send(event);const e=event as{type?:string;state?:string};if(e.type==='emr_status'&&!['preparing','waiting_for_allowed_time'].includes(e.state??''))void closeConsultationDemo(admin,command.cid,command.ref).then(confirmed=>{if(confirmed!==null)send({type:'demo_closed',confirmed});});});
 const fail=async(code:string)=>{if(ended)return;ended=true;extraction.stop();clear();upstream?.terminate();if(oid){try{await admin.rpc('speech_result',{oid,next_state:'outcome_unknown',transcript:null,request_id:requestId??null});}catch{}}const closed=await closeConsultationDemo(admin,command.cid,command.ref);if(closed!==null)send({type:'demo_closed',confirmed:closed});send({type:'error',code});socket.close(1011,'Speech stopped; no automatic resend');};
 socket.on('error',()=>{void fail('CONNECTION_LOST');});
 socket.on('close',()=>{if(!ended)void fail('CLIENT_DISCONNECTED');});
 // Installed before any DB await: early audio cannot disappear or queue unboundedly.
 socket.on('message',(data,isBinary)=>{
  if(ended)return;
  if(!isBinary){
   if(data.toString()!==JSON.stringify({type:'finish'})){void fail('INVALID_STREAM_COMMAND');return;}
   finish();return;
  }
  const bytes=Array.isArray(data)?Buffer.concat(data):Buffer.from(data as Buffer);
  if(finishing||!upstream||upstream.readyState!==WebSocket.OPEN||bytes.length===0||bytes.length%2||bytes.length>32768||total+bytes.length>command.capMs*32||upstream.bufferedAmount>262144){void fail('AUDIO_STREAM_LIMIT');return;}
  total+=bytes.length;hash.update(bytes);upstream.send(bytes,{binary:true});
 });
 const finish=()=>{
  if(ended||finishing)return;finishing=true;
  if(timer)clearTimeout(timer);
  if(!upstream||upstream.readyState!==WebSocket.OPEN){void fail('STREAM_NOT_READY');return;}
  upstream.send(JSON.stringify({type:'CloseStream'}));
  drain=setTimeout(()=>{void fail('FINAL_RESULT_TIMEOUT');},10000);
 };
 try{
  const configuration=speechConfiguration();if(!configuration||!process.env.DEEPGRAM_API_KEY)throw Error('SPEECH_DISABLED');
  const sha=createHash('sha256').update('stream:'+command.key).digest('hex');
  const admitted=await client.rpc('speech_admit',{k:command.key,cid:command.cid,sid:command.segmentId,seq:command.sequence,expected:command.revision,sha,duration:command.capMs,bytes:command.capMs*32+44});
  if(admitted.error||typeof admitted.data!=='string')throw Error('ADMISSION_FAILED');oid=admitted.data;
  const binding=await admin.rpc('speech_bind_target',{oid,budget_ref:command.ref});if(binding.error||binding.data!==true)throw Error('BINDING_FAILED');
  const reserved=await admin.rpc('speech_reserve',{oid,budget_ref:command.ref,sha,duration:command.capMs,execution_mode:'live'});if(reserved.error||reserved.data!==true)throw Error('ALLOWANCE_UNAVAILABLE');
  const marked=await admin.rpc('speech_stream_mark',{oid});if(marked.error||marked.data!==true)throw Error('STREAM_RECEIPT_UNAVAILABLE');
  const checkpointCapability=await client.rpc('speech_checkpoint_capability');checkpointEnabled=!checkpointCapability.error&&checkpointCapability.data===1;
  if(ended||socket.readyState!==WebSocket.OPEN)throw Error('CLIENT_DISCONNECTED');
  const url=new URL('wss://api.deepgram.com/v1/listen');for(const [k,v]of Object.entries({model:configuration.model,language:configuration.language,encoding:'linear16',sample_rate:'16000',channels:'1',interim_results:'true',smart_format:'true',punctuate:'true',endpointing:'300'}))url.searchParams.set(k,v);
  for(const hint of MEDICAL_KEYWORDS.slice(0,100))url.searchParams.append('keyterm',hint);
  upstream=new WebSocket(url,{headers:{Authorization:'Token '+process.env.DEEPGRAM_API_KEY},maxPayload:131072,perMessageDeflate:false,handshakeTimeout:10000});
  upstream.on('open',()=>{if(ended){upstream?.terminate();return;}send({type:'ready',operationId:oid,capMs:command.capMs});timer=setTimeout(()=>{send({type:'stop_capture'});finish();},command.capMs);});
  upstream.on('message',data=>{
   if(ended)return;
   try{
    if((Array.isArray(data)?Buffer.concat(data):Buffer.from(data as Buffer)).byteLength>131072)throw Error();
    const raw=JSON.parse(data.toString());
    if(raw.type==='Error')throw Error();
    if(typeof raw.metadata?.request_id==='string')requestId=raw.metadata.request_id.slice(0,200);
    if(typeof raw.request_id==='string')requestId=raw.request_id.slice(0,200);
    const event=text.accept(raw);if(event)send(event);
    if(checkpointEnabled&&event?.type==='final'){
     const span=Math.round(raw.start*1000),transcript=raw.channel.alternatives[0].transcript.trim();
     checkpointQueue=checkpointQueue.then(async()=>{
      if(ended)return;
      const staged=await admin.rpc('speech_stream_stage',{oid,span_ms:span,transcript,raw});
      if(staged.error||staged.data!==true)throw Error('FINAL_STAGE_FAILED');
      const saved=await client.rpc('speech_stream_checkpoint',{oid,span_ms:span});
      if(saved.error||!Number.isInteger(saved.data?.revision))throw Error('CHECKPOINT_NOT_SAVED');
      revision=saved.data.revision;send({type:'checkpoint',...saved.data});if(!checkpointed.has(saved.data.id)){checkpointed.add(saved.data.id);extraction.notify(Date.now(),transcript.length);}
     }).catch(()=>fail('CHECKPOINT_NOT_SAVED'));
    }
   }catch{void fail('INVALID_PROVIDER_STREAM');}
  });
  upstream.on('error',()=>{void fail('PROVIDER_STREAM_FAILED');});
  upstream.on('close',()=>{void (async()=>{
   if(ended)return;
   if(!finishing||!total||!text.text){await fail('INCOMPLETE_PROVIDER_STREAM');return;}
   clear();
   await checkpointQueue;if(ended)return;
   const auth=await client.auth.getUser();if(auth.error||!auth.data.user){await fail('AUTH_REQUIRED');return;}
   const receipt=await admin.rpc('speech_stream_receipt',{oid,sha:hash.digest('hex'),pcm_bytes:total,transcript:text.text,request_id:requestId??null,raw:{transport:'streaming',finalResults:text.rawFinals,pcmBytes:total}});
   if(receipt.error||receipt.data!==true){await fail('RECEIPT_NOT_SAVED');return;}
   const saved=await client.rpc('speech_commit',{oid});if(saved.error||saved.data?.state!=='saved'){await fail('TRANSCRIPT_NOT_COMMITTED');return;}
   send({type:'transcript_saved',...saved.data,audioMs:total/32});await extraction.finish();
   if(ended)return;const closed=await closeConsultationDemo(admin,command.cid,command.ref);if(closed!==null)send({type:'demo_closed',confirmed:closed});ended=true;send({type:'saved',...saved.data,audioMs:total/32});socket.close(1000,'Transcript saved');
  })().catch(()=>fail('SAVE_OUTCOME_UNKNOWN'));});
  let checking=false;
  accessTimer=setInterval(()=>{if(checking||ended)return;checking=true;void checkpointQueue.then(()=>client.from('consultations').select('id,revision,status').eq('id',command.cid).maybeSingle()).then(r=>{if(r.error||!r.data)void fail('ACCESS_CHANGED');else if(r.data.status!=='active'||r.data.revision!==revision)void fail('REVISION_CHANGED');}).finally(()=>{checking=false;});},5000);
 }catch(e){await fail(e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'STREAM_UNAVAILABLE');}
}
