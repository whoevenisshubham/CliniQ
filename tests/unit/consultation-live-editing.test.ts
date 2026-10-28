// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3000/"}
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {act,createElement,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {ConsultationReview} from '@/components/consultation/ConsultationReview';
import {emptySnapshot} from '@/lib/contracts/clinical';
vi.mock('next/link',()=>({default:({children,href}:{children:ReactNode;href:string})=>createElement('a',{href},children)}));
vi.mock('@/components/documents/DocumentSurface',()=>({RecordLayout:({children}:{children:ReactNode})=>createElement('main',null,children)}));
vi.mock('@/components/consultation/SpeechCapture',()=>({SpeechCapture:({onBusy,onSaved,onCheckpoint,onProposal}:{onBusy:(b:boolean)=>void;onSaved:()=>void;onCheckpoint:(v:unknown)=>void;onProposal:(v:unknown)=>void})=>createElement('div',null,createElement('button',{onClick:()=>onBusy(true)},'Simulate capture'),createElement('button',{onClick:()=>{onCheckpoint({id:'live-final',revision:1,sequence:1,text:'Actually, dizziness for four days.',startMs:1000});onProposal({id:'candidate',base_revision:1,operations:[{path:'chief_complaint',op:'update_fact',value:'Dizziness for four days',evidence_segment_ids:['live-final']}]});}},'Simulate checkpoint'),createElement('button',{onClick:()=>{onBusy(false);onSaved();}},'Finish simulated capture'))}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const original={id:'source-one',sequence:0,text:'Raw synthetic speech.',speaker:'unknown',language:'unknown',source_type:'speech',startMs:null,endMs:null};
const base={visit:{id:'encounter-one',patient_id:'patient-one',workspace_id:'workspace-one',revision:0,status:'active',started_at:'2026-10-27T01:00:00Z'},draft:{revision:0,snapshot:emptySnapshot()},patient:{id:'patient-one',name:'Synthetic',allergies:[]},segments:[original],approved:[],history:[],documents:[],prescriptions:[],proposals:[]};
const click=async(text:string)=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('Missing '+text);await act(async()=>b.click());};
const change=async(t:HTMLTextAreaElement,text:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(t,text);t.dispatchEvent(new Event('input',{bubbles:true}));});

it('a patient deep link reads only approved versions and never asks for a clinician draft',async()=>{
 const approved=(id:string,consultation_id:string,chief:string)=>({id,consultation_id,source_revision:1,snapshot:{...emptySnapshot(),chief_complaint:chief},reviewed_at:'2026-10-28T00:00:00Z',amended_from_id:null});
 const read=vi.fn<typeof fetch>(async()=>Response.json({data:{role:'patient',approved:[approved('version-one','encounter-one','Selected approved complaint'),approved('version-two','encounter-two','Other approved complaint')],prescriptions:[]}}));vi.stubGlobal('fetch',read);
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'patient-one',provider:false,initialId:'encounter-one'})));
 expect(read).toHaveBeenCalledTimes(1);expect(read.mock.calls[0][0]).toBe('/api/clinical');
 expect(host.textContent).toContain('Selected approved complaint');expect(host.textContent).not.toContain('Other approved complaint');
 expect(host.querySelector('a[href="/api/clinical/approved/version-one"]')).not.toBeNull();
});
it('local clinical editing stays responsive during capture and is retained over transcript-only saves',async()=>{
 let rev=0;vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json({data:url.endsWith('/extract')?{available:false}:{...base,visit:{...base.visit,revision:rev},draft:{...base.draft,revision:rev}}})));
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'doctor-one',provider:true,initialId:'encounter-one'})));await click('Simulate capture');const t=host.querySelector<HTMLTextAreaElement>('[aria-describedby="chief-complaint-guidance"]')!;expect(t.disabled).toBe(false);await change(t,'My unsaved clinician finding');rev=1;await click('Finish simulated capture');expect(t.value).toBe('My unsaved clinician finding');expect(host.textContent).toContain('Your unsaved findings are retained');
});
it('a reviewed source correction is a separate mutation and cannot replace the raw displayed source',async()=>{
 let body:Record<string,unknown>|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method){body=JSON.parse(String(init.body));return Response.json({data:{consultationId:'encounter-one',revision:1}});}return Response.json({data:url.endsWith('/extract')?{available:false}:base});}));
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'doctor-one',provider:true,initialId:'encounter-one'})));await click('Review transcript correction');const t=host.querySelector<HTMLTextAreaElement>('textarea:not([aria-describedby])')!;expect(t.value).toBe(original.text);await change(t,'Explicit clinician-reviewed correction.');await click('Save reviewed correction');expect(body).toMatchObject({action:'correction',sourceId:original.id,text:'Explicit clinician-reviewed correction.'});expect(host.textContent).toContain(original.text);
});

