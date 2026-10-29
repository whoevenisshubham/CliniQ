import {workerAuthorized} from '@/lib/server/jobs/authorization';
import {observeWorker,workerStatus} from '@/lib/server/jobs/observation';
import {workerClient} from '@/lib/server/jobs/client';
import {executeWork} from '@/lib/server/jobs/execution';
import {privateJson,errorResponse,HttpError} from '@/lib/server/http';
import {buildIdentity} from '@/lib/server/build-identity';
import {existsSync} from 'node:fs';
import path from 'node:path';
export const runtime='nodejs';
export const maxDuration=120;
export async function GET(request:Request){if(!workerAuthorized(request))return privateJson({error:{code:'FORBIDDEN'}},403);return privateJson({...buildIdentity(),recoveryStatus:await workerStatus(workerClient(3000)),mode:'awaited_one_job',assets:Object.fromEntries(['scripts/document-parser-worker.mjs','scripts/ocr-image-worker.mjs','node_modules/pdfjs-dist/cmaps','node_modules/pdfjs-dist/standard_fonts','node_modules/@napi-rs/canvas'].map(p=>[p,existsSync(path.join(process.cwd(),p))])),providersEnabled:{text:process.env.AI_ENABLED==='true',speech:process.env.SPEECH_ENABLED==='true',ocr:process.env.OCR_ENABLED==='true'}});}
async function requireEmptyBody(request:Request){
 if(!request.body)return;
 // Next can provide a stream for a zero-byte POST. Inspect one bounded read,
 // rather than rejecting the existence of the stream or buffering input.
 const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined;
 try{const first=await Promise.race([reader.read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new HttpError(408,'BODY_TIMEOUT','Finish the empty request.')),2000);})]);if(!first.done)throw new HttpError(400,'EMPTY_BODY_REQUIRED','No caller-selected resources are accepted.');}
 finally{clearTimeout(timer);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function POST(request:Request){try{if(!workerAuthorized(request))throw new HttpError(403,'FORBIDDEN','Worker access denied.');await requireEmptyBody(request);const admin=workerClient(3000),id=crypto.randomUUID(),started=Date.now(),source=buildIdentity().sourceSha;let result;
try{result=await executeWork(admin,{reconcile:true});}catch(e){await observeWorker(admin,id,source,{status:'failed'},Date.now()-started).catch(()=>{});throw e;}
const outcome=await observeWorker(admin,id,source,result,Date.now()-started);return privateJson({...result,observationId:id},outcome==='ok'?200:503);}catch(e){return errorResponse(e);}}
