import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
// Only the exact finite demonstration is auto-closed; unrelated ledgers remain untouched.
export async function closeConsultationDemo(admin:SupabaseClient,cid:string,ref:string){
 if(!ref||process.env.LIVE_CONSULTATION_DEMO_REF!==ref||process.env.LIVE_AI_AUTHORIZATION_REF!==ref)return null;
 const results=await Promise.allSettled([
  admin.from('speech_allowances').update({enabled:false}).eq('authorization_ref',ref).eq('consultation_id',cid),
  admin.from('provider_allowances').update({enabled:false}).eq('authorization_ref',ref),
  admin.from('provider_budgets').update({enabled:false}).eq('authorization_ref',ref),
 ]);
 return results.every(r=>r.status==='fulfilled'&&!r.value.error);
}
