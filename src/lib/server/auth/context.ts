import "server-only";
import {cache} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { HttpError } from "../http";

export interface Principal {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  memberships?: { workspace_id: string; role: string; status: string }[];
}

const roles: readonly string[] = ["patient", "doctor", "receptionist", "admin", "nurse", "research"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Verify Auth identity; resolve role and stable application ID from the active
// database account. Metadata and matching email addresses cannot grant access.
export async function resolvePrincipal(client: SupabaseClient): Promise<Principal> {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new HttpError(401, "AUTH_REQUIRED", "Sign in to continue.");
  const { data: account, error } = await client.from("users")
    .select("id,auth_user_id,email,name,role,is_active,avatar_url")
    .eq("auth_user_id", user.id).maybeSingle();
  if (error) throw new HttpError(503, "IDENTITY_SETUP_REQUIRED", "Account configuration needs attention.");
  if (!account || account.is_active !== true || account.auth_user_id !== user.id ||
      typeof account.id !== "string" || !uuid.test(account.id) || !roles.includes(account.role) ||
      typeof account.name !== "string" || typeof account.email !== "string") {
    throw new HttpError(403, "ACCOUNT_UNAVAILABLE", "This account is inactive or has not been linked. Contact the workspace owner.");
  }
  const { data: memberships, error: membershipError } = await client.from("workspace_memberships")
    .select("workspace_id,role,status").eq("user_id",account.id).eq("status","active");
  if(membershipError) throw new HttpError(503,"IDENTITY_SETUP_REQUIRED","Workspace configuration needs attention.");
  const active = (memberships ?? []).filter(m=>m.role===account.role && m.status==="active");
  if(account.role!=="patient" && !active.length) throw new HttpError(403,"MEMBERSHIP_REQUIRED","An active workspace assignment is required.");
  return { id: account.id, authUserId: user.id, email: account.email,
    name: account.name, role: account.role, avatar_url: account.avatar_url ?? undefined, memberships:active };
}

// Request-scoped React cache deduplicates layout/page Auth reads; never shared across requests.
export const requirePrincipal = cache(async function requirePrincipal() {
  return resolvePrincipal(await getSupabaseServerClient());
});
