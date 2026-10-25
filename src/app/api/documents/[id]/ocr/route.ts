import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {privateJson,requireSameOrigin,errorResponse,HttpError,readJson} from '@/lib/server/http';
import {resolvePrincipal} from '@/lib/server/auth/context';
import {id} from '@/lib/server/documents/service';
import {ocrReady,admitOCR,saveOCRReview,ocrCheck} from '@/lib/server/ocr/service';
import {createThread,jobView} from '@/lib/server/ai/service';
import {dispatchDocumentWork} from '@/lib/server/jobs/dispatch';
async function context(did:string){id(did);const client=await getSupabaseServerClient();await resolvePrincipal(client);const d=await client.from('documents').select('id').eq('id',did).maybeSingle();ocrCheck(d.error);if(!d.data)throw new HttpError(404,'NOT_FOUND','Record unavailable.');return client;}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const did=(await params).id,client=await context(did);if(!await ocrReady(client))return privateJson({data:{available:false}});const jid=new URL(request.url).searchParams.get('job');if(jid)id(jid);let query=client.from('document_jobs').select('id').eq('document_id',did).eq('kind','ocr_document');query=jid?query.eq('id',jid):query.order('created_at',{ascending:false}).limit(1);const j=await query.maybeSingle();ocrCheck(j.error);if(!j.data){if(jid)throw new HttpError(404,'NOT_FOUND','Draft unavailable.');return privateJson({data:{available:true}});}return privateJson({data:await jobView(client,getSupabaseAdminClient(),j.data.id)});}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 requireSameOrigin(request);const did=(await params).id,client=await context(did);if(!await ocrReady(client))throw new HttpError(503,'OCR_DISABLED','Optional text extraction is disabled. Manual transcription remains available.');
 const b=await readJson(request,60000) as Record<string,unknown>,key=request.headers.get('idempotency-key')??'';id(key);if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.action!=='string')throw new HttpError(422,'INVALID_COMMAND','An extraction action is required.');
 const fields:Record<string,string[]>={extract:['action','versionId','revision','pages','consultationId'],review:['action','jobId','versionId','revision','title','pages','confirmed'],cancel:['action','jobId']};const action=String(b.action);if(!Object.hasOwn(fields,action)||Object.keys(b).some(k=>!fields[action].includes(k)))throw new HttpError(422,'INVALID_COMMAND','Choose a supported extraction action.');
 if(b.action==='extract'){
  id(b.versionId);if(b.consultationId!==undefined&&b.consultationId!==null)id(b.consultationId);
  if(!Number.isInteger(b.revision)||Number(b.revision)<0||!Array.isArray(b.pages)||b.pages.length<1||b.pages.length>2||new Set(b.pages).size!==b.pages.length||b.pages.some(p=>!Number.isInteger(p)||p<1||p>20))throw new HttpError(422,'INVALID_PAGES','Select one or two distinct source pages.');
  const previous=await client.from('document_jobs').select('id,request,status').eq('document_id',did).eq('version_id',b.versionId).eq('input_revision',b.revision).eq('kind','ocr_document').maybeSingle();ocrCheck(previous.error);
  if(previous.data){if(JSON.stringify(previous.data.request.pages)!==JSON.stringify(b.pages))throw new HttpError(409,'OCR_ALREADY_REQUESTED','This source already has an extraction operation. Review its saved status.');if(previous.data.status==='queued')await dispatchDocumentWork();return privateJson({data:{jobId:previous.data.id}},202);}
  const tid=await createThread(client,key,(b.consultationId??null) as string|null);const jid=await admitOCR(client,did,key,{threadId:tid,versionId:b.versionId as string,revision:b.revision as number,pages:b.pages as number[]});await dispatchDocumentWork();return privateJson({data:{jobId:jid}},202);
 }
 id(b.jobId);const owned=await getSupabaseAdminClient().from('document_jobs').select('document_id,version_id,input_revision').eq('id',b.jobId).eq('actor_id',(await resolvePrincipal(client)).id).eq('kind','ocr_document').maybeSingle();ocrCheck(owned.error);if(owned.data?.document_id!==did)throw new HttpError(404,'NOT_FOUND','Draft unavailable.');
 if(b.action==='cancel'){const r=await client.rpc('ocr_cancel',{jid:b.jobId});ocrCheck(r.error);return privateJson({data:{cancelled:r.data}});}
 if(b.versionId!==owned.data.version_id||b.revision!==owned.data.input_revision)throw new HttpError(409,'REVISION_CONFLICT','The reviewed source changed. Refresh its status.');
 if(b.confirmed!==true)throw new HttpError(422,'REVIEW_REQUIRED','Review every page against the original before saving.');const result=await saveOCRReview(client,getSupabaseAdminClient(),b.jobId as string,key,{title:b.title as string,pages:b.pages as {page:number;text:string}[]});await dispatchDocumentWork();return privateJson({data:result});
}catch(e){return errorResponse(e);}}
