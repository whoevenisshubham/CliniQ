import type {SupabaseClient} from '@supabase/supabase-js';
export async function workerStatus(admin:SupabaseClient){const r=await admin.rpc('worker_status');return r.error?{state:'unavailable',lastSuccess:null}:r.data;}
export async function observeWorker(admin:SupabaseClient,id:string,source:string,result:unknown,durationMs:number){
 const r=result as {status?:string;degraded?:boolean};
 const outcome=r?.degraded||r?.status==='retry_queued'?'degraded':['idle','succeeded','text_ready','needs_transcription','encrypted','empty','unsupported','cancelled'].includes(r?.status??'')?'ok':'failed';
 const saved=await admin.rpc('worker_observe',{k:id,source,outcome,duration:Math.min(180000,Math.max(0,Math.round(durationMs)))});
 if(saved.error||saved.data!==true)throw Error('WORKER_OBSERVATION_UNCONFIRMED');
 return outcome;
}
