import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "../http";

export async function readPrivateContent(client: SupabaseClient, privileged: () => SupabaseClient, id: string) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400,"INVALID_ID","A document UUID is required.");
  const { data: document, error } = await client.from("documents").select("id,current_version_id,status").eq("id",id).maybeSingle();
  if (error) throw new HttpError(503,"DOCUMENT_UNAVAILABLE","Documents are temporarily unavailable.");
  if (!document || document.status !== "ready" || !document.current_version_id) throw new HttpError(404,"NOT_FOUND","Document unavailable.");
  const { data: version, error: versionError } = await client.from("document_versions").select("id,object_key,mime,byte_size").eq("id",document.current_version_id).eq("document_id",id).maybeSingle();
  if (versionError) throw new HttpError(503,"DOCUMENT_UNAVAILABLE","Documents are temporarily unavailable.");
  if (!version) throw new HttpError(404,"NOT_FOUND","Document unavailable.");
  const { data: bytes, error: storageError } = await privileged().storage.from("clinical-documents").download(version.object_key);
  if (storageError || !bytes) throw new HttpError(503,"CONTENT_UNAVAILABLE","File content is temporarily unavailable.");
  // Revalidate after the storage read so a grant revoked during retrieval cannot
  // publish bytes. Already-delivered bytes cannot be recalled.
  const { data: current, error: recheckError } = await client.from("documents").select("current_version_id,status").eq("id",id).maybeSingle();
  if (recheckError || !current || current.status!=="ready" || current.current_version_id!==version.id) throw new HttpError(404,"NOT_FOUND","Document unavailable.");
  return new Response(bytes, { headers: {
    "Content-Type":version.mime,"Content-Length":String(bytes.size),"Content-Disposition":'attachment; filename="clinical-record"',
    "Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox",
  } });
}
