import { workerClient } from "../../src/lib/server/jobs/client";
import { dispatchDocumentWork } from "../../src/lib/server/jobs/dispatch";
import { reconcileDocuments } from "../../src/lib/server/jobs/runner";
import {recoverSubsystems,failedRecoveries} from '../../src/lib/server/jobs/recovery';
export async function handler() {
  const client=workerClient(3000);
  const recovery=await recoverSubsystems(client);
  let cleanup:'completed'|'failed'='completed';
  try{await reconcileDocuments(client,false);}catch{cleanup='failed';}
  const dispatched=await dispatchDocumentWork(),failedStages=failedRecoveries(recovery);
  const degraded=failedStages.length>0||cleanup==='failed'||!dispatched;
  console.info(JSON.stringify({event:'bounded_reconciliation',failedStages,cleanup,dispatch:dispatched?'accepted':'pending',recovery:degraded?'attention_required':'completed'}));
  return {statusCode:degraded?503:200,body:JSON.stringify({recovery,cleanup,dispatch:dispatched?'accepted':'pending'})};
}
