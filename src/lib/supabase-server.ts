import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { HttpError } from "./server/http";

// Retains CliniQ's SSR adapter and MediFlow's explicit missing-env behavior.
export function getSupabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(503, "CONFIGURATION_REQUIRED", "Sign-in is not configured yet.");
  return { url, key };
}

// ─── Server client (server components / route handlers) ─────────────────────
export async function getSupabaseServerClient() {
  const { url, key } = getSupabaseConfiguration();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server component — cookies can't be set from here (middleware handles refresh)
        }
      },
    },
  });
}

// ─── Admin client (service role — for Edge Functions / audit log) ─────────────
export function getSupabaseAdminClient() {
  const { url } = getSupabaseConfiguration();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new HttpError(503, "CONFIGURATION_REQUIRED", "Server setup is incomplete.");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
