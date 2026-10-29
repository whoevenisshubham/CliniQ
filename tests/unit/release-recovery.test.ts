import {it,expect,vi,afterEach} from 'vitest';
import {workerAuthorized} from '@/lib/server/jobs/authorization';
import {recover} from '../../scripts/release-recovery.mjs';
afterEach(()=>vi.unstubAllEnvs());
const sha='a'.repeat(40),secret='s'.repeat(40);
const ready={sourceSha:sha,providersEnabled:{text:false,speech:false,ocr:false},assets:{parser:true},recoveryStatus:{state:'stale',lastSuccess:'2020-01-01T00:00:00Z'}};
it('dedicated recovery credential cannot be confused with missing or dispatch headers',()=>{
 vi.stubEnv('RECOVERY_RUNNER_SECRET',secret);vi.stubEnv('DOCUMENT_DISPATCH_SECRET','d'.repeat(40));
 expect(workerAuthorized(new Request('https://example.invalid'))).toBe(false);
 expect(workerAuthorized(new Request('https://example.invalid',{headers:{'x-recovery-secret':secret}}))).toBe(true);
 expect(workerAuthorized(new Request('https://example.invalid',{headers:{'x-document-dispatch':secret}}))).toBe(false);
});
it('source mismatch or enabled provider stops before a claim',async()=>{
 for(const body of [{...ready,sourceSha:'b'.repeat(40)},{...ready,providersEnabled:{text:true}}]){
  const fetcher=vi.fn(async()=>Response.json(body));
  await expect(recover({origin:'https://cliniqplus.vercel.app',expectedSha:sha,secret,fetcher})).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
 }
});
it('awaits bounded sequential claims, reports stale last success and never retries a failed request',async()=>{
 const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>Response.json(init?.method==='GET'?ready:{sourceSha:sha,status:'idle',degraded:false}));
 const receipt=await recover({origin:'https://cliniqplus.vercel.app',expectedSha:sha,secret,fetcher});
 expect(receipt.statuses).toEqual(['idle']);expect(receipt.previousSuccessState).toBe('stale');expect(fetcher).toHaveBeenCalledTimes(3);
 const failed=vi.fn(async()=>new Response('',{status:503}));
 await expect(recover({origin:'https://cliniqplus.vercel.app',expectedSha:sha,secret,fetcher:failed})).rejects.toThrow('RECOVERY_HTTP_503');expect(failed).toHaveBeenCalledTimes(1);
});
