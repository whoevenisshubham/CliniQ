// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {SpeechCapture} from '@/components/consultation/SpeechCapture';
import {speechPhase} from '@/lib/client/speech-state';
import {captureClip} from '@/lib/clinical/capture';
vi.mock('@/lib/clinical/capture',()=>({captureClip:vi.fn(async(o:{onClip:(b:Uint8Array)=>void})=>o.onClip(new Uint8Array([1,2,3])))}));
let root:Root,host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.clearAllMocks();});
const result=(data:unknown)=>Response.json({data});
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
const click=async(text:string)=>{await act(async()=>button(text).click());};
it('unknown clip inspection never unlocks another send; retained recovery sends JSON without audio',async()=>{
 let status='outcome_unknown';const sent:RequestInit[]=[],saved=vi.fn();
 vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{
  if(init?.method){sent.push(init);return Promise.resolve((init.headers as Record<string,string>)['content-type']==='audio/wav'?result({state:'outcome_unknown',operationId:'op-one'}):result({state:'saved',operationId:'op-one',segmentId:'segment-one',consultationId:'encounter-one',revision:1}));}
  return Promise.resolve(url.includes('?operation=')?result({id:'op-one',status}):result({available:true,mode:'offline_fixture'}));
 }));
 await act(async()=>root.render(createElement(SpeechCapture,{consultationId:'encounter-one',revision:0,sequence:0,disabled:false,fixture:false,onBusy:vi.fn(),onSaved:saved,onAccessLost:vi.fn()})));
 await click('Capture 15-second clip');expect(sent).toHaveLength(1);expect(button('Capture 15-second clip').disabled).toBe(true);
 await click('Check saved clip');expect(sent).toHaveLength(1);expect(button('Capture 15-second clip').disabled).toBe(true);expect(button('Save retained final response')).toBeUndefined();
 status='responded';await click('Check saved clip');await click('Save retained final response');expect(sent).toHaveLength(2);expect((sent[1].headers as Record<string,string>)['content-type']).toBe('application/json');expect(JSON.parse(sent[1].body as string)).toEqual({action:'save_retained',operationKey:(sent[0].headers as Record<string,string>)['idempotency-key']});expect(saved).toHaveBeenCalledOnce();
});
it('availability denial propagates access loss and cannot enable capture',async()=>{
 const denied=vi.fn();vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(Response.json(null,{status:403}))));
 await act(async()=>root.render(createElement(SpeechCapture,{consultationId:'encounter-one',revision:0,sequence:0,disabled:false,fixture:false,onBusy:vi.fn(),onSaved:vi.fn(),onAccessLost:denied})));
 expect(denied).toHaveBeenCalledOnce();expect(button('Capture 15-second clip').disabled).toBe(true);
});
it('only retained results permit save-only recovery; unknown and active states retain the operation',()=>{
 expect(speechPhase('responded')).toBe('retained');for(const state of ['outcome_unknown','unexpected'])expect(speechPhase(state)).toBe('unknown');for(const state of ['admitted','transmitting'])expect(speechPhase(state)).toBe('pending');expect(speechPhase('saved')).toBe('saved');
});
it('remaining audio admission bounds actual capture instead of implying a full 15-second allowance',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>result(init?.method?{state:'unavailable',operationId:'bounded-op'}:{available:true,mode:'offline_fixture',maxClipMs:7000})));
 await act(async()=>root.render(createElement(SpeechCapture,{consultationId:'encounter-one',revision:0,sequence:0,disabled:false,fixture:false,onBusy:vi.fn(),onSaved:vi.fn(),onAccessLost:vi.fn()})));await click('Capture 7-second clip');expect(captureClip).toHaveBeenLastCalledWith(expect.objectContaining({windowMs:7000}));
});
it('malformed successful preflight cannot enable capture beyond the supported bound',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>result({available:true,mode:'live',maxClipMs:900000})));
 await act(async()=>root.render(createElement(SpeechCapture,{consultationId:'encounter-one',revision:0,sequence:0,disabled:false,fixture:false,onBusy:vi.fn(),onSaved:vi.fn(),onAccessLost:vi.fn()})));expect(button('Capture 15-second clip').disabled).toBe(true);expect(captureClip).not.toHaveBeenCalled();
});
