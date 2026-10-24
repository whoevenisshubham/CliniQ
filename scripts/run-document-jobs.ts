import { localConfiguration } from "./local-supabase.mjs";
import { createClient } from "@supabase/supabase-js";
import { reconcileDocuments } from "../src/lib/server/jobs/runner";
import { runNextJob } from "../src/lib/server/jobs/unified-runner";
if (process.argv[2] !== "--local-synthetic")
  throw new Error("Explicit isolated-local scope required");
const c = localConfiguration();
const admin = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function main(){
  let cleanup:unknown;let cleanupFailed=false;
  try{cleanup=await reconcileDocuments(admin,false);}catch{cleanup={status:'cleanup_unavailable'};cleanupFailed=true;}
  const job=await runNextJob(admin);
  console.log(JSON.stringify({cleanup,job}));
  if(cleanupFailed||job.degraded)process.exitCode=1;
}
main().catch(()=>{console.error('DOCUMENT_RUN_FAILED');process.exitCode=1;});
