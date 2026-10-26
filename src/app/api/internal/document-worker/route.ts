import {workerAuthorized} from '@/lib/server/jobs/authorization';
import {workerClient} from '@/lib/server/jobs/client';
import {executeWork} from '@/lib/server/jobs/execution';
import {privateJson,errorResponse,HttpError} from '@/lib/server/http';
import {buildIdentity} from '@/lib/server/build-identity';
import {existsSync} from 'node:fs';
import path from 'node:path';
export const runtime='nodejs';
export const maxDuration=120;
export async function GET(request:Request){if(!workerAuthorized(request))return privateJson({error:{code:'FORBIDDEN'}},403);return privateJson({...buildIdentity(),mode:'awaited_one_job',assets:Object.fromEntries(['scripts/document-parser-worker.mjs','scripts/ocr-image-worker.mjs','node_modules/pdfjs-dist/cmaps','node_modules/pdfjs-dist/standard_fonts','node_modules/@napi-rs/canvas'].map(p=>[p,existsSync(path.join(process.cwd(),p))])),providersEnabled:{text:process.env.AI_ENABLED==='true',speech:process.env.SPEECH_ENABLED==='true',ocr:process.env.OCR_ENABLED==='true'}});}
export async function POST(request:Request){try{if(!workerAuthorized(request))throw new HttpError(403,'FORBIDDEN','Worker access denied.');if(request.body){await request.body.cancel();throw new HttpError(400,'EMPTY_BODY_REQUIRED','No caller-selected resources are accepted.');}const result=await executeWork(workerClient(3000),{reconcile:true});return privateJson(result,'degraded' in result&&result.degraded?503:200);}catch(e){return errorResponse(e);}}
