// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://synthetic.example.test/"}
import {it,expect,vi} from 'vitest';
import {act,createElement} from 'react';import {createRoot} from 'react-dom/client';
import {LiveSpeechCapture} from '@/components/consultation/LiveSpeechCapture';
vi.mock('@/lib/clinical/capture',()=>({captureClip:vi.fn()}));
it('retains initial and later candidates, preserves raw speech, and never offers an automatic second stream',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const sockets:{onmessage?:(e:{data:string})=>void;close:()=>void}[]=[];
 class FakeSocket{static OPEN=1;readyState=1;onmessage?:(e:{data:string})=>void;constructor(){sockets.push(this);}close(){}send(){}}
 vi.stubGlobal('WebSocket',FakeSocket);const host=document.createElement('div');document.body.append(host);const root=createRoot(host),saved=vi.fn(),proposal=vi.fn();
 try{await act(async()=>root.render(createElement(LiveSpeechCapture,{cid:'visit',revision:0,sequence:0,disabled:false,onProposal:proposal,onBusy:vi.fn(),onSaved:saved,onAccessLost:vi.fn()})));
 const start=host.querySelector('button')!;await act(async()=>start.click());
 const emit=async(data:unknown)=>act(async()=>sockets[0].onmessage?.({data:JSON.stringify(data)}));
 await emit({type:'final',text:'Original statement. Actually, a later correction.'});
 await emit({type:'emr_proposal',proposal:{id:'initial',base_revision:1,operations:[{op:'set_fact',path:'chief_complaint',value:'Initial complaint'}]},elapsedMs:100});
 await emit({type:'emr_proposal',proposal:{id:'later',base_revision:2,operations:[{op:'update_fact',path:'chief_complaint',value:'Corrected complaint'}]},elapsedMs:200});
 expect(proposal).toHaveBeenCalledTimes(2);expect(proposal.mock.calls[0][0].operations[0].value).toBe('Initial complaint');expect(proposal.mock.calls[1][0].operations[0].value).toBe('Corrected complaint');expect(host.textContent).toContain('Original statement. Actually, a later correction.');
 await emit({type:'stop_capture'});await emit({type:'checkpoint',id:'saved-final',revision:2,sequence:0,startMs:0,text:'Original statement. Actually, a later correction.'});expect(host.textContent).toContain('Final speech saved · finishing EMR');expect(host.textContent).not.toContain('Listening ·');
 await emit({type:'saved'});expect(saved).toHaveBeenCalledOnce();expect(start.disabled).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
