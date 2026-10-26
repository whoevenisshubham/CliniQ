// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3000/"}
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,createElement,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {AccountWorkspace} from '@/components/patient/AccountWorkspace';
import {BillingWorkspace} from '@/components/billing/BillingWorkspace';
import {ContinuityWorkspace} from '@/components/continuity/ContinuityWorkspace';
import {CareWorkspace} from '@/components/care/CareWorkspace';
import {ConsultationReview} from '@/components/consultation/ConsultationReview';
import {EvidenceWorkspace} from '@/components/evidence/EvidenceWorkspace';
import {emptySnapshot} from '@/lib/contracts/clinical';

// Mounted React clients with mocked HTTP and layout chrome; no real Auth,
// listening browser, provider call or scheduling SQL behavior is exercised.
vi.mock('next/link',()=>({default:({children,href}: {children:ReactNode;href:string})=>createElement('a',{href},children)}));
vi.mock('@/components/documents/DocumentSurface',()=>({RecordLayout:({children}:{children:ReactNode})=>createElement('main',null,children)}));
let root:Root,host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
const result=(data:unknown)=>Response.json({data});
const defer=()=>{let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return{promise,resolve};};
const button=(text:string)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('Missing button '+text);return b;};
const click=async(text:string)=>{await act(async()=>button(text).click());};
const render=async(node:ReactNode)=>{await act(async()=>root.render(node));};
const change=async(element:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string)=>{await act(async()=>{const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});};
const profile={name:'Synthetic private person',language:'en',phone:'',dob:null,gender:null,bloodGroup:null,address:'Synthetic private address',emergencyContact:null,allergies:[],conditions:[]};
const account={revision:0,profile,family:[],preferences:[],measurements:[]};
const task={id:'task-one',kind:'follow_up',due_at:'2050-01-01T09:00:00Z',read_at:null,completed_at:null,cancelled_at:null,revision:0,medication_name:'Synthetic private task',reported_status:null,report_revision:null,resource_id:null,display_time_zone:'UTC'};
const continuity={role:'patient',prescriptions:[],schedules:[],tasks:[task],adherence:[],approvedVersions:[]};
const item={itemId:'item-one',description:'Synthetic private bill item',category:'consultation',quantity:1,unitPaise:30000,totalPaise:30000};
const billing={canReview:true,revision:1,bill:{id:'bill-one',items:[item],subtotalPaise:30000,totalPaise:30000,taxStatus:'not_assessed',tariffVersion:'synthetic-v1',sourceVersion:'approved-one',sourceCurrent:true,reviewedAt:'2026-10-24T04:00:00Z'},tariffs:[{version:'synthetic-v1',effectiveOn:'2026-10-24',sourceRevision:'retained',items:[{id:item.itemId,description:item.description,category:item.category,unitPaise:item.unitPaise}]}],approvedVersions:[{id:'approved-one',reviewedAt:'2026-10-24T04:00:00Z'}],history:[]};
const care={slots:[{id:'slot-one',provider_name:'Synthetic private clinician',starts_at:'2050-01-01T09:00:00Z',ends_at:'2050-01-01T09:15:00Z',time_zone:'UTC',synthetic:true}],appointments:[],patients:[],providers:[],queue:[]};
const clinical={visit:{id:'encounter-one',patient_id:'patient-one',workspace_id:'workspace-one',status:'active',revision:0,started_at:'2026-10-24T04:00:00Z'},draft:{snapshot:emptySnapshot(),revision:0,provenance:{}},segments:[],patient:{id:'patient-one',name:'Synthetic private clinical patient',allergies:[]},approved:[],history:[],documents:[],prescriptions:[]};
it('saving findings preserves a separate unsaved transcript until that exact segment is saved',async()=>{
 let revision=0,snapshot=emptySnapshot();const sent:{action:string;segment?:{text:string}}[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{if(url.endsWith('/speech'))return result({available:false,mode:'disabled'});if(init?.method){const command=JSON.parse(String(init.body));sent.push(command);revision++;if(command.action==='save')snapshot=command.snapshot;return result({consultationId:'encounter-one',revision});}return result({...clinical,visit:{...clinical.visit,revision},draft:{snapshot,revision,provenance:{}}});}));
 await render(createElement(ConsultationReview,{actorId:'actor-one',provider:true,initialId:'encounter-one'}));const fields=[...host.querySelectorAll('textarea')],typed=fields.find(x=>x.closest('label')?.textContent?.includes('Typed final transcript'))!,finding=fields.find(x=>x.closest('label')?.textContent?.includes('Chief complaint'))!;
 await change(typed,'SYNTHETIC अलग unsaved transcript 12.4 g/dL');await change(finding,'SYNTHETIC saved finding');expect(button('Save final segment').disabled).toBe(true);await click('Save findings');expect(typed.value).toBe('SYNTHETIC अलग unsaved transcript 12.4 g/dL');expect(sent.map(x=>x.action)).toEqual(['save']);expect(button('Save final segment').disabled).toBe(false);await click('Save final segment');expect(sent[1].segment?.text).toBe('SYNTHETIC अलग unsaved transcript 12.4 g/dL');expect(typed.value).toBe('');
});

