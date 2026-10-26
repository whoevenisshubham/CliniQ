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
it('accepts the zero-byte stream supplied by hosted Next and bounds an unfinished body before claims',async()=>{
 vi.stubEnv('DOCUMENT_DISPATCH_SECRET','a'.repeat(40));const headers={'x-document-dispatch':'a'.repeat(40)};
 runtime.execute.mockResolvedValueOnce({status:'idle',degraded:false});
 const empty=new Request('https://preview/api',{method:'POST',headers,body:new ReadableStream({start(controller){controller.close();}}),duplex:'half'} as RequestInit);
 expect((await POST(empty)).status).toBe(200);expect(runtime.execute).toHaveBeenCalledOnce();runtime.execute.mockClear();
 vi.useFakeTimers();try{const unfinished=new Request('https://preview/api',{method:'POST',headers,body:new ReadableStream(),duplex:'half'} as RequestInit);const pending=POST(unfinished);await vi.advanceTimersByTimeAsync(2001);expect((await pending).status).toBe(408);expect(runtime.execute).not.toHaveBeenCalled();}finally{vi.useRealTimers();}
});
