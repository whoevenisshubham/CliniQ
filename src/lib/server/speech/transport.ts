import {MEDICAL_KEYWORDS} from '@/lib/clinical/medical-hints';
export const retainedSpeech={provider:'deepgram',model:'nova-2',language:'hi'} as const;
export type SpeechReply={text:string;final:boolean;providerRequestId?:string};
export class SpeechOutputError extends Error{}
export type SpeechTransport={mode:'disabled'|'offline_fixture';authorizationRef:string;transcribe:(audio:Uint8Array,signal:AbortSignal)=>Promise<SpeechReply>};
export function speechTransport():SpeechTransport{return{mode:'disabled',authorizationRef:'',transcribe:async()=>{throw new Error('LIVE_SPEECH_NOT_AUTHORIZED');}};}
// Complete retained-provider request/response adapter, with an injected offline
// transmitter only. There is deliberately no global fetch or environment-key
// enablement path until a separate account/audio allowance is accepted.
export function offlineDeepgramTransport(authorizationRef:string,transmit:(request:{url:string;headers:Record<string,string>;audio:Uint8Array;signal:AbortSignal})=>Promise<unknown>):SpeechTransport{
 return{mode:'offline_fixture',authorizationRef,transcribe:async(audio,signal)=>{
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
