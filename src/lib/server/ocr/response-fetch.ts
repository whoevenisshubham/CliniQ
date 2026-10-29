// Bound the HTTP envelope before SDK JSON parsing, not just the draft string.
// A limit/read failure after send is uncertain and grants no refund/retry.
export const boundedOCRFetch:typeof fetch=async(input,init)=>{
 const response=await fetch(input,{...init,redirect:'error'});
 const length=response.headers.get('content-length');if(length&&Number(length)>65536){await response.body?.cancel();throw Error('OCR_RESPONSE_LIMIT');}
 if(!response.body)return response;
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
 const signal=init?.signal??(input instanceof Request?input.signal:undefined);let abort:()=>void;
 const stopped=new Promise<never>((_,reject)=>{abort=()=>{void reader.cancel().catch(()=>{});reject(Error('OCR_OUTCOME_UNKNOWN'));};if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
 try{while(true){const r=await Promise.race([reader.read(),stopped]);if(r.done)break;size+=r.value.length;if(size>65536){await reader.cancel();throw Error('OCR_RESPONSE_LIMIT');}parts.push(r.value);}if(signal?.aborted)throw Error('OCR_OUTCOME_UNKNOWN');}catch(e){void reader.cancel().catch(()=>{});throw e;}finally{signal?.removeEventListener('abort',abort!);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 return new Response(bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
};
