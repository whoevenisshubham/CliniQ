import "server-only";
import { createHash } from "node:crypto";
import { HttpError } from "../http";
export const MAX_FILE_BYTES = 4194304;
export function validateFile(bytes: Uint8Array, mime: string, name: string) {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES)
    throw new HttpError(413, "FILE_SIZE", "Use a non-empty file up to 4 MiB.");
  if (!name || name.length > 180 || /[\\/\x00-\x1f]/.test(name))
    throw new HttpError(
      400,
      "FILE_NAME",
      "Use a simple file name, up to 180 characters.",
    );
  const extension = name.toLowerCase().split(".").pop();
  const head = Buffer.from(bytes.subarray(0, 16)),
    tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 1024)));
  let valid = false;
  if (mime === "application/pdf")
    valid =
      extension === "pdf" &&
      head.subarray(0, 5).toString() === "%PDF-" &&
      tail.includes("%%EOF");
  if (mime === "image/png")
    valid =
      extension === "png" &&
      head
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      tail.includes(Buffer.from("IEND"));
  if (mime === "image/jpeg")
    valid =
      ["jpg", "jpeg"].includes(extension!) &&
      head[0] === 255 &&
      head[1] === 216 &&
      bytes.at(-2) === 255 &&
      bytes.at(-1) === 217;
  if (mime === "text/plain" && extension === "txt") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      valid =
        !/[\x00-\x08\x0b\x0e-\x1f]/.test(text) &&
        !/^\s*(?:<!doctype|<html|<script|<svg|<\?xml)/i.test(text);
    } catch {
      valid = false;
    }
  }
  if (!valid)
    throw new HttpError(
      415,
      "FILE_CONTENT",
      "File content, type and extension must match a supported PDF, UTF-8 text, PNG or JPEG.",
    );
  return createHash("sha256").update(bytes).digest("hex");
}
export async function boundedBytes(request: Request, max: number) {
  const claimed = Number(request.headers.get("content-length") ?? 0);
  if (claimed > max)
    throw new HttpError(413, "BODY_TOO_LARGE", "The upload is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "BODY_REQUIRED", "Select a file.");
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        throw new HttpError(413, "BODY_TOO_LARGE", "The upload is too large.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts, total);
}
