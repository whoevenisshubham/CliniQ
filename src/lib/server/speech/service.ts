import 'server-only';
import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {resolvePrincipal} from '../auth/context';
import {HttpError} from '../http';
import {id} from '../documents/service';
import {validateWav} from '@/lib/clinical/audio';
import {speechTransport,SpeechOutputError} from './transport';
function check(error:{code:string;message:string}|null){if(!error)return;const codes:Record<string,number>={AUTH_REQUIRED:401,NOT_FOUND:404,SYNTHETIC_ONLY:403,IDEMPOTENCY_CONFLICT:409,REVISION_CONFLICT:409,OPERATION_LIMIT:429,INVALID_AUDIO:422,RESULT_UNAVAILABLE:409};throw new HttpError(codes[error.message]??(['23514','22P02','23505'].includes(error.code)?422:503),codes[error.message]?error.message:'SPEECH_UNAVAILABLE','Speech processing is unavailable or conflicts with the saved encounter. Your existing record is unchanged.');}
export async function speechContext(client:SupabaseClient,cid:string){const p=await resolvePrincipal(client);id(cid);if(p.role!=='doctor')throw new HttpError(403,'PROVIDER_REQUIRED','A treating clinician is required.');const c=await client.from('consultations').select('id,status,revision').eq('id',cid).maybeSingle();check(c.error);if(!c.data)throw new HttpError(404,'NOT_FOUND','Consultation unavailable.');return c.data;}
export async function speechView(client:SupabaseClient,cid:string,key:string){await speechContext(client,cid);id(key);const r=await client.from('speech_operations').select('id,status,response,error_code,segment_id,mode,created_at').eq('consultation_id',cid).eq('operation_key',key).maybeSingle();check(r.error);if(!r.data)throw new HttpError(404,'NOT_FOUND','Speech operation unavailable.');return r.data;}
export async function readAudio(request:Request){if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='audio/wav')throw new HttpError(415,'WAV_REQUIRED','Send a bounded PCM WAV clip.');const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'AUDIO_REQUIRED','An audio clip is required.');let size=0;const parts:Uint8Array[]=[];const deadline=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]);const aborted=new Promise<never>((_,reject)=>{const fail=()=>reject(new HttpError(408,'AUDIO_UPLOAD_TIMEOUT','Audio upload stopped before admission.'));if(deadline.aborted)fail();else deadline.addEventListener('abort',fail,{once:true});});try{while(true){const r=await Promise.race([reader.read(),aborted]);if(r.done)break;size+=r.value.byteLength;if(size>1048576){await reader.cancel();throw new HttpError(413,'AUDIO_SIZE_LIMIT','Audio clip exceeds the bounded size.');}parts.push(r.value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;}
export async function transcribeClip(client:SupabaseClient,admin:SupabaseClient,input:{cid:string;key:string;segmentId:string;sequence:number;expectedRevision:number;bytes:Uint8Array;signal:AbortSignal}){
 await speechContext(client,input.cid);id(input.key);id(input.segmentId);
 if(!Number.isInteger(input.sequence)||input.sequence<0||input.sequence>999||!Number.isInteger(input.expectedRevision)||input.expectedRevision<0)throw new HttpError(400,'INVALID_COMMAND','Check the saved transcript position.');
 let wav;try{wav=validateWav(input.bytes);}catch{throw new HttpError(422,'INVALID_AUDIO','Only a complete16kHz mono PCM WAV clip up to30 seconds is supported.');}
 const sha=createHash('sha256').update(input.bytes).digest('hex'),duration=Math.ceil(wav.durationMs);
 const admission=await client.rpc('speech_admit',{k:input.key,cid:input.cid,sid:input.segmentId,seq:input.sequence,expected:input.expectedRevision,sha,duration,bytes:input.bytes.length});check(admission.error);const oid=admission.data as string;
 const view=()=>speechView(client,input.cid,input.key);
 const op=await view();if(op.status==='saved')return op.response;if(op.status==='responded'){const r=await client.rpc('speech_commit',{oid});check(r.error);return r.data;}if(op.status!=='admitted')return{state:op.status,operationId:oid};
 const transport=speechTransport();const result=async(state:string,text?:string,requestId?:string)=>{const r=await admin.rpc('speech_result',{oid,next_state:state,transcript:text??null,request_id:requestId??null});check(r.error);return r.data as boolean;};
 if(transport.mode==='disabled'){await result('unavailable');return{state:'unavailable',operationId:oid};}
 if(input.signal.aborted){await result('cancelled');return{state:'cancelled',operationId:oid};}
 const reservation=await admin.rpc('speech_reserve',{oid,budget_ref:transport.authorizationRef,sha,duration});check(reservation.error);if(!reservation.data){const current=await view();return current.status==='saved'?current.response:{state:current.status,operationId:oid};}
 const signal=AbortSignal.any([input.signal,AbortSignal.timeout(45000)]);let reply;
 try{reply=await Promise.race([transport.transcribe(input.bytes,signal),new Promise<never>((_,reject)=>{if(signal.aborted)reject(new Error('CANCELLED'));else signal.addEventListener('abort',()=>reject(new Error('SPEECH_OUTCOME_UNKNOWN')),{once:true});})]);}
 catch(e){const state=e instanceof SpeechOutputError?'rejected':'outcome_unknown';if(!await result(state)){const current=await view();return{state:current.status,operationId:oid};}return{state,operationId:oid};}
 if(!reply.final||typeof reply.text!=='string'||!reply.text.trim()||reply.text.length>8000){await result('rejected');return{state:'rejected',operationId:oid};}
 if(signal.aborted){await result('outcome_unknown');return{state:'outcome_unknown',operationId:oid};}
 if(!await result('responded',reply.text,reply.providerRequestId)){const current=await view();return{state:current.status,operationId:oid};}
 const committed=await client.rpc('speech_commit',{oid});check(committed.error);return committed.data;
}
