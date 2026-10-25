import {Worker} from 'node:worker_threads';
import path from 'node:path';
export type OCRImage={page:number;width:number;height:number;bytes:Uint8Array};
let active=false;
let waiting:{start:()=>void;cancel:()=>void}|null=null;
function release(){const next=waiting;waiting=null;if(next)next.start();else active=false;}
export function renderOCRImages(bytes:Uint8Array,mime:string,pages:number[],signal?:AbortSignal):Promise<OCRImage[]>{
 if(signal?.aborted)return Promise.reject(Error('CANCELLED'));
 // A two-page review requests two originals concurrently. Permit one bounded
 // waiter, never a second native worker or an unbounded input-buffer queue.
 if(active){if(waiting)return Promise.reject(Error('IMAGE_BUSY'));return new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};const cancel=()=>{if(waiting===entry)waiting=null;cleanup();reject(Error('CANCELLED'));};const entry={start:()=>{cleanup();if(signal?.aborted){release();reject(Error('CANCELLED'));}else resolve(start());},cancel};const timer=setTimeout(()=>{if(waiting===entry)waiting=null;cleanup();reject(Error('IMAGE_BUSY'));},20000);waiting=entry;signal?.addEventListener('abort',cancel,{once:true});});}
 active=true;return start();
 function start(){return new Promise<OCRImage[]>((resolve,reject)=>{
  let worker:Worker;try{worker=new Worker(path.join(process.cwd(),'scripts/ocr-image-worker.mjs'),{workerData:{bytes,mime,pages},resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32}});}catch{release();reject(Error('IMAGE_UNAVAILABLE'));return;}
  let done=false;
  const finish=(error?:Error,result?:OCRImage[])=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   // Do not release the process raster slot while native work is still alive.
   void worker.terminate().then(()=>{release();if(error)reject(error);else resolve(result!);},()=>{
    // Unknown native termination must not permit another renderer in this
    // process. Fail closed until the function instance is recycled.
    waiting?.cancel();reject(Error('IMAGE_TERMINATION_UNCONFIRMED'));
   });};
  const abort=()=>finish(Error('CANCELLED'));const timer=setTimeout(()=>finish(Error('IMAGE_DEADLINE')),15000);signal?.addEventListener('abort',abort,{once:true});
  worker.once('error',()=>finish(Error('IMAGE_UNAVAILABLE')));worker.once('exit',()=>finish(Error('IMAGE_EXIT')));
  worker.once('message',(r:{error?:string;pages?:OCRImage[]})=>{if(r.error){finish(Error(r.error));return;}const out=r.pages;
   if(!Array.isArray(out)||out.length!==pages.length||out.some((p,i)=>p.page!==pages[i]||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>1600||p.height>1600||!(p.bytes instanceof Uint8Array))||out.reduce((n,p)=>n+p.bytes.length,0)>2097152){finish(Error('IMAGE_RESULT'));return;}finish(undefined,out);});
 });}
}