it.each(['2026-10-24T09:00:00+05:30',''])('clinical measurement time preserves explicit timezone or unknown null: %s',async(time)=>{
 const sent:RequestInit[]=[];const measured={...clinical,draft:{...clinical.draft,snapshot:{...emptySnapshot(),vitals:[{name:'temperature',value:37.1,unit:'°C',observedAt:null}]}}};
 vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{if(url.endsWith('/speech'))return Promise.resolve(result({available:false,mode:'disabled'}));if(init?.method){sent.push(init);return Promise.resolve(result({consultationId:'encounter-one',revision:1,status:'active'}));}return Promise.resolve(result(measured));}));
 await render(createElement(ConsultationReview,{actorId:'actor-one',provider:true,initialId:'encounter-one'}));
 const field=[...host.querySelectorAll('input')].find(x=>x.closest('label')?.textContent?.includes('Observed time'))!;
 await change(field,'2026-10-23T10:00:00Z');await change(field,time);await click('Save findings');
 expect(JSON.parse(String(sent[0].body)).snapshot.vitals[0]).toEqual({name:'temperature',value:37.1,unit:'°C',observedAt:time||null});
});

it.each([['Edit profile','Name'],['Add relative','Relative’s name']])('account editor enters and restores keyboard focus: %s',async(opener,label)=>{
 vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(result(account))));
 await render(createElement(AccountWorkspace));const trigger=button(opener);await click(opener);
 const input=[...host.querySelectorAll('input')].find(i=>i.closest('label')?.textContent===label)!;
 expect(document.activeElement).toBe(input);await click('Cancel edit');
 expect(document.activeElement).toBe(trigger);expect(host.querySelector('form')).toBeNull();
});

it('account denial removes previously rendered private content and edit forms',async()=>{
 let reads=0;vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(++reads===1?result(account):new Response('<html>private diagnostic</html>',{status:403}))));
 await render(createElement(AccountWorkspace));await click('Edit profile');await click('Refresh saved state');
 expect(host.textContent).toContain('Private account details have been hidden');expect(host.textContent).not.toContain(profile.name);expect(host.querySelector('input')).toBeNull();
});

it('actor remount aborts an old account read and ignores its late response',async()=>{
 const delayed=defer();let reads=0,signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{if(++reads===1){signal=init?.signal??undefined;return delayed.promise;}return Promise.resolve(Response.json(null,{status:403}));}));
 await render(createElement(AccountWorkspace,{key:'actor-a'}));await render(createElement(AccountWorkspace,{key:'actor-b'}));
 expect(signal?.aborted).toBe(true);expect(host.textContent).toContain('Private account details have been hidden');
 await act(async()=>delayed.resolve(result(account)));expect(host.textContent).not.toContain(profile.name);
});

it('account refresh retains dirty profile input and requires explicit reopening after a saved revision changes',async()=>{
 let reads=0;const fetcher=vi.fn(()=>Promise.resolve(result(++reads===1?account:{...account,revision:1,profile:{...profile,name:'Synthetic newer saved name'}})));vi.stubGlobal('fetch',fetcher);
 await render(createElement(AccountWorkspace));await click('Edit profile');
 const name=host.querySelector<HTMLInputElement>('input')!;await change(name,'Synthetic unsaved correction');await click('Refresh saved state');
 expect(host.querySelector('input')).toBe(name);expect(name.value).toBe('Synthetic unsaved correction');expect(host.textContent).toContain('Your input is retained');expect(button('Save profile').disabled).toBe(true);expect(button('Cancel edit').disabled).toBe(false);
 await click('Cancel edit');expect(host.textContent).toContain('Synthetic newer saved name');await click('Edit profile');expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('Synthetic newer saved name');expect(button('Save profile').disabled).toBe(false);expect(fetcher.mock.calls).toHaveLength(2);
});

