import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDocument } from "../documents/parser";
function dbError(error: unknown) {
  if (error) throw new Error("DOCUMENT_DATABASE_UNAVAILABLE");
}
import { createHash } from "node:crypto";
export async function runDocumentJob(admin: SupabaseClient, jobId?: string) {
  const claim = await admin.rpc("document_claim", { p_id: jobId ?? null });
  dbError(claim.error);
  const job = claim.data?.[0];
  if (!job) return { status: "idle" };
  try {
    if (job.kind === "purge_document") {
      const versions = await admin
        .from("document_versions")
        .select("object_key")
        .eq("document_id", job.document_id);
      dbError(versions.error);
      const pending = await admin
        .from("upload_operations")
        .select("object_key")
        .eq("document_id", job.document_id)
        .neq("state", "committed");
      dbError(pending.error);
      const keys = [
        ...new Set(
          [...(versions.data ?? []), ...(pending.data ?? [])].map(
            (x) => x.object_key,
          ),
        ),
      ];
      if (keys.length) {
        const removed = await admin.storage
          .from("clinical-documents")
          .remove(keys);
        if (removed.error) throw new Error("PURGE_FAILED");
      }
      const done = await admin.rpc("document_purge_complete", {
        p_job: job.id,
        p_fence: job.fence,
      });
      dbError(done.error);
      return { jobId: job.id, status: done.data ? "succeeded" : "stale" };
    }
    const d = await admin
      .from("documents")
      .select("status,revision,current_version_id")
      .eq("id", job.document_id)
      .single();
    dbError(d.error);
    if (
      d.data!.status !== "ready" ||
      d.data!.revision !== job.input_revision ||
      d.data!.current_version_id !== job.version_id
    )
      return { jobId: job.id, status: "stale" };
    const v = await admin
      .from("document_versions")
      .select("object_key,mime,sha256,byte_size")
      .eq("id", job.version_id)
      .single();
    dbError(v.error);
    const file = await admin.storage
      .from("clinical-documents")
      .download(v.data!.object_key);
    if (file.error || !file.data) throw new Error("BYTES_UNAVAILABLE");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    if (
      bytes.length !== v.data!.byte_size ||
      createHash("sha256").update(bytes).digest("hex") !== v.data!.sha256
    )
      throw new Error("BYTE_INTEGRITY");
    const parsed = await parseDocument(bytes, v.data!.mime);
    const published = await admin.rpc("document_publish", {
      p_job: job.id,
      p_fence: job.fence,
      p_status: parsed.status,
      p_pages: parsed.pages,
      p_chunks: parsed.chunks,
    });
    dbError(published.error);
    return { jobId: job.id, status: published.data ? parsed.status : "stale" };
  } catch {
    const failed = await admin.rpc("document_job_fail", {
      p_job: job.id,
      p_fence: job.fence,
    });
    dbError(failed.error);
    return { jobId: job.id, status: !failed.data?'stale':job.attempts>=3?'failed':'retry_queued',stage:'local_document_task',inputRevision:job.input_revision,fence:job.fence };
  }
}
export async function reconcileDocuments(admin: SupabaseClient, runJob = true) {
  const pending = await admin.rpc("document_cleanup_claim");
  dbError(pending.error);
  let cleaned = 0;
  const started = Date.now();
  for (const op of pending.data ?? []) {
    if (Date.now() - started > 15000) break;
    const removed = await admin.storage
      .from("clinical-documents")
      .remove([op.object_key]);
    if (removed.error) continue;
    const done = await admin.rpc("document_cleanup_complete", {
      p_operation: op.id,
    });
    dbError(done.error);
    if(done.data)cleaned++;
  }
  return {
    cleaned,
    job: runJob ? await runDocumentJob(admin) : { status: "dispatch_required" },
  };
}
