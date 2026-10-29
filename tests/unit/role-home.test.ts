// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {act,createElement,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {RoleHome} from '@/components/shared/RoleHome';
vi.mock('next/link',()=>({default:({children,href}:{children:ReactNode;href:string})=>createElement('a',{href},children)}));
vi.mock('@/components/shared/DashboardShell',()=>({DashboardShell:({children}:{children:ReactNode})=>createElement('main',null,children)}));
vi.mock('@/components/shared/ThemeProvider',()=>({ThemeToggle:()=>null}));
let host:HTMLDivElement,root:Root;
const user={id:'doctor-b',name:'Synthetic doctor B',email:'synthetic@example.invalid',role:'doctor' as const};
const listing={role:'doctor',patients:[{id:'patient-b',name:'Synthetic patient B',allergies:['Penicillin']}],care:[{patient_id:'patient-b',workspace_id:'workspace-b'}],visits:[{id:'encounter-b',patient_id:'patient-b',revision:2,status:'active',started_at:'2026-10-28T00:00:00Z'}]};
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it('opens persisted patient and encounter destinations without invented safety counts',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({data:listing})));
 await act(async()=>root.render(createElement(RoleHome,{user,view:'safety'})));
 expect(host.textContent).toContain('Penicillin');
 expect(host.querySelector('a[href="/consultations?patient=patient-b"]')).not.toBeNull();
 expect(host.querySelector('a[href="/consultations?id=encounter-b"]')).not.toBeNull();
 expect(host.textContent).not.toContain('Revenue');
});
it('ignores a late previous-actor response and never displays it under another account',async()=>{
 let finish!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise<Response>(r=>{finish=r;})).mockResolvedValue(Response.json({data:{...listing,role:'patient',approved:[],patients:undefined,visits:undefined,care:undefined}})));
 await act(async()=>root.render(createElement(RoleHome,{key:'doctor-b',user})));
 await act(async()=>root.render(createElement(RoleHome,{key:'patient-a',user:{...user,id:'patient-a',role:'patient'}})));
 await act(async()=>finish(Response.json({data:listing})));
 expect(host.textContent).not.toContain('Synthetic patient B');
 expect(host.textContent).toContain('No approved visits');
});
it('a denied or malformed list fails closed',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('denied',{status:403})));
 await act(async()=>root.render(createElement(RoleHome,{user})));
 expect(host.querySelector('[role="alert"]')).not.toBeNull();
 expect(host.textContent).not.toContain('Synthetic patient B');
});
