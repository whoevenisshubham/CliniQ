// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3000/"}
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {act,createElement,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {ConsultationReview} from '@/components/consultation/ConsultationReview';
import {emptySnapshot} from '@/lib/contracts/clinical';
vi.mock('next/link',()=>({default:({children,href}:{children:ReactNode;href:string})=>createElement('a',{href},children)}));
vi.mock('@/components/documents/DocumentSurface',()=>({RecordLayout:({children}:{children:ReactNode})=>createElement('main',null,children)}));
vi.mock('@/components/consultation/SpeechCapture',()=>({SpeechCapture:({onBusy,onSaved}:{onBusy:(b:boolean)=>void;onSaved:()=>void})=>createElement('div',null,createElement('button',{onClick:()=>onBusy(true)},'Simulate capture'),createElement('button',{onClick:()=>{onBusy(false);onSaved();}},'Finish simulated capture'))}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const original={id:'source-one',sequence:0,text:'Raw synthetic speech.',speaker:'unknown',language:'unknown',source_type:'speech',startMs:null,endMs:null};
const base={visit:{id:'encounter-one',patient_id:'patient-one',workspace_id:'workspace-one',revision:0,status:'active',started_at:'2026-10-27T01:00:00Z'},draft:{revision:0,snapshot:emptySnapshot()},patient:{id:'patient-one',name:'Synthetic',allergies:[]},segments:[original],approved:[],history:[],documents:[],prescriptions:[],proposals:[]};
const click=async(text:string)=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('Missing '+text);await act(async()=>b.click());};
const change=async(t:HTMLTextAreaElement,text:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(t,text);t.dispatchEvent(new Event('input',{bubbles:true}));});
it('local clinical editing stays responsive during capture and is retained over transcript-only saves',async()=>{
 let rev=0;vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json({data:url.endsWith('/extract')?{available:false}:{...base,visit:{...base.visit,revision:rev},draft:{...base.draft,revision:rev}}})));
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'doctor-one',provider:true,initialId:'encounter-one'})));await click('Simulate capture');const t=host.querySelector<HTMLTextAreaElement>('[aria-describedby="chief-complaint-guidance"]')!;expect(t.disabled).toBe(false);await change(t,'My unsaved clinician finding');rev=1;await click('Finish simulated capture');expect(t.value).toBe('My unsaved clinician finding');expect(host.textContent).toContain('Your unsaved findings are retained');
});
it('a reviewed source correction is a separate mutation and cannot replace the raw displayed source',async()=>{
 let body:Record<string,unknown>|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method){body=JSON.parse(String(init.body));return Response.json({data:{consultationId:'encounter-one',revision:1}});}return Response.json({data:url.endsWith('/extract')?{available:false}:base});}));
 await act(async()=>root.render(createElement(ConsultationReview,{actorId:'doctor-one',provider:true,initialId:'encounter-one'})));await click('Review transcript correction');const t=host.querySelector<HTMLTextAreaElement>('textarea:not([aria-describedby])')!;expect(t.value).toBe(original.text);await change(t,'Explicit clinician-reviewed correction.');await click('Save reviewed correction');expect(body).toMatchObject({action:'correction',sourceId:original.id,text:'Explicit clinician-reviewed correction.'});expect(host.textContent).toContain(original.text);
});
