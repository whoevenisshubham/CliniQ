import { timingSafeEqual } from "node:crypto";
import { workerClient } from "../../src/lib/server/jobs/client";
import { runDocumentJob } from "../../src/lib/server/jobs/runner";
export async function handler(event: {
  httpMethod: string;
  headers: Record<string, string | undefined>;
}) {
  const expected = process.env.DOCUMENT_DISPATCH_SECRET ?? "",
    supplied = event.headers["x-document-dispatch"] ?? "";
  if (
    event.httpMethod !== "POST" ||
    expected.length < 32 ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return { statusCode: 403, body: "Forbidden" };
  await runDocumentJob(workerClient());
  return { statusCode: 200, body: "Completed bounded document work" };
}
