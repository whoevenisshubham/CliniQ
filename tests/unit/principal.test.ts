import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePrincipal } from "@/lib/server/auth/context";

vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: vi.fn() }));
const authId = "c6281724-4c25-432d-ab77-d90386fe1898";
const appId = "6e8bca44-c2da-4a8c-b1d7-a41ff0ba119d";
const account = { id: appId, auth_user_id: authId, email: "patient@example.test", name: "Synthetic Patient", role: "patient", is_active: true };

function client(row: unknown = account, user: unknown = { id: authId, user_metadata: { role: "admin" } }, error: unknown = null) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error }) };
  const memberQuery={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve)};
  const from = vi.fn((table:string)=>table==="workspace_memberships"?memberQuery:query);
  const auth = { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) };
  return { value: { auth, from } as unknown as SupabaseClient, auth, from, query };
}

it("uses verified identity and stable application ID; ignores staff metadata", async () => {
  const db = client();
  const result = await resolvePrincipal(db.value);
  expect(result).toMatchObject({ id: appId, authUserId: authId, role: "patient" });
  expect(db.auth.getUser).toHaveBeenCalledOnce();
  expect(db.query.eq).toHaveBeenCalledWith("auth_user_id", authId);
});

it("does not query accounts when auth verification fails", async () => {
  const db = client(account, null);
  await expect(resolvePrincipal(db.value)).rejects.toMatchObject({ status: 401 });
  expect(db.from).not.toHaveBeenCalled();
});

it.each([null, { ...account, is_active: false }, { ...account, is_active: null },
  { ...account, auth_user_id: "another-user" }, { ...account, role: "owner" }, { ...account, id: "doctor-demo" }])(
  "fails closed for missing, disabled, mismatched or malformed account %j", async row => {
    await expect(resolvePrincipal(client(row).value)).rejects.toMatchObject({ status: 403 });
  });

it("reports missing or ambiguous mapping infrastructure without a database error leak", async () => {
  await expect(resolvePrincipal(client(null, { id: authId }, { message: "private database diagnostic" }).value))
    .rejects.toMatchObject({ status: 503, code: "IDENTITY_SETUP_REQUIRED" });
});
