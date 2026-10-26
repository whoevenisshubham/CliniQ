"use client";
import {useEffect,useRef,useState} from 'react';
import {captureClip} from '@/lib/clinical/capture';

// Retains the original visible interim/final distinction; provider keys never enter this client.
export function LiveSpeechCapture({cid,revision,sequence,disabled,onBusy,onSaved,onAccessLost}:{cid:string;revision:number;sequence:number;disabled:boolean;onBusy:(v:boolean)=>void;onAccessLost:(e:unknown)=>void;onSaved:(timing:{interimMs?:number;stopToSavedMs?:number})=>void}){
 const [state,setState]=useState('Ready for live transcription'),[active,setActive]=useState(false),[interim,setInterim]=useState(''),[final,setFinal]=useState('');
 const [latency,setLatency]=useState<{interimMs?:number;stopToSavedMs?:number}>({});
 const [checkpointRevision,setCheckpointRevision]=useState(revision),[emr,setEmr]=useState<{base_revision:number;operations:{path:string;op:string;value?:unknown;note?:string}[]}|null>(null),[emrState,setEmrState]=useState('');
 const savedAt=useRef(0);
 const socket=useRef<WebSocket|null>(null),capture=useRef<AbortController|null>(null),finish=useRef<(()=>void)|undefined>(undefined),mounted=useRef(true),locked=useRef(false),stopped=useRef(false),startedAt=useRef(0),stoppedAt=useRef(0),firstInterim=useRef(false),interimElapsed=useRef<number|undefined>(undefined);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;capture.current?.abort();socket.current?.close();};},[]);
 const stop=()=>{if(stopped.current)return;stopped.current=true;stoppedAt.current=performance.now();capture.current?.abort();setState('Finishing live transcript…');if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:'finish'}));};
 const start=()=>{
  if(disabled||locked.current)return;locked.current=true;finish.current=undefined;stoppedAt.current=0;savedAt.current=0;stopped.current=false;firstInterim.current=false;interimElapsed.current=undefined;setLatency({});setFinal('');setInterim('');setEmr(null);setEmrState('');setCheckpointRevision(revision);setState('Connecting authenticated live speech…');setActive(true);onBusy(true);
  const q=new URLSearchParams({operation:crypto.randomUUID(),segment:crypto.randomUUID(),revision:String(revision),sequence:String(sequence)});
  const ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/clinical/'+cid+'/speech/live?'+q);socket.current=ws;
  const end=(message:string)=>{capture.current?.abort();if(mounted.current){setState(message);setActive(false);onBusy(false);}locked.current=false;};
  ws.onmessage=event=>{
   if(!mounted.current||typeof event.data!=='string'||event.data.length>30000)return;
   let r;try{r=JSON.parse(event.data);}catch{end('Invalid live response; no automatic reconnect.');ws.close();return;}
   if(r.type==='ready'){
    if(!Number.isInteger(r.capMs)||r.capMs<1000||r.capMs>60000){end('Invalid audio allowance');ws.close();return;}
    const c=new AbortController();capture.current=c;startedAt.current=performance.now();setState('Listening · interim text is not yet saved');
    void captureClip({signal:c.signal,windowMs:r.capMs,onFrame:pcm=>{if(stopped.current)return;if(ws.readyState!==WebSocket.OPEN||ws.bufferedAmount>262144){end('Audio connection interrupted; no automatic resend.');ws.close();return;}ws.send(new Uint8Array(pcm).buffer);},onClip:()=>stop(),onError:code=>{end('Live capture: '+code);ws.close();}}).then(handle=>{finish.current=handle?.finish;});
   }else if(r.type==='interim'&&typeof r.text==='string'&&r.text.length<=8000){setInterim(r.text);if(!firstInterim.current){firstInterim.current=true;interimElapsed.current=Math.round(performance.now()-startedAt.current);setLatency(v=>({...v,interimMs:interimElapsed.current}));}}
   else if(r.type==='final'&&typeof r.text==='string'&&r.text.length<=8000){setFinal(r.text);setInterim('');}
   else if(r.type==='stop_capture')stop();
   else if(r.type==='checkpoint'&&Number.isInteger(r.revision)){setCheckpointRevision(r.revision);setState('Listening · final speech saved through revision '+r.revision);}
   else if(r.type==='emr_status'&&typeof r.state==='string')setEmrState(r.state==='preparing'?'Preparing reviewable EMR from saved speech…':'EMR: '+r.state+'. No automatic retry.');
   else if(r.type==='emr_proposal'&&Number.isInteger(r.proposal?.base_revision)&&Array.isArray(r.proposal.operations)&&r.proposal.operations.length<=30){setEmr(r.proposal);setEmrState('EMR proposal persisted in '+r.elapsedMs+' ms · clinician review required');}
   else if(r.type==='transcript_saved'){savedAt.current=performance.now();setLatency(v=>({...v,stopToSavedMs:stoppedAt.current?Math.round(savedAt.current-stoppedAt.current):undefined}));setState('Transcript saved · finishing EMR work');}
   else if(r.type==='saved'){const at=savedAt.current||performance.now();setLatency(v=>({...v,stopToSavedMs:stoppedAt.current?Math.round(at-stoppedAt.current):undefined}));end('Live final transcript saved');onSaved({interimMs:interimElapsed.current,stopToSavedMs:stoppedAt.current?Math.round(at-stoppedAt.current):undefined});}
   else if(r.type==='error'){if(['ACCESS_CHANGED','AUTH_REQUIRED'].includes(r.code)){setFinal('');setInterim('');setEmr(null);setEmrState('');onAccessLost(Object.assign(new Error('Live access ended'),{status:r.code==='AUTH_REQUIRED'?401:403}));}end('Live speech stopped: '+String(r.code)+'. Saved checkpoints remain available; no automatic resend.');ws.close();}
  };
  ws.onerror=()=>end('Live connection failed. Check saved operation before another attempt.');
  ws.onclose=()=>{if(locked.current)end('Live connection closed; outcome unconfirmed. No automatic reconnect.');};
 };
 return <section aria-label="Live transcription"><p role="status">{state}</p><button className="primary-button" disabled={disabled||active} onClick={start}>Start live transcription</button>{active&&<button className="quiet-button" onClick={()=>{if(finish.current)finish.current();else stop();}}>Stop and save live transcript</button>}{final&&<blockquote><small>Final speech · saved checkpoints reported above</small><p>{final}</p></blockquote>}{interim&&<p aria-live="polite"><em>{interim}</em> · interim</p>}{emrState&&<p role="status">{emrState}</p>}{emr&&<section aria-label="Live EMR proposal"><h3>EMR · review candidate</h3><p>{emr.base_revision===checkpointRevision?'Saved source through revision '+emr.base_revision:'Earlier source · more speech has arrived; review corrections before use'}. Clinical fields require review before applying.</p>{emr.operations.map((op,i)=><div key={i}><strong>{op.path.replaceAll('_',' ')}</strong><p>{op.value===undefined?op.note:typeof op.value==='string'?op.value:JSON.stringify(op.value)}</p></div>)}</section>}{latency.interimMs!==undefined&&<p>Capture start to first displayed interim: {latency.interimMs} ms. Speech-onset timing is not established.</p>}{latency.stopToSavedMs!==undefined&&<p>Stop to saved transcript: {latency.stopToSavedMs} ms.</p>}</section>;
}