it('billing keeps an ambiguous exact review, then reports the confirmed save despite a failed refresh',async()=>{
 const sent:RequestInit[]=[];let reads=0;
 vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{if(init?.method){sent.push(init);return Promise.resolve(sent.length===1?new Response('',{status:200}):result({billId:'bill-one',revision:2,totalPaise:30000,illustrative:true,taxStatus:'not_assessed'}));}if(++reads===1)return Promise.resolve(result(billing));return Promise.reject(new TypeError('Network unavailable'));}));
 await render(createElement(BillingWorkspace,{encounterId:'encounter-one',provider:true}));await click('Choose and review items');await act(async()=>host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());await click('Save reviewed selections');
 expect(button('Reconcile the same review').disabled).toBe(false);expect(button('Save reviewed selections').disabled).toBe(true);
 await click('Reconcile the same review');expect(sent).toHaveLength(2);expect(sent[0].body).toBe(sent[1].body);expect(sent[0].headers).toEqual(sent[1].headers);expect(host.textContent).toContain('Reviewed illustrative selections saved');expect(host.textContent).not.toContain('Request outcome unconfirmed');
});

it('continuity will not replace an unresolved correction; malformed success stays pending until same-key reconciliation',async()=>{
 const sent:RequestInit[]=[];vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{if(!init?.method)return Promise.resolve(result(continuity));sent.push(init);return Promise.resolve(sent.length===1?new Response('dependency detail',{status:503}):sent.length===2?result({}):result({taskId:task.id,revision:1,processing:'pending'}));}));
 await render(createElement(ContinuityWorkspace));await click('Mark read');expect(button('Dismiss this task').disabled).toBe(true);await click('Dismiss this task');expect(sent).toHaveLength(1);
 await click('Reconcile the same request');expect(host.textContent).toContain('Request outcome unconfirmed');await click('Reconcile the same request');expect(sent).toHaveLength(3);expect(new Set(sent.map(s=>s.body)).size).toBe(1);expect(new Set(sent.map(s=>(s.headers as Record<string,string>)['idempotency-key'])).size).toBe(1);expect(host.textContent).toContain('Saved. In-app reminders await server processing.');expect(host.textContent).not.toContain('dependency detail');
});

it('care exposes an enabled same-request recovery control after an unreadable response (HTTP double only)',async()=>{
 const sent:RequestInit[]=[];vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{if(!init?.method)return Promise.resolve(result(care));sent.push(init);return Promise.resolve(sent.length===1?new Response('',{status:200}):result({appointmentId:'appointment-one',revision:0,status:'confirmed'}));}));
 await render(createElement(CareWorkspace,{role:'patient',memberships:[]}));await change(host.querySelector('select')!,'slot-one');await click('Confirm synthetic booking');expect(button('Reconcile by retrying the same operation').disabled).toBe(false);await click('Reconcile by retrying the same operation');expect(sent).toHaveLength(2);expect(sent[0].headers).toEqual(sent[1].headers);expect(sent[0].body).toBe(sent[1].body);
});

it('clinical save recovers an unreadable commit through operation lookup without another POST',async()=>{
 const sent:RequestInit[]=[];vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{if(url.endsWith('/speech'))return Promise.resolve(result({available:false,mode:'disabled'}));if(url.includes('/operations/'))return Promise.resolve(result({consultationId:'encounter-one',revision:1,status:'active'}));if(init?.method){sent.push(init);return Promise.resolve(result({}));}return Promise.resolve(result(clinical));}));
 await render(createElement(ConsultationReview,{actorId:'actor-one',provider:true,initialId:'encounter-one'}));const field=[...host.querySelectorAll('textarea')].find(x=>x.closest('label')?.textContent?.includes('Chief complaint'))!;await change(field,'Synthetic correction retained');await click('Save findings');expect(host.textContent).toContain('outcome unconfirmed');expect(field.value).toBe('Synthetic correction retained');await click('Retry / reconcile the same operation');expect(sent).toHaveLength(1);expect(host.textContent).toContain('Saved to the clinical record.');
});

