import "server-only";
import { HttpError } from "../http";
import { boundedBytes, MAX_FILE_BYTES } from "./validation";
import type { UploadInput } from "./service";
export async function multipartUpload(request: Request): Promise<UploadInput> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new HttpError(415, "MULTIPART_REQUIRED", "Use the file upload form.");
  const bytes = await boundedBytes(request, MAX_FILE_BYTES + 65536);
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type")! },
      body: bytes,
    }).formData();
  } catch {
    throw new HttpError(
      400,
      "INVALID_UPLOAD",
      "The upload form is incomplete.",
    );
  }
  const file = form.get("file"),
    title = form.get("title");
  if (
    !(file instanceof File) ||
    typeof title !== "string" ||
    form.getAll("file").length !== 1 ||
    form.getAll("title").length !== 1
  )
    throw new HttpError(
      400,
      "INVALID_UPLOAD",
      "Choose one file and enter its title.",
    );
  const revision = form.get("revision");
  const parent = form.get("parentVersionId");
  return {
    key: request.headers.get("idempotency-key") ?? "",
    title,
    fileName: file.name,
    mime: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
    revision: revision === null ? 0 : Number(revision),
    parentVersionId: typeof parent === "string" ? parent : undefined,
  };
}
