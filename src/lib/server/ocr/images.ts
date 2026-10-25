import {Worker} from 'node:worker_threads';
import path from 'node:path';
export type OCRImage={page:number;width:number;height:number;bytes:Uint8Array};
export function renderOCRImages(bytes:Uint8Array,mime:string,pages:number[],signal?:AbortSignal):Promise<OCRImage[]>{
 return new Promise((resolve,reject)=>{if(signal?.aborted){reject(Error('CANCELLED'));return;}const worker=new Worker(path.join(process.cwd(),'scripts/ocr-image-worker.mjs'),{workerData:{bytes,mime,pages},resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32}});let done=false;const finish=(error?:Error,result?:OCRImage[])=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();if(error)reject(error);else resolve(result!);};const abort=()=>finish(Error('CANCELLED'));const timer=setTimeout(()=>finish(Error('IMAGE_DEADLINE')),15000);signal?.addEventListener('abort',abort,{once:true});worker.once('error',()=>finish(Error('IMAGE_UNAVAILABLE')));worker.once('exit',()=>finish(Error('IMAGE_EXIT')));worker.once('message',(r:{error?:string;pages:OCRImage[]})=>finish(r.error?Error(r.error):undefined,r.pages));});
}
