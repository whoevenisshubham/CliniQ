import 'server-only';
import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createThread,admitAI} from '../ai/service';
import {runAIJob} from '../ai/runner';
import {providerConfiguration} from '../ai/provider';

// Reuses MediFlow's finalized-segment cursor and single-flight delta drain.
// No retry of rejected/unknown work and no automatic allowance expansion.
export function incrementalExtraction(client:SupabaseClient,admin:SupabaseClient,cid:string,emit:(event:unknown)=>void){
 let pending=false,running:Promise<void>|undefined,halted=false,passes=0,thread:Promise<string>|undefined;
 const drain=async()=>{
  while(pending&&!halted){
   pending=false;
   if(process.env.LIVE_EMR_INCREMENTAL_ENABLED!=='true')return;
   const config=providerConfiguration();
   if(!config.enabled||++passes>8){halted=true;emit({type:'emr_status',state:'disabled_or_bounded'});return;}
   try{
    thread??=createThread(client,randomUUID(),cid);
    const tid=await thread,jid=await admitAI(client,randomUUID(),tid,{kind:'extract_emr',question:'Prepare source-bound EMR changes from new saved final speech, preserving corrections, negatives and unknowns.'});
    if(halted)return;
    emit({type:'emr_status',state:'preparing'});const started=Date.now(),r=await runAIJob(admin,jid);
    if(halted)return;
    if(!['succeeded','recovered'].includes(r.status)){
     // A paced/refused admission must not become an unattended later send.
     if(r.status==='not_admitted')await admin.from('document_jobs').update({status:'cancelled',error_code:'LIVE_DRAIN_STOPPED'}).eq('id',jid).eq('status','queued').is('provider_attempt_id',null);
     halted=true;emit({type:'emr_status',state:r.status});return;
    }
    const job=await client.from('document_jobs').select('result').eq('id',jid).single();
    const id=job.data?.result?.proposalId;
    if(job.error||typeof id!=='string')throw Error('PROPOSAL_UNAVAILABLE');
    const p=await client.from('clinical_proposals').select('id,operations,base_revision,state,through_segment_id').eq('id',id).single();
    if(p.error||!p.data)throw Error('PROPOSAL_UNAVAILABLE');
    if(!halted)emit({type:'emr_proposal',proposal:p.data,elapsedMs:Date.now()-started});
   }catch{if(!halted)emit({type:'emr_status',state:'unconfirmed_no_retry'});halted=true;}
  }
 };
 return {notify(){if(halted)return;pending=true;if(!running)running=drain().finally(()=>{running=undefined;});},async finish(){await running;},stop(){halted=true;pending=false;}};
}
