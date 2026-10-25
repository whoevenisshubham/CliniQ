"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {captureClip} from '@/lib/clinical/capture';
import {accessDenied,readJsonResponse} from '@/lib/client/http-response';
import {speechResponse} from '@/lib/client/workspace-response';
import {speechPhase} from '@/lib/client/speech-state';

type Pending={key:string;segmentId:string;revision:number;sequence:number;generation:number};
export function SpeechCapture({consultationId,revision,sequence,disabled,fixture,onBusy,onSaved,onAccessLost}:{consultationId:string;revision:number;sequence:number;disabled:boolean;fixture:boolean;onBusy:(busy:boolean)=>void;onSaved:()=>void;onAccessLost:(e:unknown)=>void}){
 const [available,setAvailable]=useState(false),[state,setState]=useState('Speech unavailable'),[active,setActive]=useState(false),[retained,setRetained]=useState(false);
 const [maxClipMs,setMaxClipMs]=useState(15000);
 const controller=useRef<AbortController|null>(null),pending=useRef<Pending|null>(null),live=useRef(true),generation=useRef(0),locked=useRef(false);
 const callbacks=useRef({onAccessLost});callbacks.current={onAccessLost};
 const invalidate=useCallback(()=>{++generation.current;controller.current?.abort();pending.current=null;},[]);
 const path='/api/clinical/'+consultationId+'/speech';
 const current=(n:number)=>live.current&&generation.current===n;
 const finish=(n:number)=>{if(current(n)){setActive(false);onBusy(false);}locked.current=false;};
 const fail=(e:unknown,n:number)=>{if(!current(n))return;if(accessDenied(e)){controller.current?.abort();setAvailable(false);pending.current=null;setRetained(false);onAccessLost(e);}else setState('Speech result is unconfirmed. Check the saved operation before continuing.');};
 useEffect(()=>{
  live.current=true;const n=generation.current,abort=new AbortController();
  if(!fixture)void fetch(path,{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30000)])})
   .then(r=>readJsonResponse(r,b=>speechResponse(b,'availability'))).then(b=>{if(live.current&&generation.current===n){setAvailable(b.data.available===true);if(Number.isInteger(b.data.maxClipMs)&&b.data.maxClipMs>=1000&&b.data.maxClipMs<=15000)setMaxClipMs(b.data.maxClipMs);setState(b.data.available?(b.data.mode==='live'?'Speech transport configured · allowance checked before send':'Synthetic offline transport · no live speech'):'Speech unavailable · continue with typed transcript');}})
   .catch(e=>{if(live.current&&generation.current===n){if(accessDenied(e))callbacks.current.onAccessLost(e);else setState('Speech status unavailable · typed transcript remains available');}});
  return()=>{live.current=false;abort.abort();invalidate();};
 },[path,fixture,invalidate]);
 const apply=(op:Pending,status:string)=>{
  if(!current(op.generation)||pending.current!==op)return;
  const phase=speechPhase(status);setRetained(phase==='retained');
  if(phase==='saved'){pending.current=null;setState('Final transcript saved');finish(op.generation);onSaved();return;}
  if(phase==='terminal'){pending.current=null;setState('Speech operation ended: '+status+'. No new transcript was published by this attempt.');}
  else setState(phase==='retained'?'Final response retained. Complete its save without retranscribing.':phase==='pending'?'Speech operation is still pending. Check saved status.':'Speech outcome is unknown. This operation will not be sent again.');
 };
 const upload=async(op:Pending,bytes:Uint8Array,signal:AbortSignal)=>{
  try{setState('Saving final clip…');const r=await fetch(path,{method:'POST',signal:AbortSignal.any([signal,AbortSignal.timeout(90000)]),headers:{'content-type':'audio/wav','idempotency-key':op.key,'x-segment-id':op.segmentId,'x-sequence':String(op.sequence),'x-expected-revision':String(op.revision)},body:new Uint8Array(bytes).buffer});const b=await readJsonResponse(r,b=>speechResponse(b,'save'));apply(op,b.data.state);}
  catch(e){fail(e,op.generation);}finally{finish(op.generation);}
 };
 const start=async()=>{
  if(disabled||locked.current||active||!available||pending.current)return;
  const n=generation.current,c=new AbortController();controller.current=c;locked.current=true;setActive(true);setRetained(false);setState('Capturing up to '+Math.ceil(maxClipMs/1000)+' seconds…');onBusy(true);
  await captureClip({signal:c.signal,windowMs:maxClipMs,onError:code=>{if(current(n)){setState('Capture unavailable: '+code);finish(n);}},onClip:bytes=>{if(!current(n))return;const op={key:crypto.randomUUID(),segmentId:crypto.randomUUID(),revision,sequence,generation:n};pending.current=op;void upload(op,bytes,c.signal);}});
 };
 const inspect=async(save=false)=>{
  const op=pending.current;if(!op||locked.current||!current(op.generation))return;
  locked.current=true;setActive(true);onBusy(true);const c=new AbortController();controller.current=c;
  try{
   // JSON recovery has no audio and reaches no provider transport, regardless of state.
   const r=await fetch(save?path:path+'?operation='+op.key,{cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(30000)]),...(save?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'save_retained',operationKey:op.key})}:{})});
   const b=await readJsonResponse(r,b=>speechResponse(b,save?'save':'status'));apply(op,save?b.data.state:b.data.status);
  }catch(e){fail(e,op.generation);}finally{finish(op.generation);}
 };
 return <section className="speech-capture" aria-label="Speech capture"><p role="status">{state}</p><div className="clinical-inline"><button className="quiet-button" disabled={disabled||active||!available||!!pending.current} onClick={()=>void start()}>Capture {Math.ceil(maxClipMs/1000)}-second clip</button>{active&&<button className="quiet-button" onClick={()=>{controller.current?.abort();setState('Capture stopped. Check saved status if transmission had started.');if(!pending.current)finish(generation.current);}}>Stop capture</button>}{pending.current&&<button className="quiet-button" disabled={active} onClick={()=>void inspect()}>Check saved clip</button>}{pending.current&&retained&&!active&&<button className="quiet-button" disabled={disabled} onClick={()=>void inspect(true)}>Save retained final response</button>}</div><small>Only final results are saved. Audio stays in request memory; recovery never uploads it again. An unresolved operation keeps new capture paused.</small></section>;
}
