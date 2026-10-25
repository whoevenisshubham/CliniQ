// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3000/"}
import {afterEach,expect,it,vi} from 'vitest';
import {act,createElement,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {DocumentWorkspace} from '@/components/documents/DocumentWorkspace';
vi.mock('@/components/documents/DocumentSurface',()=>({RecordLayout:({children}:{children:ReactNode})=>createElement('main',null,children),SourceDetail:({children}:{children:ReactNode})=>createElement('section',null,children),DocumentList:()=>null,AddRecordButton:()=>null}));
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());host?.remove();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
it('a delayed or failed eligible-provider read is not presented as an empty care team',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 let resolve!:(r:Response)=>void;
 const pending=new Promise<Response>(r=>{resolve=r;});
 const document={id:'doc-one',title:'Synthetic source',status:'ready',revision:0,current_version_id:'version-one'};
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.endsWith('/providers')?pending:Promise.resolve(Response.json(url==='/api/documents'?{documents:[document]}:{document,versions:[{id:'version-one',version_no:1,extraction_status:'text_ready',mime:'text/plain',source_class:'original'}],chunks:[],grants:[]}))));
 host=documentCreate();root=createRoot(host);await act(async()=>root!.render(createElement(DocumentWorkspace,{initialDocumentId:'doc-one'})));
 const manage=[...host.querySelectorAll('button')].find(b=>b.textContent==='Manage sharing')!;
 await act(async()=>manage.click());
 expect(documentBody()).toContain('Loading eligible clinicians');expect(documentBody()).not.toContain('No eligible clinician');
 await act(async()=>resolve(Response.json({error:{code:'DEPENDENCY_UNAVAILABLE',message:'Unable to load clinicians.'}},{status:503})));
 expect(documentBody()).toContain('Eligible clinicians could not be loaded');expect(documentBody()).not.toContain('No eligible clinician');expect(documentBody()).not.toContain('Loading eligible clinicians');
});
function documentCreate(){const h=globalThis.document.createElement('div');globalThis.document.body.append(h);return h;}
function documentBody(){return globalThis.document.body.textContent??'';}
it('document workspace retains a confirmed OCR save notice when its following detail refresh fails',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubEnv('NEXT_PUBLIC_OCR_ENABLED','true');let committed=false;
 const doc={id:'doc-one',title:'Synthetic source',status:'ready',revision:1,current_version_id:'version-one'},detail={document:doc,versions:[{id:'version-one',version_no:1,extraction_status:'needs_transcription',mime:'image/png',source_class:'original'}],chunks:[],grants:[]};
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method){committed=true;return Response.json({data:{document_id:'doc-one',version_id:'reviewed-version'}});}if(url.endsWith('/ocr'))return Response.json({data:{id:'job-one',state:'succeeded',resultKind:'offline_fixture',result:{pages:[{page:1,text:'Synthetic review',unclear:[]}]}}});if(url==='/api/documents')return Response.json({documents:[doc]});if(committed)return Response.json({error:{code:'DOCUMENT_UNAVAILABLE'}},{status:503});return Response.json(detail);}));
 host=documentCreate();root=createRoot(host);await act(async()=>root!.render(createElement(DocumentWorkspace,{initialDocumentId:'doc-one'})));await act(async()=>host!.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());const save=[...host.querySelectorAll('button')].find(b=>b.textContent==='Save reviewed transcription')!;await act(async()=>save.click());expect(committed).toBe(true);expect(documentBody()).toContain('Reviewed transcription saved. The original is retained.');expect(documentBody()).toContain('Transcription saved, but the document could not be refreshed');expect(documentBody()).not.toContain('Request outcome unconfirmed');
});
it('a stale version navigation does not silently render a replacement source',async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const doc={id:'doc-one',title:'Synthetic replacement',status:'ready',revision:2,current_version_id:'new-version'};vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url==='/api/documents'?{documents:[doc]}:{document:doc,versions:[{id:'new-version',version_no:2,extraction_status:'text_ready',mime:'text/plain',source_class:'original'}],chunks:[],grants:[]})));host=documentCreate();root=createRoot(host);await act(async()=>root!.render(createElement(DocumentWorkspace,{initialDocumentId:'doc-one',initialVersionId:'old-version'})));expect(documentBody()).toContain('The cited source version is no longer current');expect(host.querySelector('a[href="/api/documents/doc-one/content"]')).toBeNull();});
it('OCR corrections survive focus revalidation while hidden, and denied access clears them',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubEnv('NEXT_PUBLIC_OCR_ENABLED','true');
 const doc={id:'doc-one',title:'Synthetic source',status:'ready',revision:1,current_version_id:'version-one'},detail={document:doc,versions:[{id:'version-one',version_no:1,extraction_status:'needs_transcription',mime:'image/png',source_class:'original'}],chunks:[],grants:[]};let pending:Promise<Response>|null=null;
 vi.stubGlobal('fetch',vi.fn((url:string)=>Promise.resolve(url.endsWith('/ocr')?Response.json({data:{id:'job',state:'succeeded',resultKind:'offline_fixture',result:{pages:[{page:1,text:'SYNTHETIC draft [unclear]',unclear:[]}]}}}):url==='/api/documents'?Response.json({documents:[doc]}):pending??Response.json(detail))));
 host=documentCreate();root=createRoot(host);await act(async()=>root!.render(createElement(DocumentWorkspace,{initialDocumentId:'doc-one'})));
 const textarea=host.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'SYNTHETIC corrected text');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
 let resolve!:(r:Response)=>void;pending=new Promise(r=>{resolve=r;});await act(async()=>window.dispatchEvent(new Event('focus')));expect(textarea.closest('[hidden]')).not.toBeNull();expect(host.textContent).toContain('Checking source access');
 await act(async()=>resolve(Response.json(detail)));expect(host.querySelector('textarea')?.value).toBe('SYNTHETIC corrected text');expect(host.querySelector('textarea')?.closest('[hidden]')).toBeNull();
 pending=Promise.resolve(Response.json({error:{code:'NOT_FOUND'}},{status:404}));await act(async()=>window.dispatchEvent(new Event('focus')));expect(host.querySelector('textarea')).toBeNull();expect(host.textContent).not.toContain('SYNTHETIC corrected text');
});
