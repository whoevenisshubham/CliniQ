"use client";
import {useEffect,useRef,useState} from 'react';
import {readJsonResponse,accessDenied} from '@/lib/client/http-response';
export function ClinicalExtraction({cid,revision,disabled,onSaved,onAccessLost}:{cid:string;revision:number;disabled:boolean;onSaved:()=>void;onAccessLost:(e:unknown)=>void}){
 const [available,setAvailable]=useState(false);
 const [busy,setBusy]=useState(false),[state,setState]=useState('EMR suggestions use saved final speech. Clinician review is required.');
 const pending=useRef(false),live=useRef(true),controller=useRef<AbortController|null>(null);
 useEffect(()=>{live.current=true;const c=new AbortController();void fetch('/api/clinical/'+cid+'/extract',{cache:'no-store',signal:c.signal}).then(r=>readJsonResponse(r,v=>typeof (v as {data?:{available?:unknown}})?.data?.available==='boolean')).then(b=>{if(live.current){setAvailable(b.data.available);if(!b.data.available)setState('EMR generation is not enabled for this preview. Saved speech and findings are retained.');}}).catch(e=>{if(live.current&&accessDenied(e))onAccessLost(e);});return()=>{c.abort();live.current=false;controller.current?.abort();};},[cid,onAccessLost]);
 const extract=async()=>{
  if(disabled||!available||pending.current)return;pending.current=true;setBusy(true);setState('Preparing the saved transcript for EMR…');const start=performance.now(),c=new AbortController();controller.current=c;
  try{
   const r=await fetch('/api/clinical/'+cid+'/extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:revision,threadKey:crypto.randomUUID(),requestKey:crypto.randomUUID()}),signal:AbortSignal.any([c.signal,AbortSignal.timeout(110000)])});
   const b=await readJsonResponse(r,v=>{const d=(v as {data?:{status?:unknown;jobId?:unknown}})?.data;return !!d&&typeof d.status==='string'&&typeof d.jobId==='string';});if(!live.current)return;
   if(['succeeded','recovered'].includes(b.data.status)){setState('Reviewable EMR proposal persisted in '+Math.round(performance.now()-start)+' ms. Review its source before using it.');onSaved();}
   else setState('EMR request state: '+b.data.status+'. Saved speech is retained. No automatic retry.');
  }catch(e){if(!live.current)return;if(accessDenied(e))onAccessLost(e);setState(e instanceof Error?e.message:'EMR outcome is unconfirmed. Do not send it again.');}
  finally{if(live.current)setBusy(false);}
 };
 return <section aria-label="Transcript to EMR"><p role="status">{state}</p><button className="primary-button" disabled={disabled||!available||busy||pending.current} onClick={()=>void extract()}>Generate EMR from saved transcript</button></section>;
}
