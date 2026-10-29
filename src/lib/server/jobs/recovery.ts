import type {SupabaseClient} from '@supabase/supabase-js';
export type RecoveryState={state:'completed';changed:number}|{state:'failed';category:'RECOVERY_UNAVAILABLE'};
export type RecoveryReport=Record<'ai'|'speech'|'continuity',RecoveryState>;
export async function recoverSubsystems(admin:SupabaseClient):Promise<RecoveryReport>{
 const tasks=[['ai','ai_reconcile'],['speech','speech_reconcile'],['continuity','continuity_reconcile']] as const;
 const results=await Promise.all(tasks.map(async([stage,rpc])=>{try{const r=await admin.rpc(rpc);return[stage,r.error?{state:'failed',category:'RECOVERY_UNAVAILABLE'}:{state:'completed',changed:typeof r.data==='number'?r.data:0}] as const;}catch{return[stage,{state:'failed',category:'RECOVERY_UNAVAILABLE'}] as const;}}));
 return Object.fromEntries(results) as RecoveryReport;
}
export function failedRecoveries(report:RecoveryReport){return Object.entries(report).filter(([,r])=>r.state==='failed').map(([stage])=>stage);}
