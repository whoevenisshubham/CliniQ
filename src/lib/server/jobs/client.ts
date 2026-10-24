import { createClient } from "@supabase/supabase-js";
export function workerClient(timeoutMs = 10000) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("DOCUMENT_CONFIGURATION_REQUIRED");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) }),
    },
  });
}
