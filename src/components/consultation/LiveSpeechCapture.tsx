"use client";
import {useEffect,useRef,useState} from 'react';
import {captureClip} from '@/lib/clinical/capture';
import {LiveSpeechTiming} from '@/lib/clinical/live-timing';
import {LiveTranscriptPanel} from '../doctor/LiveTranscriptPanel';
import type {SavedSegment} from '@/lib/contracts/clinical';
import type {ClinicalContext} from '@/lib/clinical/context';

export type LiveCandidate={source_snapshot?:{id:string;text:string;speaker:string;language:string}[];created_at?:string;id?:string;base_revision:number;clinical_context?:ClinicalContext;operations:{path:string;op:string;value?:unknown;note?:string;evidence_segment_ids:string[]}[]};

// Retains the original visible interim/final distinction; provider keys never enter this client.
export type LiveCheckpoint={id:string;revision:number;sequence:number;text:string;startMs:number};
export function LiveSpeechCapture({cid,revision,sequence,disabled,onBusy,onSaved,onAccessLost,segments=[],onCheckpoint,onProposal,controls,readyMessage}:{readyMessage?:string;segments?:SavedSegment[];onCheckpoint?:(v:LiveCheckpoint)=>void;onProposal?:(v:LiveCandidate)=>void;controls?:React.ReactNode;cid:string;revision:number;sequence:number;disabled:boolean;onBusy:(v:boolean)=>void;onAccessLost:(e:unknown)=>void;onSaved:(timing:{interimMs?:number;stopToSavedMs?:number;energyOnsetToInterimMs?:number;energyEndToFinalMs?:number;finalSegmentToEmrMs?:number})=>void}){
 const [state,setState]=useState('Ready for live transcription'),[active,setActive]=useState(false),[attempted,setAttempted]=useState(false),[interim,setInterim]=useState(''),[final,setFinal]=useState('');
 const [durationMs,setDurationMs]=useState(0);
 const [latency,setLatency]=useState<{interimMs?:number;stopToSavedMs?:number}>({});
 const [checkpoints,setCheckpoints]=useState<LiveCheckpoint[]>([]),[emrState,setEmrState]=useState(''),[demoState,setDemoState]=useState('');
 const energyTiming=useRef(new LiveSpeechTiming()),finalToEmr=useRef<number|undefined>(undefined);
 const savedAt=useRef(0);
 const socket=useRef<WebSocket|null>(null),capture=useRef<AbortController|null>(null),finish=useRef<(()=>void)|undefined>(undefined),mounted=useRef(true),locked=useRef(false),stopped=useRef(false),startedAt=useRef(0),stoppedAt=useRef(0),firstInterim=useRef(false),interimElapsed=useRef<number|undefined>(undefined);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;capture.current?.abort();socket.current?.close();};},[]);
 useEffect(()=>{if(!active)return;const t=setInterval(()=>{if(startedAt.current&&!stopped.current)setDurationMs(Math.max(0,performance.now()-startedAt.current));},1000);return()=>clearInterval(t);},[active]);
 const stop=()=>{if(stopped.current)return;stopped.current=true;stoppedAt.current=performance.now();capture.current?.abort();setState('Finishing live transcript…');if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:'finish'}));};
 const start=()=>{
  if(disabled||locked.current||attempted)return;setAttempted(true);locked.current=true;finish.current=undefined;stoppedAt.current=0;savedAt.current=0;stopped.current=false;firstInterim.current=false;interimElapsed.current=undefined;setLatency({});setFinal('');setInterim('');setCheckpoints([]);setEmrState('');setDemoState('');setState('Connecting authenticated live speech…');setActive(true);onBusy(true);
  energyTiming.current=new LiveSpeechTiming();finalToEmr.current=undefined;
  const q=new URLSearchParams({operation:crypto.randomUUID(),segment:crypto.randomUUID(),revision:String(revision),sequence:String(sequence)});
  const ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/clinical/'+cid+'/speech/live?'+q);socket.current=ws;
  const end=(message:string)=>{capture.current?.abort();if(mounted.current){setState(message);setActive(false);onBusy(false);}locked.current=false;};
  ws.onmessage=event=>{
   if(!mounted.current||typeof event.data!=='string'||event.data.length>30000)return;
   let r;try{r=JSON.parse(event.data);}catch{end('Invalid live response; no automatic reconnect.');ws.close();return;}
   if(r.type==='ready'){
    if(!Number.isInteger(r.capMs)||r.capMs<1000||r.capMs>60000){end('Invalid audio allowance');ws.close();return;}
    const c=new AbortController();capture.current=c;startedAt.current=performance.now();setState('Listening · interim text is not yet saved');
    void captureClip({signal:c.signal,windowMs:r.capMs,onFrame:pcm=>{if(stopped.current)return;energyTiming.current.observe(pcm,performance.now());if(ws.readyState!==WebSocket.OPEN||ws.bufferedAmount>262144){end('Audio connection interrupted; no automatic resend.');ws.close();return;}ws.send(new Uint8Array(pcm).buffer);},onClip:()=>stop(),onError:code=>{end('Live capture: '+code);ws.close();}}).then(handle=>{finish.current=handle?.finish;});
   }else if(r.type==='interim'&&typeof r.text==='string'&&r.text.length<=8000){energyTiming.current.interim(performance.now());setInterim(r.text);if(!firstInterim.current){firstInterim.current=true;interimElapsed.current=Math.round(performance.now()-startedAt.current);setLatency(v=>({...v,interimMs:interimElapsed.current}));}}
   else if(r.type==='final'&&typeof r.text==='string'&&r.text.length<=8000){energyTiming.current.final(performance.now());setFinal(r.text);setInterim('');}
   else if(r.type==='stop_capture')stop();
   else if(r.type==='checkpoint'&&Number.isInteger(r.revision)&&typeof r.id==='string'&&typeof r.text==='string'&&Number.isInteger(r.sequence)){setCheckpoints(old=>old.some(s=>s.id===r.id)?old:[...old,r]);onCheckpoint?.(r);setState('Listening · final speech saved through revision '+r.revision);}
   else if(r.type==='emr_status'&&typeof r.state==='string')setEmrState(r.state==='preparing'?'Preparing reviewable EMR from saved speech…':r.state==='waiting_for_allowed_time'?'Free-quota pacing: next EMR admission in '+Math.ceil((r.waitMs??0)/1000)+' seconds. Final speech is already saved.':'EMR: '+r.state+(typeof r.reason==='string'&&/^[A-Z_]+$/.test(r.reason)?' · '+r.reason:'')+'. No automatic retry.');
   else if(r.type==='emr_proposal'&&Number.isInteger(r.proposal?.base_revision)&&Array.isArray(r.proposal.operations)&&r.proposal.operations.length<=30){finalToEmr.current=r.finalSegmentToEmrMs;onProposal?.(r.proposal);setEmrState('EMR proposal persisted in '+r.elapsedMs+' ms · clinician review required');}
   else if(r.type==='demo_closed')setDemoState(r.confirmed?'Finite demonstration allowances disabled. Saved candidates remain reviewable.':'Allowance cleanup unconfirmed; do not start another session.');
   else if(r.type==='transcript_saved'){savedAt.current=performance.now();setLatency(v=>({...v,stopToSavedMs:stoppedAt.current?Math.round(savedAt.current-stoppedAt.current):undefined}));setState('Transcript saved · finishing EMR work');}
   else if(r.type==='saved'){const at=savedAt.current||performance.now();setLatency(v=>({...v,stopToSavedMs:stoppedAt.current?Math.round(at-stoppedAt.current):undefined}));end('Live final transcript saved');onSaved({...energyTiming.current.metrics(),finalSegmentToEmrMs:finalToEmr.current,interimMs:interimElapsed.current,stopToSavedMs:stoppedAt.current?Math.round(at-stoppedAt.current):undefined});}
   else if(r.type==='error'){if(['ACCESS_CHANGED','AUTH_REQUIRED'].includes(r.code)){setFinal('');setInterim('');setCheckpoints([]);setEmrState('');onAccessLost(Object.assign(new Error('Live access ended'),{status:r.code==='AUTH_REQUIRED'?401:403}));}end('Live speech stopped: '+String(r.code)+'. Saved checkpoints remain available; no automatic resend.');ws.close();}
  };
  ws.onerror=()=>end('Live connection failed. Check saved operation before another attempt.');
  ws.onclose=event=>{if(locked.current)end('Live connection closed ('+event.code+'); outcome unconfirmed. No automatic reconnect.');};
 };
 const saved=[...segments.map(s=>({id:s.id,text:s.text,is_final:true,timestamp:s.startMs??0,language:s.language})),...checkpoints.filter(s=>!segments.some(old=>old.id===s.id)).map(s=>({id:s.id,text:s.text,is_final:true,timestamp:s.startMs,language:'unknown'}))];
 const displayedFinal=final&&checkpoints.length===0?final:'';
 return <LiveTranscriptPanel className="restored-scribe" isRecording={active&&state.startsWith('Listening')} isConnecting={active&&state.startsWith('Connecting')} segments={saved} interimText={interim||displayedFinal} detectedLanguage="multi" wordCount={(saved.map(s=>s.text).join(' ')+' '+interim).trim().split(/\s+/).filter(Boolean).length} durationMs={durationMs} error={null} onStart={start} onStop={stop} onReset={()=>{}} controls={<>
 <p role="status">{!attempted&&readyMessage?readyMessage:state}</p><div className="clinical-inline"><button className="primary-button" disabled={disabled||active||attempted} onClick={start}>Start live transcription</button>{active&&<><button className="quiet-button" onClick={()=>{if(finish.current)finish.current();else stop();}}>Stop recording & finish EMR</button><button className="quiet-button" onClick={()=>{stopped.current=true;locked.current=false;capture.current?.abort();socket.current?.close();setActive(false);onBusy(false);setState('Pending sends stopped. Saved finals remain; outcome must be reconciled before another attempt.');}}>Stop all work</button></>}</div>
 {active&&<small>Finite demonstration · audio ends at 60 seconds. Stop early when finished. Only finalized speech is saved.</small>}
 {emrState&&<p role="status">{emrState}</p>}{demoState&&<p role="status">{demoState}</p>}
 {controls}
 {(latency.interimMs!==undefined||latency.stopToSavedMs!==undefined)&&<details><summary>Measured timings</summary><p>Capture start → first interim: {latency.interimMs??'unmeasured'} ms. Stop → saved: {latency.stopToSavedMs??'unmeasured'} ms. Provider streaming quality remains separately evaluated.</p></details>}
 </>}/>;
}
