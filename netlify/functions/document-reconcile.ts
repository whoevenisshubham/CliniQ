import { workerClient } from "../../src/lib/server/jobs/client";
import { dispatchDocumentWork } from "../../src/lib/server/jobs/dispatch";
import { reconcileDocuments } from "../../src/lib/server/jobs/runner";
export const config = { schedule: "*/15 * * * *" };
export async function handler() {
  const client=workerClient(3000);
  const recovery=await client.rpc('ai_reconcile');if(recovery.error)return {statusCode:503};
  const speech=await client.rpc('speech_reconcile');if(speech.error)return {statusCode:503};
  const continuity=await client.rpc('continuity_reconcile');if(continuity.error)return {statusCode:503};
  await reconcileDocuments(client, false);
  await dispatchDocumentWork();
  return { statusCode: 200 };
}
