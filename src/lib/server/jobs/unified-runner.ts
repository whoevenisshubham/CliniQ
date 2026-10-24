import type { SupabaseClient } from '@supabase/supabase-js';
import { runDocumentJob } from './runner';
import { runAIJob } from '../ai/runner';
export async function runNextJob(admin: SupabaseClient, jobId?: string) {
    const recovery = await admin.rpc('ai_reconcile');
    if (recovery.error)
        throw new Error('JOB_RECOVERY_UNAVAILABLE');
    const speech=await admin.rpc('speech_reconcile');
    if(speech.error)throw new Error('SPEECH_RECOVERY_UNAVAILABLE');
    const now = new Date().toISOString();
    let query = admin.from('document_jobs').select('id,kind');
    query = jobId ? query.eq('id', jobId) : query.lte('available_at', now).or(`status.eq.queued,and(status.eq.running,lease_until.lt.${now})`).order('created_at').limit(1);
    const rows = await query;
    if (rows.error)
        throw new Error('JOB_DATABASE_UNAVAILABLE');
    const job = rows.data?.[0];
    if (!job)
        return { status: 'idle' };
    return ['ingest_document', 'purge_document'].includes(job.kind) ? runDocumentJob(admin, job.id) : runAIJob(admin, job.id);
}
