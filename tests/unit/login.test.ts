import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { HttpError } from "@/lib/server/http";

vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/server/auth/context", () => ({ resolvePrincipal: vi.fn() }));
const auth = { signInWithPassword: vi.fn(), signOut: vi.fn() };

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.mocked(getSupabaseServerClient).mockResolvedValue({ auth } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

it("rejects staff self-selection before contacting Auth", async () => {
  const response = await POST(request({ email: "synthetic@example.test", password: "synthetic", role: "doctor" }));
  expect(response.status).toBe(400);
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

it("rejects login CSRF before contacting Auth", async () => {
  expect((await POST(request({ email: "synthetic@example.test", password: "synthetic" }, "https://attacker.invalid"))).status).toBe(403);
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

it("does not disclose provider diagnostics or credentials on failed login", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { message: "private Auth diagnostic" } });
  const response = await POST(request({ email: "synthetic@example.test", password: "synthetic" }));
  expect(response.status).toBe(401);
  expect(await response.text()).not.toContain("private Auth");
});

it("signs out a successful Auth session if the application account is disabled or unlinked", async () => {
  vi.mocked(resolvePrincipal).mockRejectedValue(new HttpError(403, "ACCOUNT_UNAVAILABLE", "Account unavailable."));
  const response = await POST(request({ email: "synthetic@example.test", password: "synthetic" }));
  expect(response.status).toBe(403);
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

it("returns the verified account without exposing session credentials", async () => {
  const user = { id: "stable-id", authUserId: "verified-auth-id", name: "Synthetic", email: "synthetic@example.test", role: "patient" as const };
  vi.mocked(resolvePrincipal).mockResolvedValue(user);
  const response = await POST(request({ email: user.email, password: "synthetic" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { user } });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
