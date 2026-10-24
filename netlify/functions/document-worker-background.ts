import { timingSafeEqual } from "node:crypto";
import { workerClient } from "../../src/lib/server/jobs/client";
import { runNextJob } from "../../src/lib/server/jobs/unified-runner";
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
  try{
    const result=await runNextJob(workerClient());
    console.info(JSON.stringify({event:'bounded_job',jobId:'jobId' in result?result.jobId:null,status:result.status,degraded:result.degraded}));
    return {statusCode:result.degraded?503:200,body:JSON.stringify(result)};
  }catch{
    console.error(JSON.stringify({event:'bounded_job',stage:'run',category:'WORKER_UNAVAILABLE',recovery:'durable_state_retained'}));
    return {statusCode:503,body:JSON.stringify({status:'worker_unavailable',recovery:'durable_state_retained'})};
  }
}
