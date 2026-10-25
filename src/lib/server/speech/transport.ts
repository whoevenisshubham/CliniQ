import {MEDICAL_KEYWORDS} from '@/lib/clinical/medical-hints';
export const retainedSpeech={provider:'deepgram',model:'nova-2',language:'hi'} as const;
export type SpeechReply={text:string;final:boolean;providerRequestId?:string};
export class SpeechOutputError extends Error{}
export class SpeechUnavailableError extends Error{}
export type SpeechTransport={mode:'disabled'|'offline_fixture'|'live';authorizationRef:string;transcribe:(audio:Uint8Array,signal:AbortSignal)=>Promise<SpeechReply>};
type Transmission={url:string;headers:Record<string,string>;audio:Uint8Array;signal:AbortSignal};
export function speechTransport():SpeechTransport{
 const disabled:SpeechTransport={mode:'disabled',authorizationRef:'',transcribe:async()=>{throw new Error('LIVE_SPEECH_NOT_AUTHORIZED');}};
 const key=process.env.DEEPGRAM_API_KEY,ref=process.env.LIVE_SPEECH_AUTHORIZATION_REF;
 if(process.env.SPEECH_ENABLED!=='true'||process.env.SPEECH_PROVIDER_VERIFIED!=='true'||!key||!ref||(process.env.AI_SPEECH_MODEL&&process.env.AI_SPEECH_MODEL!==retainedSpeech.model))return disabled;
 return deepgramTransport('live',ref,async request=>{
  if(request.signal.aborted)throw Error('SPEECH_CANCELLED');
  const r=await fetch(request.url,{method:'POST',headers:{...request.headers,authorization:'Token '+key},body:new Uint8Array(request.audio).buffer,signal:request.signal,redirect:'error'});
  if(r.status===401||r.status===403||r.status===429)throw new SpeechUnavailableError('SPEECH_PROVIDER_UNAVAILABLE');
  if(!r.ok)throw Error('SPEECH_OUTCOME_UNKNOWN');
  const reader=r.body?.getReader();if(!reader)throw new SpeechOutputError('INVALID_SPEECH_RESPONSE');const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>65536){await reader.cancel();throw new SpeechOutputError('SPEECH_RESPONSE_LIMIT');}chunks.push(p.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new SpeechOutputError('INVALID_SPEECH_RESPONSE');}
 });
}
// Shared retained-provider request/response contract. The offline constructor
// injects a transmitter; only the guarded server factory above owns credentials.
export function offlineDeepgramTransport(authorizationRef:string,transmit:(request:{url:string;headers:Record<string,string>;audio:Uint8Array;signal:AbortSignal})=>Promise<unknown>):SpeechTransport{
 return deepgramTransport('offline_fixture',authorizationRef,transmit);
}
export function deepgramTransport(mode:'offline_fixture'|'live',authorizationRef:string,transmit:(request:Transmission)=>Promise<unknown>):SpeechTransport{
 return{mode,authorizationRef,transcribe:async(audio,signal)=>{
 if(signal.aborted)throw Error('SPEECH_CANCELLED');
 const url=new URL('https://api.deepgram.com/v1/listen');url.searchParams.set('model',retainedSpeech.model);url.searchParams.set('language',retainedSpeech.language);url.searchParams.set('smart_format','true');
 for(const hint of MEDICAL_KEYWORDS.slice(0,100))url.searchParams.append('keywords',hint+':5');
 const raw=await transmit({url:url.toString(),headers:{'content-type':'audio/wav'},audio,signal});
 if(!raw||typeof raw!=='object')throw new SpeechOutputError('INVALID_SPEECH_RESPONSE');
 const r=raw as {is_final?:unknown;results?:{channels?:{alternatives?:{transcript?:unknown}[]}[]};metadata?:{request_id?:unknown}};
 const text=r.results?.channels?.[0]?.alternatives?.[0]?.transcript;
 if(r.is_final===false||typeof text!=='string'||!text.trim()||text.length>8000)throw new SpeechOutputError('INVALID_FINAL_TRANSCRIPT');
 return{text:text.trim(),final:true,providerRequestId:typeof r.metadata?.request_id==='string'?r.metadata.request_id.slice(0,200):undefined};
 }};
}
