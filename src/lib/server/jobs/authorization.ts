import {timingSafeEqual} from 'node:crypto';
function matches(expected:string,supplied:string){return expected.length>=32&&supplied.length<=512&&Buffer.byteLength(expected)===Buffer.byteLength(supplied)&&timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));}
export function workerAuthorized(request:Request){
 return matches(process.env.DOCUMENT_DISPATCH_SECRET??'',request.headers.get('x-document-dispatch')??'')||
  matches(process.env.RECOVERY_RUNNER_SECRET??'',request.headers.get('x-recovery-secret')??'');
}
