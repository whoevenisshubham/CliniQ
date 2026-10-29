import {it,expect,vi,afterEach} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
const f=vi.hoisted(()=>({create:vi.fn(),admit:vi.fn(),run:vi.fn(),nextSend:0}));
vi.mock('@/lib/server/ai/service',()=>({createThread:f.create,admitAI:f.admit}));
vi.mock('@/lib/server/ai/runner',()=>({runAIJob:f.run}));
vi.mock('@/lib/server/ai/provider',()=>({providerConfiguration:()=>({enabled:true,model:'synthetic',authorizationRef:'synthetic'})}));
import {incrementalExtraction} from '@/lib/server/speech/incremental';
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();vi.useRealTimers();f.nextSend=0;});
const client={from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:null,data:{enabled:true,model:'synthetic',ends_at:'2050-01-01',next_send_at:new Date(f.nextSend).toISOString(),requests:0,max_requests:2,max_output:6000,output_tokens:0}}),single:async()=>({error:null,data:table==='document_jobs'?{result:{proposalId:'p'}}:{id:'p',base_revision:1,operations:[]}})})})})} as unknown as SupabaseClient;
function setup(){vi.stubEnv('LIVE_EMR_INCREMENTAL_ENABLED','true');f.create.mockResolvedValue('thread');f.admit.mockResolvedValue('job');}
it('reserves the second multi-minute proposal for stop so later corrections remain eligible',async()=>{
 vi.useFakeTimers();setup();f.run.mockResolvedValue({status:'succeeded'});const emit=vi.fn(),d=incrementalExtraction(client,client,'visit',emit,{audioWindowMs:180000,finalAfterStop:true});
 d.notify();await vi.advanceTimersByTimeAsync(1200);expect(f.run).toHaveBeenCalledOnce();
 d.notify(Date.now(),120);await vi.advanceTimersByTimeAsync(120000);expect(f.run).toHaveBeenCalledOnce();expect(emit.mock.calls.some(([e])=>e.state==='waiting_for_finish')).toBe(true);
 d.notify(Date.now(),120);await d.finish();expect(f.run).toHaveBeenCalledTimes(2);
 d.notify();await d.finish();expect(f.run).toHaveBeenCalledTimes(2);
});
it('a disabled incremental path does not admit any provider work',async()=>{const emit=vi.fn(),d=incrementalExtraction(client,client,'visit',emit);d.notify();await d.finish();expect(f.admit).not.toHaveBeenCalled();expect(f.run).not.toHaveBeenCalled();});
it('coalesces arriving finals into one pending drain and never runs two extractions concurrently',async()=>{
 setup();let complete!:(v:{status:string})=>void;f.run.mockImplementationOnce(()=>new Promise(r=>{complete=r;})).mockResolvedValue({status:'succeeded'});const emit=vi.fn(),d=incrementalExtraction(client,client,'visit',emit);d.notify();await vi.waitFor(()=>expect(f.run).toHaveBeenCalledOnce(),{timeout:2500});d.notify();d.notify();expect(f.run).toHaveBeenCalledOnce();complete({status:'succeeded'});await d.finish();expect(f.run).toHaveBeenCalledTimes(2);expect(f.create).toHaveBeenCalledOnce();expect(emit.mock.calls.filter(([e])=>e.type==='emr_proposal')).toHaveLength(2);
});
it.each(['rejected','outcome_unknown','unavailable'])('stops after %s without resending on later finals',async status=>{setup();f.run.mockResolvedValue({status});const d=incrementalExtraction(client,client,'visit',vi.fn());d.notify();await d.finish();d.notify();await d.finish();expect(f.run).toHaveBeenCalledOnce();});
it('a stopped access/connection boundary suppresses a late private proposal',async()=>{setup();let complete!:(v:{status:string})=>void;f.run.mockImplementation(()=>new Promise(r=>{complete=r;}));const emit=vi.fn(),d=incrementalExtraction(client,client,'visit',emit);d.notify();await vi.waitFor(()=>expect(f.run).toHaveBeenCalledOnce(),{timeout:2500});d.stop();complete({status:'succeeded'});await d.finish();expect(emit.mock.calls.some(([e])=>e.type==='emr_proposal')).toBe(false);});
it('logout cancels paced pending work before any job admission or provider execution',async()=>{setup();f.nextSend=Date.now()+60000;const emit=vi.fn(),d=incrementalExtraction(client,client,'visit',emit);d.notify();await vi.waitFor(()=>expect(emit.mock.calls.some(([e])=>e.state==='waiting_for_allowed_time')).toBe(true),{timeout:2500});d.stop();await d.finish();expect(f.admit).not.toHaveBeenCalled();expect(f.run).not.toHaveBeenCalled();});
it('coalesces short opening finals before admitting the initial extraction',async()=>{setup();f.run.mockResolvedValue({status:'succeeded'});const d=incrementalExtraction(client,client,'visit',vi.fn());d.notify(Date.now(),30);await Promise.resolve();expect(f.admit).not.toHaveBeenCalled();d.notify(Date.now(),100);await d.finish();expect(f.run).toHaveBeenCalledOnce();});