it('background final/checkpoint and candidate preserve clinician text, caret, node and avoid a full read',async()=>{
 const read=vi.fn(async(url:string)=>Response.json({data:url.endsWith('/extract')?{available:false}:base}));vi.stubGlobal('fetch',read);
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'doctor-one',provider:true,initialId:'encounter-one'})));
 const t=host.querySelector<HTMLTextAreaElement>('[aria-describedby="chief-complaint-guidance"]')!;await change(t,'Clinician wording takes precedence');t.focus();t.setSelectionRange(8,8);const reads=read.mock.calls.length;
 await click('Simulate checkpoint');expect(host.querySelector('[aria-describedby="chief-complaint-guidance"]')).toBe(t);expect(t.value).toBe('Clinician wording takes precedence');expect(t.selectionStart).toBe(8);expect(document.activeElement).toBe(t);expect(read.mock.calls.length).toBe(reads);expect(host.textContent).toContain('Dizziness for four days');expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Use reviewed fields')?.disabled).toBe(true);
});
it('typing while a findings save is in flight survives the authoritative receipt and remains unsaved',async()=>{
 let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>init?.method?new Promise<Response>(r=>{finish=r;}):Response.json({data:url.endsWith('/extract')?{available:false}:base})));
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'doctor-one',provider:true,initialId:'encounter-one'})));
 const t=host.querySelector<HTMLTextAreaElement>('[aria-describedby="chief-complaint-guidance"]')!;await change(t,'First saved wording');await click('Save findings');expect(t.disabled).toBe(false);await change(t,'Later unsaved wording');
 await act(async()=>finish(Response.json({data:{consultationId:'encounter-one',revision:1}})));expect(t.value).toBe('Later unsaved wording');expect(host.textContent).toContain('Unsaved findings');expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Save findings')?.disabled).toBe(false);
});

it('shows the newest candidate pair chronologically even when a returning read is newest-first',async()=>{
 const proposals=[4,3,2,1].map(n=>({id:'p'+n,base_revision:0,state:'review_required',result_kind:'offline_fixture',created_at:'2026-10-27T01:00:0'+n+'Z',source_snapshot:[],operations:[{op:'set_fact',path:'chief_complaint',value:'Candidate '+n,evidence_segment_ids:[original.id]}]}));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json({data:url.endsWith('/extract')?{available:false}:{...base,proposals}})));
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'doctor-one',provider:true,initialId:'encounter-one'})));
 const text=host.textContent!;expect(text).not.toContain('Candidate 1');expect(text).not.toContain('Candidate 2');expect(text.indexOf('Candidate 3')).toBeLessThan(text.indexOf('Candidate 4'));expect(host.querySelector('.candidate-comparison')?.textContent).toContain('Candidate 4');expect(host.querySelectorAll('.live-emr-candidates > article')).toHaveLength(1);expect(host.querySelector('.live-emr-candidates > article')?.textContent).toContain('Candidate 4');
});
