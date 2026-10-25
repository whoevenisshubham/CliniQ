import {Worker} from 'node:worker_threads';
import path from 'node:path';
export type OCRImage={page:number;width:number;height:number;bytes:Uint8Array};
let active=false;
export function renderOCRImages(bytes:Uint8Array,mime:string,pages:number[],signal?:AbortSignal):Promise<OCRImage[]>{
 if(signal?.aborted)return Promise.reject(Error('CANCELLED'));
 if(active)return Promise.reject(Error('IMAGE_BUSY'));
 active=true;
 return new Promise((resolve,reject)=>{
  let worker:Worker;try{worker=new Worker(path.join(process.cwd(),'scripts/ocr-image-worker.mjs'),{workerData:{bytes,mime,pages},resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32}});}catch{active=false;reject(Error('IMAGE_UNAVAILABLE'));return;}
  let done=false;
  const finish=(error?:Error,result?:OCRImage[])=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   // Do not release the process raster slot while native work is still alive.
   void worker.terminate().catch(()=>{}).finally(()=>{active=false;if(error)reject(error);else resolve(result!);});};
  const abort=()=>finish(Error('CANCELLED'));const timer=setTimeout(()=>finish(Error('IMAGE_DEADLINE')),15000);signal?.addEventListener('abort',abort,{once:true});
  worker.once('error',()=>finish(Error('IMAGE_UNAVAILABLE')));worker.once('exit',()=>finish(Error('IMAGE_EXIT')));
  worker.once('message',(r:{error?:string;pages?:OCRImage[]})=>{if(r.error){finish(Error(r.error));return;}const out=r.pages;
   if(!Array.isArray(out)||out.length!==pages.length||out.some((p,i)=>p.page!==pages[i]||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>1600||p.height>1600||!(p.bytes instanceof Uint8Array))||out.reduce((n,p)=>n+p.bytes.length,0)>2097152){finish(Error('IMAGE_RESULT'));return;}finish(undefined,out);});
 });
}
