import "server-only";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, Origin" },
  });
}

export function errorResponse(error: unknown) {
  const safe = error instanceof HttpError
    ? error
    : new HttpError(503, "DEPENDENCY_UNAVAILABLE", "This service is temporarily unavailable.");
  return privateJson({ error: { code: safe.code, message: safe.message, requestId: crypto.randomUUID() } }, safe.status);
}

export function requireSameOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN;
  if (!configured) throw new HttpError(503, "CONFIGURATION_REQUIRED", "Application origin is not configured.");
  let origin: string;
  try {
    const url = new URL(configured);
    if (url.origin !== configured || !["https:", "http:"].includes(url.protocol)) throw new Error();
    origin = url.origin;
  } catch {
    throw new HttpError(503, "CONFIGURATION_REQUIRED", "Application origin is not configured correctly.");
  }
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "ORIGIN_DENIED", "This request must come from the application.");
  }
}

export async function readJson(request: Request, maxBytes = 16384): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new HttpError(415, "JSON_REQUIRED", "Send an application/json request.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_JSON", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "BODY_TOO_LARGE", "The request is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, "INVALID_JSON", "The request contains invalid JSON."); }
}