it('an unreadable approval remains recoverable inside its dialog and cannot replace the retained review',async()=>{
 let posts=0;vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{if(url.endsWith('/speech'))return Promise.resolve(result({available:false,mode:'disabled'}));if(url.includes('/operations/'))return Promise.resolve(result({consultationId:'encounter-one',revision:0,status:'completed'}));if(init?.method){posts++;return Promise.resolve(new Response('',{status:200}));}return Promise.resolve(result({...clinical,draft:{...clinical.draft,snapshot:{...clinical.draft.snapshot,chief_complaint:'Saved synthetic complaint'}}}));}));
 await render(createElement(ConsultationReview,{actorId:'actor-one',provider:true,initialId:'encounter-one'}));await click('Review saved draft');
 const dialog=document.querySelector('[role="dialog"]')!;await act(async()=>dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());await click('Approve record');
 expect(dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);expect(button('Reconcile this approval').disabled).toBe(false);await click('Reconcile this approval');expect(posts).toBe(1);expect(document.querySelector('[role="dialog"]')).toBeNull();expect(host.textContent).toContain('Saved to the clinical record.');
});

it('clinical and evidence 403/null responses hide previously rendered private content',async()=>{
 let denied=false;vi.stubGlobal('fetch',vi.fn((url:string)=>Promise.resolve(denied?Response.json(null,{status:403}):url.endsWith('/speech')?result({available:false,mode:'disabled'}):result(clinical))));
 await render(createElement(ConsultationReview,{actorId:'actor-one',provider:true,initialId:'encounter-one'}));expect(host.textContent).toContain(clinical.patient.name);denied=true;await click('Reload saved record');expect(host.textContent).not.toContain(clinical.patient.name);expect(host.textContent).toContain('Access changed');
 const thread={id:'thread-one',created_at:'2026-10-24T04:00:00Z',consultation_id:null};denied=false;
 vi.stubGlobal('fetch',vi.fn((url:string)=>Promise.resolve(denied?new Response('denied',{status:403}):url==='/api/ai/threads'?result([thread]):result({thread,messages:[{id:'message-one',state:'unavailable',question:'Synthetic private question',result:null,resultKind:null,sources:[]}],availableSources:{documents:[]}}))));
 await render(createElement(EvidenceWorkspace,{actorId:'actor-one',provider:false,initialThread:thread.id}));expect(host.textContent).toContain('Synthetic private question');denied=true;await click('Refresh saved state');expect(host.textContent).not.toContain('Synthetic private question');expect(host.textContent).toContain('Sign in again');
});

for(const c of [
 {name:'billing',node:()=>createElement(BillingWorkspace,{encounterId:'encounter-one',provider:true}),data:billing,marker:item.description,refresh:'Refresh saved state'},
 {name:'continuity',node:()=>createElement(ContinuityWorkspace),data:continuity,marker:task.medication_name,refresh:'Refresh saved state'},
 {name:'care',node:()=>createElement(CareWorkspace,{role:'patient',memberships:[]}),data:care,marker:care.slots[0].provider_name,refresh:'Refresh'},
])it(`${c.name}: HTML access denial hides private state after a successful read`,async()=>{
 let denied=false;vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(denied?new Response('<html>private diagnostic</html>',{status:403}):result(c.data))));
 await render(c.node());expect(host.textContent).toContain(c.marker);denied=true;await click(c.refresh);expect(host.textContent).not.toContain(c.marker);expect(host.textContent).not.toContain('private diagnostic');
});

it('missing chief complaint directs focus to findings before approval without submitting or discarding the saved draft',async()=>{
 const posts:RequestInit[]=[];vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{if(init?.method)posts.push(init);return Promise.resolve(result(url.endsWith('/speech')?{available:false,mode:'disabled'}:clinical));}));
 await render(createElement(ConsultationReview,{actorId:'actor-one',provider:true,initialId:'encounter-one'}));await click('Review saved draft');expect(document.querySelector('[role="dialog"]')).toBeNull();expect(host.textContent).toContain('Your saved transcript and draft are retained');expect(document.activeElement).toBe(host.querySelector('textarea[aria-describedby="chief-complaint-guidance"]'));expect(posts).toHaveLength(0);
});
