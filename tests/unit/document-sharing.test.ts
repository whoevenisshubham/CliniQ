// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3000/"}
import {afterEach,expect,it,vi} from 'vitest';
import {act,createElement,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {DocumentWorkspace} from '@/components/documents/DocumentWorkspace';
vi.mock('@/components/documents/DocumentSurface',()=>({RecordLayout:({children}:{children:ReactNode})=>createElement('main',null,children),SourceDetail:({children}:{children:ReactNode})=>createElement('section',null,children),DocumentList:()=>null,AddRecordButton:()=>null}));
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());host?.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
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
