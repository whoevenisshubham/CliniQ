import type {SupabaseClient} from '@supabase/supabase-js';
import {runNextJob} from './unified-runner';
import {reconcileDocuments} from './runner';
import {buildIdentity} from '../build-identity';
// One awaited invocation, not an in-memory queue or detached promise. SQL owns
// claims, fences, source scope, cancellation and uncertain-send recovery.
export async function executeWork(admin:SupabaseClient,input:{documentId?:string;jobId?:string;reconcile?:boolean}={}){
 let cleanup:{cleaned:number}|null=null;
 if(input.reconcile)cleanup=await reconcileDocuments(admin,false);
 let jobId=input.jobId;
 if(input.documentId&&!jobId){const now=new Date().toISOString();let query=admin.from('document_jobs').select('id').eq('document_id',input.documentId).lte('available_at',now).or(`status.eq.queued,and(status.eq.running,lease_until.lt.${now})`).order('created_at').limit(1);if(process.env.OCR_ENABLED!=='true')query=query.neq('kind','ocr_document');const q=await query;if(q.error)throw Error('WORKER_DATABASE_UNAVAILABLE');jobId=q.data?.[0]?.id;if(!jobId)return{status:'idle',cleanup,...buildIdentity()};}
 const result=await runNextJob(admin,jobId);
 return{...result,cleanup,...buildIdentity()};
}
