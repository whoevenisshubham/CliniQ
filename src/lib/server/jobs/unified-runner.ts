import type { SupabaseClient } from '@supabase/supabase-js';
import { runDocumentJob } from './runner';
import { runAIJob } from '../ai/runner';
import {recoverSubsystems,failedRecoveries} from './recovery';
import {runOCRJob} from '../ocr/runner';
export async function runNextJob(admin: SupabaseClient, jobId?: string) {
    const recovery=await recoverSubsystems(admin),degraded=failedRecoveries(recovery).length>0;
    const now = new Date().toISOString();
    let query = admin.from('document_jobs').select('id,kind');
    query = jobId ? query.eq('id', jobId) : query.lte('available_at', now).or(`status.eq.queued,and(status.eq.running,lease_until.lt.${now})`).order('created_at').limit(1);
    // An AI recovery outage must not starve independent document jobs. Explicit
    // AI requests remain blocked until that subsystem recovers; never resend.
    if(!jobId&&recovery.ai.state==='failed')query=query.in('kind',['ingest_document','purge_document']);
    const rows = await query;
    if (rows.error)
        throw new Error('JOB_DATABASE_UNAVAILABLE');
    const job = rows.data?.[0];
    if (!job)
        return { status: degraded?'recovery_degraded':'idle',degraded,recovery };
    const document=['ingest_document','purge_document'].includes(job.kind);
    if(!document&&recovery.ai.state==='failed')return {jobId:job.id,status:'recovery_blocked',degraded:true,recovery};
    const result=await(document?runDocumentJob(admin,job.id):job.kind==='ocr_document'?runOCRJob(admin,job.id):runAIJob(admin,job.id));
    return {...result,degraded,recovery};
}
