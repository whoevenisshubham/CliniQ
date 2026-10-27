"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {MAX_SPEECH_MS,validateWav} from '@/lib/clinical/audio';
import {LiveSpeechCapture} from './LiveSpeechCapture';
import {captureClip} from '@/lib/clinical/capture';
import {accessDenied,readJsonResponse} from '@/lib/client/http-response';
import {speechResponse} from '@/lib/client/workspace-response';
import {speechPhase} from '@/lib/client/speech-state';

export type SpeechTiming={kind?:'batch';sendToResultMs:number;stopToSavedMs:number|null}|{kind:'stream';interimMs?:number;energyOnsetToInterimMs?:number;energyEndToFinalMs?:number;finalSegmentToEmrMs?:number;stopToSavedMs:number|null};
type Pending={key:string;segmentId:string;revision:number;sequence:number;generation:number};
export function SpeechCapture({consultationId,revision,sequence,disabled,fixture,onBusy,onSaved,onAccessLost}:{consultationId:string;revision:number;sequence:number;disabled:boolean;fixture:boolean;onBusy:(busy:boolean)=>void;onSaved:(timing?:SpeechTiming)=>void;onAccessLost:(e:unknown)=>void}){
 const [available,setAvailable]=useState(false),[state,setState]=useState('Speech unavailable'),[active,setActive]=useState(false),[retained,setRetained]=useState(false);
 const [streaming,setStreaming]=useState(false),[microphoneReady,setMicrophoneReady]=useState(false);
 const [checking,setChecking]=useState(false);
 const [timing,setTiming]=useState<{sendToResultMs:number;stopToSavedMs:number|null}|null>(null);
 const measured=useRef<SpeechTiming|undefined>(undefined);
 const captureEnd=useRef<number|null>(null),finishCapture=useRef<(()=>void)|undefined>(undefined);
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
   .then(r=>readJsonResponse(r,b=>speechResponse(b,'availability'))).then(b=>{if(live.current&&generation.current===n){setAvailable(b.data.available===true);setStreaming(b.data.streaming===true);if(Number.isInteger(b.data.maxClipMs)&&b.data.maxClipMs>=1000&&b.data.maxClipMs<=MAX_SPEECH_MS)setMaxClipMs(b.data.maxClipMs);setState(b.data.available?(b.data.mode==='live'?'Speech transport configured · allowance checked before send':'Synthetic offline transport · no live speech'):'Speech unavailable · continue with typed transcript');}})
   .catch(e=>{if(live.current&&generation.current===n){if(accessDenied(e))callbacks.current.onAccessLost(e);else setState('Speech status unavailable · typed transcript remains available');}});
  return()=>{live.current=false;abort.abort();invalidate();};
 },[path,fixture,invalidate]);
 const apply=(op:Pending,status:string)=>{
  if(!current(op.generation)||pending.current!==op)return;
  const phase=speechPhase(status);setRetained(phase==='retained');
  if(phase==='saved'){pending.current=null;setState('Final transcript saved');finish(op.generation);onSaved(measured.current);return;}
  if(phase==='terminal'){pending.current=null;setState('Speech operation ended: '+status+'. No new transcript was published by this attempt.');}
  else setState(phase==='retained'?'Final response retained. Complete its save without retranscribing.':phase==='pending'?'Speech operation is still pending. Check saved status.':'Speech outcome is unknown. This operation will not be sent again.');
 };
 const upload=async(op:Pending,bytes:Uint8Array,signal:AbortSignal)=>{
  const sentAt=performance.now();
  try{setState('Saving final clip…');const r=await fetch(path,{method:'POST',signal:AbortSignal.any([signal,AbortSignal.timeout(90000)]),headers:{'content-type':'audio/wav','idempotency-key':op.key,'x-segment-id':op.segmentId,'x-sequence':String(op.sequence),'x-expected-revision':String(op.revision)},body:new Uint8Array(bytes).buffer});const b=await readJsonResponse(r,b=>speechResponse(b,'save'));if(current(op.generation)&&b.data.state==='saved'){const now=performance.now();measured.current={sendToResultMs:Math.round(now-sentAt),stopToSavedMs:captureEnd.current===null?null:Math.round(now-captureEnd.current)};setTiming(measured.current);}apply(op,b.data.state);}
  catch(e){fail(e,op.generation);}finally{finish(op.generation);}
 };
 const start=async()=>{
  if(disabled||locked.current||active||!available||pending.current)return;
  const n=generation.current,c=new AbortController();controller.current=c;locked.current=true;setActive(true);setRetained(false);setState('Capturing up to '+Math.ceil(maxClipMs/1000)+' seconds…');onBusy(true);
  setTiming(null);measured.current=undefined;captureEnd.current=null;
  const handle=await captureClip({signal:c.signal,windowMs:maxClipMs,onCaptureEnd:()=>{captureEnd.current=performance.now();},onError:code=>{if(current(n)){setState('Capture unavailable: '+code);finish(n);}},onClip:bytes=>{if(!current(n))return;const op={key:crypto.randomUUID(),segmentId:crypto.randomUUID(),revision,sequence,generation:n};pending.current=op;finishCapture.current=undefined;void upload(op,bytes,c.signal);}});
  finishCapture.current=handle?.finish;
 };
 // Uses the same capture adapter, but deliberately has no upload/transport path.
 const checkMicrophone=async()=>{
  if(disabled||locked.current||active||pending.current)return;
  const n=generation.current,c=new AbortController();controller.current=c;locked.current=true;setActive(true);setChecking(true);setMicrophoneReady(false);setState('Checking microphone locally for 2 seconds. Nothing is uploaded.');onBusy(true);
  await captureClip({signal:c.signal,windowMs:2000,onError:code=>{if(current(n)){setChecking(false);setState('Local microphone check: '+code+'. No audio uploaded.');finish(n);}},onClip:bytes=>{if(!current(n))return;setChecking(false);try{const wav=validateWav(bytes);setMicrophoneReady(true);setState('Microphone check passed: '+Math.round(wav.durationMs)+' ms captured locally. No audio uploaded.');}catch{setState('Local microphone check: INVALID_CAPTURED_WAV. No audio uploaded.');}finish(n);}});
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
 return <section className="speech-capture" aria-label="Speech capture">{streaming&&!microphoneReady&&<p>First check the microphone locally. This opens no provider session and uploads nothing.</p>}{streaming&&<LiveSpeechCapture cid={consultationId} revision={revision} sequence={sequence} disabled={disabled||active||!available||!microphoneReady||!!pending.current} onBusy={onBusy} onAccessLost={onAccessLost} onSaved={v=>onSaved({...v,kind:'stream',stopToSavedMs:v.stopToSavedMs??null})}/> }<p role="status">{state}</p>{timing&&<p role="status">Batch send to saved result: {timing.sendToResultMs} ms. Capture end to saved transcript: {timing.stopToSavedMs??'not measured'} ms. Includes upload and durable save; no streaming interim measurement.</p>}<div className="clinical-inline"><button className="quiet-button" disabled={disabled||active||!!pending.current} onClick={()=>void checkMicrophone()}>Check microphone locally</button>{!streaming&&<button className="quiet-button" disabled={disabled||active||!available||!!pending.current} onClick={()=>void start()}>Capture {Math.ceil(maxClipMs/1000)}-second clip</button>}{active&&!checking&&!pending.current&&<button className="quiet-button" onClick={()=>finishCapture.current?.()}>Finish and send recording</button>}{active&&<button className="quiet-button" onClick={()=>{controller.current?.abort();setChecking(false);setState('Capture stopped. Check saved status if transmission had started.');if(!pending.current)finish(generation.current);}}>Stop capture</button>}{pending.current&&<button className="quiet-button" disabled={active} onClick={()=>void inspect()}>Check saved clip</button>}{pending.current&&retained&&!active&&<button className="quiet-button" disabled={disabled} onClick={()=>void inspect(true)}>Save retained final response</button>}</div><small>Only final results are saved. Audio stays in request memory; recovery never uploads it again. An unresolved operation keeps new capture paused.</small></section>;
}
