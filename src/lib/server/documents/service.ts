import "server-only";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { resolvePrincipal } from "../auth/context";
import { HttpError } from "../http";
import { validateFile } from "./validation";
export function dbError(error: PostgrestError | null) {
  if (!error) return;
  const messages: Record<string, [number, string]> = {
    OWNER_REQUIRED: [403, "Only a patient can change their own records."],
    NOT_FOUND: [404, "Record unavailable."],
    INELIGIBLE_PROVIDER: [
      403,
      "Choose an eligible clinician from your care team.",
    ],
    REVISION_CONFLICT: [
      409,
      "This record changed. Refresh before trying again.",
    ],
    IDEMPOTENCY_CONFLICT: [
      409,
      "This request key was already used for different content.",
    ],
    UPLOAD_EXPIRED: [409, "This upload expired. Start a new upload."],
    BYTE_QUOTA: [
      409,
      "Your 40 MiB storage allowance is full. Delete an old record first.",
    ],
    DOCUMENT_QUOTA: [409, "Your library has reached its 10-record limit."],
    VERSION_QUOTA: [409, "This record has reached its 10-version limit."],
    UPLOAD_RATE_LIMIT: [
      429,
      "Daily upload admission limit reached. Try again tomorrow.",
    ],
    MUTATION_LIMIT: [
      429,
      "Record operation limit reached; workspace maintenance is required.",
    ],
    UPLOAD_QUOTA: [
      409,
      "Too many uploads are pending. Please wait for recovery.",
    ],
  };
  const key = Object.keys(messages).find((k) => error.message.includes(k));
  if (key) throw new HttpError(messages[key][0], key, messages[key][1]);
  throw new HttpError(
    503,
    "DOCUMENT_UNAVAILABLE",
    "Records are temporarily unavailable. Try again later.",
  );
}
export function id(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new HttpError(400, "INVALID_ID", "A valid identifier is required.");
  return value;
}
export async function listDocuments(client: SupabaseClient) {
  await resolvePrincipal(client);
  const r = await client
    .from("documents")
    .select("id,title,kind,status,revision,current_version_id,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  dbError(r.error);
  return r.data;
}
export async function documentDetail(
  client: SupabaseClient,
  documentId: string,
) {
  await resolvePrincipal(client);
  id(documentId);
  const d = await client
    .from("documents")
    .select("id,title,kind,status,revision,current_version_id,created_at")
    .eq("id", documentId)
    .maybeSingle();
  dbError(d.error);
  if (!d.data) throw new HttpError(404, "NOT_FOUND", "Record unavailable.");
  const [versions, chunks, grants] = await Promise.all([
    client
      .from("document_versions")
      .select(
        "id,version_no,mime,byte_size,created_at,extraction_status,page_count,source_class,parent_version_id",
      )
      .eq("document_id", documentId)
      .order("version_no", { ascending: false }),
    client
      .from("document_chunks")
      .select("id,page,ordinal,text,offset_start,offset_end,source_class")
      .eq("document_id", documentId)
      .order("ordinal"),
    client
      .from("document_grants")
      .select("id,provider_id,workspace_id,revoked_at")
      .eq("document_id", documentId)
      .is("revoked_at", null),
  ]);
  for (const r of [versions, chunks, grants]) dbError(r.error);
  const ocrMetadata:Record<string,unknown>={};
  if(process.env.OCR_ENABLED==='true'){
    const metadata=await client.from('document_versions').select('id,reviewed_ocr').eq('document_id',documentId);dbError(metadata.error);
    for(const row of metadata.data??[])ocrMetadata[row.id]=row.reviewed_ocr;
  }
  const current = await client
    .from("documents")
    .select("revision,current_version_id")
    .eq("id", documentId)
    .maybeSingle();
  dbError(current.error);
  if (!current.data)
    throw new HttpError(404, "NOT_FOUND", "Record unavailable.");
  if (
    current.data.revision !== d.data.revision ||
    current.data.current_version_id !== d.data.current_version_id
  )
    throw new HttpError(
      409,
      "REVISION_CONFLICT",
      "This record changed. Refresh to read its current source.",
    );
  return {
    document: d.data,
    versions: versions.data?.map(v=>({...v,reviewed_ocr:ocrMetadata[v.id]})),
    chunks: chunks.data,
    grants: grants.data,
  };
}
export type UploadInput = {
  key: string;
  title: string;
  fileName: string;
  mime: string;
  bytes: Uint8Array;
  documentId?: string;
  revision?: number;
  parentVersionId?: string;
};
export async function uploadDocument(
  client: SupabaseClient,
  admin: SupabaseClient,
  input: UploadInput,
) {
  const principal = await resolvePrincipal(client);
  if (principal.role !== "patient")
    throw new HttpError(
      403,
      "OWNER_REQUIRED",
      "Only patients can upload records.",
    );
  id(input.key);
  if (input.documentId) id(input.documentId);
  if (input.parentVersionId) id(input.parentVersionId);
  if (!input.title.trim() || input.title.length > 160)
    throw new HttpError(
      400,
      "TITLE_REQUIRED",
      "Enter a title up to 160 characters.",
    );
  if (
    input.revision !== undefined &&
    (!Number.isInteger(input.revision) || input.revision < 0)
  )
    throw new HttpError(
      400,
      "INVALID_REVISION",
      "Refresh the record before replacing it.",
    );
  const sha = validateFile(input.bytes, input.mime, input.fileName);
  const admitted = await client.rpc("document_admit", {
    p_key: input.key,
    p_title: input.title.trim(),
    p_name: input.fileName,
    p_mime: input.mime,
    p_size: input.bytes.length,
    p_hash: sha,
    p_document: input.documentId ?? null,
    p_revision: input.revision ?? 0,
    p_parent: input.parentVersionId ?? null,
  });
  dbError(admitted.error);
  const op = admitted.data;
  if (op.state === "committed")
    return {
      document_id: op.document_id,
      version_id: op.version_id,
      replayed: true,
    };
  try {
    const stored = await admin.storage
      .from("clinical-documents")
      .upload(op.object_key, input.bytes, {
        contentType: input.mime,
        upsert: false,
      });
    if (stored.error) {
      // Concurrent retries may have stored exactly these immutable bytes already.
      if (
        !["409", "Duplicate"].includes(String(stored.error.statusCode)) &&
        !stored.error.message.toLowerCase().includes("already exists")
      )
        throw new HttpError(
          503,
          "UPLOAD_INTERRUPTED",
          "Upload was not committed. Retry this same file with the same request key.",
        );
      const existing = await admin.storage
        .from("clinical-documents")
        .download(op.object_key);
      if (
        existing.error ||
        !existing.data ||
        validateFile(
          new Uint8Array(await existing.data.arrayBuffer()),
          input.mime,
          input.fileName,
        ) !== sha
      )
        throw new HttpError(
          409,
          "OBJECT_CONFLICT",
          "Stored bytes do not match this upload. Recovery is required.",
        );
    }
    const stage = await admin.rpc("document_upload_stage", {
      p_operation: op.id,
      p_stage: "stored",
    });
    dbError(stage.error);
    // Revalidate the same principal/session and operation immediately before commit.
    await resolvePrincipal(client);
    const visible = await client
      .from("upload_operations")
      .select("id,state")
      .eq("id", op.id)
      .maybeSingle();
    dbError(visible.error);
    if (!visible.data)
      throw new HttpError(
        403,
        "ACCOUNT_UNAVAILABLE",
        "Upload authorization changed.",
      );
    const committed = await admin.rpc("document_commit", {
      p_operation: op.id,
    });
    dbError(committed.error);
    return committed.data;
  } catch (error) {
    await admin.rpc("document_upload_stage", {
      p_operation: op.id,
      p_stage: "failed",
    });
    throw error;
  }
}
export async function changeDocument(
  client: SupabaseClient,
  documentId: string,
  body: Record<string, unknown>,
) {
  await resolvePrincipal(client);
  id(documentId);
  id(body.key);
  if (!Number.isInteger(body.revision) || Number(body.revision) < 0)
    throw new HttpError(
      400,
      "INVALID_REVISION",
      "Refresh the record before changing it.",
    );
  if (!["share", "revoke", "delete", "retry"].includes(String(body.action)))
    throw new HttpError(
      400,
      "INVALID_ACTION",
      "Choose a supported record action.",
    );
  if (["share", "revoke"].includes(String(body.action))) {
    id(body.providerId);
    id(body.workspaceId);
  }
  const r = await client.rpc("document_change", {
    p_document: documentId,
    p_revision: body.revision,
    p_key: body.key,
    p_action: body.action,
    p_provider: body.providerId ?? null,
    p_workspace: body.workspaceId ?? null,
  });
  dbError(r.error);
  return r.data;
}
