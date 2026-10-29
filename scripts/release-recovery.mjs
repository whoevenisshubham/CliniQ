import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Reviewed release-time runner. No schedule is installed by this module.
/** @param {{origin:string,expectedSha:string,secret:string,maxJobs?:number,fetcher?:typeof fetch}} options */
export async function recover({origin,expectedSha,secret,maxJobs=3,fetcher=fetch}){
 const u=new URL(origin);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!/^([a-z0-9-]+\.)*(vercel\.app|netlify\.app)$/.test(u.hostname))throw Error('INVALID_PREVIEW_ORIGIN');
 if(!/^[a-f0-9]{40}$/.test(expectedSha)||typeof secret!=='string'||secret.length<32||!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>3)throw Error('INVALID_RECOVERY_CONFIGURATION');
 const headers={'x-recovery-secret':secret};
 async function request(method){
  const r=await fetcher(new URL('/api/internal/document-worker',u),{method,headers,redirect:'error',signal:AbortSignal.timeout(125000)});
  if(!r.ok)throw Error(`RECOVERY_HTTP_${r.status}`);
  const b=await r.json();
  if(b.sourceSha!==expectedSha)throw Error('RECOVERY_SOURCE_MISMATCH');
  return b;
 }
 const identity=await request('GET');
 if(!identity.providersEnabled||Object.values(identity.providersEnabled).some(v=>v!==false))throw Error('LIVE_EXECUTION_MUST_BE_DISABLED');
 if(!identity.assets||Object.values(identity.assets).some(v=>v!==true))throw Error('RECOVERY_ASSETS_UNAVAILABLE');
 if(!['unknown','stale','recent'].includes(identity.recoveryStatus?.state))throw Error('RECOVERY_STATUS_UNAVAILABLE');
 const statuses=[];
 for(let i=0;i<maxJobs;i++){
  // Recheck source and disabled execution before each bounded claim.
  const ready=await request('GET');
  if(Object.values(ready.providersEnabled??{unknown:true}).some(v=>v!==false))throw Error('LIVE_EXECUTION_MUST_BE_DISABLED');
  const r=await request('POST');
  if(r.degraded||!['idle','succeeded','text_ready','needs_transcription','encrypted','empty','unsupported','retry_queued','failed','stale'].includes(r.status))throw Error('RECOVERY_NOT_CONFIRMED');
  statuses.push(r.status);
  if(r.status==='failed'||r.status==='stale')throw Error('RECOVERY_JOB_FAILED');
  if(r.status==='idle')break;
 }
 return {sourceSha:expectedSha,origin:u.origin,completedAt:new Date().toISOString(),statuses,previousSuccess:identity.recoveryStatus.lastSuccess,previousSuccessState:identity.recoveryStatus.state,scope:'bounded manual recovery; not unattended acceptance'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const receipt=await recover({origin:process.env.RECOVERY_ORIGIN??'',expectedSha:process.env.RECOVERY_SOURCE_SHA??'',secret:process.env.RECOVERY_RUNNER_SECRET??''});
  await writeFile('recovery-receipt.json',JSON.stringify(receipt,null,2));
  console.log(JSON.stringify(receipt));
 }catch{console.error('RECOVERY_FAILED: inspect source, authorization and bounded worker state; no request is automatically retried.');process.exitCode=1;}
}
