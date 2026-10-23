import { workerClient } from "../../src/lib/server/jobs/client";
import { dispatchDocumentWork } from "../../src/lib/server/jobs/dispatch";
import { reconcileDocuments } from "../../src/lib/server/jobs/runner";
export const config = { schedule: "*/15 * * * *" };
export async function handler() {
  await reconcileDocuments(workerClient(3000), false);
  await dispatchDocumentWork();
  return { statusCode: 200 };
}
