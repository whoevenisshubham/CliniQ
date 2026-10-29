import 'server-only';
import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createThread,admitAI} from '../ai/service';
import {runAIJob} from '../ai/runner';
import {providerConfiguration} from '../ai/provider';
import {MAX_STREAM_SPEECH_MS,STREAM_FINISH_BUDGET_MS} from '@/lib/clinical/audio';

// Reuses MediFlow's finalized-segment cursor and single-flight delta drain.
// No retry of rejected/unknown work and no automatic allowance expansion.
export function incrementalExtraction(client:SupabaseClient,admin:SupabaseClient,cid:string,emit:(event:unknown)=>void,options:{audioWindowMs?:number;finalAfterStop?:boolean}={}){
 let debounce:ReturnType<typeof setTimeout>|undefined;
 let pending=false,running:Promise<void>|undefined,halted=false,passes=0,thread:Promise<string>|undefined,latestFinalAt=0,characters=0;
 let finishing=false,deferredUntilFinish=false,successful=0;
 const abort=new AbortController(),deadline=Date.now()+Math.min(MAX_STREAM_SPEECH_MS,options.audioWindowMs??60000)+STREAM_FINISH_BUDGET_MS;
 const cancelQueued=async(jid:string)=>{const r=await admin.from('document_jobs').update({status:'cancelled',error_code:'LIVE_DRAIN_STOPPED'}).eq('id',jid).eq('status','queued').is('provider_attempt_id',null);if(r.error)throw Error('CANCELLATION_UNCONFIRMED');};
 const wait=(ms:number)=>new Promise<void>((resolve,reject)=>{if(abort.signal.aborted){reject(Error('STOPPED'));return;}const stop=()=>{clearTimeout(timer);reject(Error('STOPPED'));};const timer=setTimeout(()=>{abort.signal.removeEventListener('abort',stop);resolve();},ms);abort.signal.addEventListener('abort',stop,{once:true});});
 const drain=async()=>{
  while(pending&&!halted){
   if(options.finalAfterStop&&successful>=2){pending=false;return;}
   if(options.finalAfterStop&&successful===1&&!finishing){deferredUntilFinish=true;emit({type:'emr_status',state:'waiting_for_finish'});return;}
   pending=false;
   if(process.env.LIVE_EMR_INCREMENTAL_ENABLED!=='true')return;
   if(Date.now()>=deadline){halted=true;emit({type:'emr_status',state:'session_deadline'});return;}
   const config=providerConfiguration();
   if(!config.enabled||++passes>8){halted=true;emit({type:'emr_status',state:'disabled_or_bounded'});return;}
   try{
    const allowance=await admin.from('provider_allowances').select('enabled,model,ends_at,next_send_at,max_requests,requests,max_output,output_tokens').eq('authorization_ref',config.authorizationRef).maybeSingle();const b=allowance.data;
    if(allowance.error||!b||!b.enabled||b.model!==config.model||Date.parse(b.ends_at)<=Date.now()||b.requests>=b.max_requests||b.max_output-b.output_tokens<3000){halted=true;emit({type:'emr_status',state:'allowance_unavailable'});return;}
    const delay=Math.max(0,Date.parse(b.next_send_at)-Date.now());
    if(delay){if(Date.now()+delay+45000>deadline||Date.parse(b.ends_at)<=Date.now()+delay){halted=true;emit({type:'emr_status',state:'session_deadline'});return;}emit({type:'emr_status',state:'waiting_for_allowed_time',waitMs:delay});pending=true;await wait(delay);continue;}
    thread??=createThread(client,randomUUID(),cid);
    const tid=await thread;if(halted)return;const cutoff=latestFinalAt,jid=await admitAI(client,randomUUID(),tid,{kind:'extract_emr',question:'Prepare source-bound EMR changes from new saved final speech, preserving corrections, negatives and unknowns.'});
    if(halted){await cancelQueued(jid);return;}
    emit({type:'emr_status',state:'preparing'});const started=Date.now(),r=await runAIJob(admin,jid,undefined,abort.signal);
    if(halted)return;
    if(!['succeeded','recovered'].includes(r.status)){
     // Only a pre-transmission quota refusal may coalesce within this active,
     // bounded session. Provider failures/unknown outcomes never retry.
     if(r.status==='not_admitted'){await cancelQueued(jid);if(['MINUTE_PACING','TOKEN_WINDOW'].includes(r.reason??'')&&Date.parse(r.availableAt??'')>Date.now()){pending=true;emit({type:'emr_status',state:'waiting_for_allowed_time',waitMs:Date.parse(r.availableAt)-Date.now(),reason:r.reason});await wait(Math.min(61000,Date.parse(r.availableAt)-Date.now()));continue;}}
     halted=true;emit({type:'emr_status',state:r.status,reason:'reason'in r&&typeof r.reason==='string'&&/^[A-Z_]+$/.test(r.reason)?r.reason:undefined});return;
    }
    const job=await client.from('document_jobs').select('result').eq('id',jid).single();
    const id=job.data?.result?.proposalId;
    if(job.error||typeof id!=='string')throw Error('PROPOSAL_UNAVAILABLE');
    const p=await client.from('clinical_proposals').select('*').eq('id',id).single();
    if(p.error||!p.data)throw Error('PROPOSAL_UNAVAILABLE');
    if(!halted){successful++;emit({type:'emr_proposal',proposal:p.data,elapsedMs:Date.now()-started,finalSegmentToEmrMs:Date.now()-cutoff});}
   }catch{if(!halted)emit({type:'emr_status',state:'unconfirmed_no_retry'});halted=true;}
  }
 };
 const start=()=>{if(!running&&!halted&&!deferredUntilFinish)running=drain().finally(()=>{running=undefined;if(pending&&!halted&&!deferredUntilFinish)start();});};
 return {notify(finalAt=Date.now(),length=120){if(halted)return;latestFinalAt=finalAt;characters+=length;pending=true;if(debounce)clearTimeout(debounce);if(characters>=120)debounce=setTimeout(start,1200);},async finish(){finishing=true;deferredUntilFinish=false;if(debounce)clearTimeout(debounce);if(pending&&!running)start();while(running)await running;},stop(){halted=true;pending=false;if(debounce)clearTimeout(debounce);abort.abort();}};
}
