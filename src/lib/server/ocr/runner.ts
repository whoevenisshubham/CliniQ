import type {SupabaseClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {renderOCRImages} from './images';
import {ocrProvider,validateOCR,type OCRProvider} from './provider';
import {ProviderFailure} from '../ai/failure';
function check(e:unknown){if(e)throw Error('OCR_DATABASE_UNAVAILABLE');}
export async function runOCRJob(admin:SupabaseClient,jobId:string,offline?:OCRProvider,signal=AbortSignal.timeout(60000)){
 const claim=await admin.rpc('ai_claim',{p_id:jobId});check(claim.error);const j=claim.data?.[0];if(!j)return{status:'idle'};
 if(j.kind!=='ocr_document')throw Error('OCR_JOB_REQUIRED');
 const publish=async()=>{const r=await admin.rpc('ai_publish',{jid:j.id,f:j.fence});check(r.error);return{jobId:j.id,status:r.data?'review_required':'stale'};};
 if(j.result!==null&&j.provider_attempt_id)return publish();
 const unavailable=async(reason:string)=>{const r=await admin.rpc('ocr_before_send_fail',{jid:j.id,f:j.fence,reason});check(r.error);return{jobId:j.id,status:r.data?'unavailable':'stale'};};
 const provider=offline??ocrProvider();if(!provider)return unavailable('PROVIDER_DISABLED');
 if(offline&&offline.mode!=='offline_fixture')throw Error('OFFLINE_PROVIDER_REQUIRED');
 let images;
 try{const v=await admin.from('document_versions').select('object_key,mime,sha256,byte_size').eq('id',j.version_id).eq('document_id',j.document_id).single();check(v.error);const file=await admin.storage.from('clinical-documents').download(v.data!.object_key);if(file.error||!file.data)throw Error('BYTES_UNAVAILABLE');const bytes=new Uint8Array(await file.data.arrayBuffer());if(bytes.length!==v.data!.byte_size||bytes.length>4194304||createHash('sha256').update(bytes).digest('hex')!==j.input_snapshot.byteHash)throw Error('BYTE_INTEGRITY');images=await renderOCRImages(bytes,v.data!.mime,j.input_snapshot.pages,signal);}catch{return unavailable('OCR_SOURCE_UNREADABLE');}
 if(signal.aborted){await unavailable('CANCELLED_BEFORE_SEND');return{jobId:j.id,status:'cancelled'};}
 // Conservative reservation of the full available input bound for vision.
 // Live verification must reconcile actual model image-token accounting first.
 const reserved=await admin.rpc('ai_reserve',{jid:j.id,f:j.fence,execution_mode:provider.mode,model_name:provider.model,input_bound:50000,output_bound:3000,budget_ref:provider.authorizationRef});check(reserved.error);if(!reserved.data)return{jobId:j.id,status:'not_admitted'};
 const deadline=AbortSignal.any([signal,AbortSignal.timeout(45000)]);let reply;
 try{reply=await Promise.race([provider.execute(images,deadline),new Promise<never>((_,reject)=>{if(deadline.aborted)reject(Error('OCR_OUTCOME_UNKNOWN'));else deadline.addEventListener('abort',()=>reject(Error('OCR_OUTCOME_UNKNOWN')),{once:true});})]);}
 catch(e){if(e instanceof ProviderFailure&&e.definite){const r=await admin.rpc('ai_record_response',{jid:j.id,f:j.fence,aid:reserved.data,p_result:{reason:e.category},p_kind:provider.mode==='offline_fixture'?'offline_fixture':'generated',p_state:'unavailable',used_input:null,used_output:null});check(r.error);if(r.data)await publish();return{jobId:j.id,status:'unavailable'};}const u=await admin.rpc('ai_unknown',{jid:j.id,f:j.fence});check(u.error);return{jobId:j.id,status:'outcome_unknown'};}
 let result:unknown,state='succeeded';try{if(deadline.aborted)throw Error('OCR_DEADLINE');result={...validateOCR(reply.text,reply.finishReason,j.input_snapshot.pages),requiresReview:true,confidence:'uncalibrated'};}catch{result={reason:'OCR_OUTPUT_REJECTED'};state='rejected';}
 const r=await admin.rpc('ai_record_response',{jid:j.id,f:j.fence,aid:reserved.data,p_result:result,p_kind:provider.mode==='offline_fixture'?'offline_fixture':'generated',p_state:state,used_input:null,used_output:null});check(r.error);if(!r.data)return{jobId:j.id,status:'stale'};
 const p=await publish();return{...p,status:p.status==='stale'?'stale':state==='succeeded'?'review_required':state};
}
