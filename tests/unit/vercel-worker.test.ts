import {afterEach,expect,it,vi} from 'vitest';
import {workerAuthorized} from '@/lib/server/jobs/authorization';
const runtime=vi.hoisted(()=>({execute:vi.fn(),client:vi.fn(()=>({synthetic:true}))}));
vi.mock('@/lib/server/jobs/execution',()=>({executeWork:runtime.execute}));
vi.mock('@/lib/server/jobs/client',()=>({workerClient:runtime.client}));
import {dispatchDocumentWork} from '@/lib/server/jobs/dispatch';
import {POST} from '@/app/api/internal/document-worker/route';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
it('Vercel waits for scoped durable execution and never sends a Netlify self-request',async()=>{
 vi.stubEnv('VERCEL','1');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 let finish!:()=>void;runtime.execute.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 let returned=false;const pending=dispatchDocumentWork({documentId:'owner-document'}).then(r=>{returned=true;return r;});
 await vi.waitFor(()=>expect(runtime.execute).toHaveBeenCalledWith({synthetic:true},{documentId:'owner-document'}));
 expect(returned).toBe(false);finish();expect(await pending).toBe(true);expect(fetch).not.toHaveBeenCalled();
 runtime.execute.mockRejectedValueOnce(Error('synthetic database failure'));expect(await dispatchDocumentWork()).toBe(false);
});
it('worker secret is mandatory, exact and bounded; no caller-selected or chunked body reaches claims',async()=>{
 vi.stubEnv('DOCUMENT_DISPATCH_SECRET','a'.repeat(40));
 for(const secret of ['', 'a'.repeat(39),'b'.repeat(40),'a'.repeat(513)])expect(workerAuthorized(new Request('https://preview/api',{headers:{'x-document-dispatch':secret}}))).toBe(false);
 const headers={'x-document-dispatch':'a'.repeat(40)};
 expect(workerAuthorized(new Request('https://preview/api',{headers}))).toBe(true);
 expect((await POST(new Request('https://preview/api',{method:'POST'}))).status).toBe(403);
 expect((await POST(new Request('https://preview/api',{method:'POST',headers,body:'{"jobId":"arbitrary"}'}))).status).toBe(400);
 expect(runtime.execute).not.toHaveBeenCalled();
 runtime.execute.mockResolvedValueOnce({status:'idle',degraded:false});
 expect((await POST(new Request('https://preview/api',{method:'POST',headers}))).status).toBe(200);
 expect(runtime.execute).toHaveBeenCalledWith({synthetic:true},{reconcile:true});
});
