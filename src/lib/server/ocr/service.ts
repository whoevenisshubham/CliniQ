import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {resolvePrincipal} from '../auth/context';
import {HttpError} from '../http';
import {id} from '../documents/service';
export function ocrCapability(){return process.env.OCR_ENABLED==='true';}
export function ocrCheck(error:{message:string;code?:string}|null){if(!error)return;const status:Record<string,number>={AUTH_REQUIRED:401,NOT_FOUND:404,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,OCR_ALREADY_REQUESTED:409,INVALID_PAGES:422,OCR_SOURCE_UNSUPPORTED:422,OPERATION_LIMIT:429,REVIEW_UNAVAILABLE:409};throw new HttpError(status[error.message]??503,status[error.message]?error.message:'OCR_UNAVAILABLE','Text extraction could not be completed. Your original is retained; manual transcription remains available.');}
export async function admitOCR(client:SupabaseClient,did:string,key:string,input:{threadId:string;versionId:string;revision:number;pages:number[]}){
 await resolvePrincipal(client);[did,key,input.threadId,input.versionId].forEach(id);if(!ocrCapability())throw new HttpError(503,'OCR_DISABLED','Optional text extraction is disabled. Add a manual transcript instead.');
 if(!Number.isInteger(input.revision)||input.revision<0||!Array.isArray(input.pages)||input.pages.length<1||input.pages.length>2||new Set(input.pages).size!==input.pages.length||input.pages.some(p=>!Number.isInteger(p)||p<1||p>20))throw new HttpError(422,'INVALID_PAGES','Select one image or up to two scanned PDF pages.');
 const r=await client.rpc('ocr_admit',{k:key,tid:input.threadId,did,vid:input.versionId,expected:input.revision,pages:input.pages});ocrCheck(r.error);return r.data as string;
}
export async function saveOCRReview(client:SupabaseClient,admin:SupabaseClient,jid:string,key:string,input:{title:string;pages:{page:number;text:string}[]}){
 const actor=await resolvePrincipal(client);[jid,key].forEach(id);if(actor.role!=='patient')throw new HttpError(403,'OWNER_REQUIRED','The patient owner must review and save a transcript.');if(!ocrCapability())throw new HttpError(503,'OCR_DISABLED','Optional OCR review is disabled. Manual transcription remains available.');
 if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>160||!Array.isArray(input.pages)||input.pages.length<1||input.pages.length>2||input.pages.some(p=>!Number.isInteger(p.page)||typeof p.text!=='string'||!p.text.trim()||p.text.length>8000||p.text.includes('\f'))||input.pages.reduce((n,p)=>n+p.text.length,0)>12000)throw new HttpError(422,'INVALID_REVIEW','Correct and review each selected page before saving.');
 // RLS rechecks current authorization. On a committed same-key recovery the
 // exact operation fingerprint below remains sufficient; no resend/provider call.
 const owned=await admin.from('document_jobs').select('id,actor_id,input_snapshot,request').eq('id',jid).eq('kind','ocr_document').eq('actor_id',actor.id).maybeSingle();ocrCheck(owned.error);if(!owned.data)throw new HttpError(404,'NOT_FOUND','OCR draft unavailable.');const pages=owned.data.input_snapshot.pages as number[];if(JSON.stringify(pages)!==JSON.stringify(input.pages.map(p=>p.page)))throw new HttpError(422,'INVALID_PAGES','Original page references must be retained.');
 const bytes=new TextEncoder().encode(input.pages.map(p=>p.text.trim()).join('\f')),sha=createHash('sha256').update(bytes).digest('hex');const r=await client.rpc('ocr_review_admit',{k:key,jid,sha,bytes:bytes.length,title:input.title.trim()});ocrCheck(r.error);const op=r.data;
 if(op.state==='committed')return{document_id:op.document_id,version_id:op.version_id};
 if(op.state==='reserved'){const stored=await admin.storage.from('clinical-documents').upload(op.object_key,bytes,{contentType:'text/plain',upsert:false});if(stored.error){const existing=await admin.storage.from('clinical-documents').download(op.object_key);if(existing.error||!existing.data||createHash('sha256').update(new Uint8Array(await existing.data.arrayBuffer())).digest('hex')!==sha)throw new HttpError(503,'REVIEW_SAVE_UNCONFIRMED','Save could not be confirmed. Reconcile the same request.');}const stage=await admin.rpc('document_upload_stage',{p_operation:op.id,p_stage:'stored'});ocrCheck(stage.error);}
 const committed=await admin.rpc('document_commit',{p_operation:op.id});ocrCheck(committed.error);return committed.data;
}
