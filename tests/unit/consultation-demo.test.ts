import {it,expect,vi,afterEach} from 'vitest';
import {closeConsultationDemo} from '@/lib/server/speech/demo';
import type {SupabaseClient} from '@supabase/supabase-js';
afterEach(()=>vi.unstubAllEnvs());
it('only closes the exact demonstration ledgers and reports a failed cleanup truthfully',async()=>{
 const touched:string[]=[];let failed=false;
 const admin={from:(t:string)=>({update:()=>({eq:(column:string,value:string)=>{touched.push(t+':'+column+':'+value);const result={error:failed&&t==='provider_allowances'?{code:'unavailable'}:null};return t==='speech_allowances'?{eq:async()=>result}:Promise.resolve(result);}})})}as unknown as SupabaseClient;
 expect(await closeConsultationDemo(admin,'visit','packet')).toBeNull();expect(touched).toEqual([]);
 vi.stubEnv('LIVE_CONSULTATION_DEMO_REF','packet');vi.stubEnv('LIVE_AI_AUTHORIZATION_REF','packet');expect(await closeConsultationDemo(admin,'visit','packet')).toBe(true);expect(touched).toEqual(['speech_allowances:authorization_ref:packet','provider_allowances:authorization_ref:packet','provider_budgets:authorization_ref:packet']);failed=true;expect(await closeConsultationDemo(admin,'visit','packet')).toBe(false);
});
