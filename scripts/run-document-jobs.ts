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
reconcileDocuments(admin,false).then(async result=>({...result,job:await runNextJob(admin)}))
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => {
    console.error("DOCUMENT_RUN_FAILED");
    process.exitCode = 1;
  });
