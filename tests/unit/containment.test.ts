/// <reference types="vite/client" />
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/server/http";
import { requirePrincipal } from "@/lib/server/auth/context";

vi.mock("@/lib/server/auth/context", () => ({ requirePrincipal: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient: vi.fn(() => { throw new Error("Privileged client invoked"); }) }));

type Endpoint = (request: Request) => Promise<Response> | Response;
const modules = import.meta.glob<Record<string, Endpoint>>("../../src/app/api/**/route.ts", { eager: true });
const endpoints = Object.entries(modules).filter(([path]) => !path.includes("/auth/") && !path.includes("/api/me/") && !path.includes("/api/documents/") && !path.includes("/api/clinical/") && !path.includes("/api/ai/") && !path.includes("/api/jobs/") && !path.includes("/api/care/") && !path.includes("/api/continuity/") && !path.includes("/api/account/") && !path.includes("/api/billing/")).flatMap(([path, handlers]) =>
  Object.entries(handlers).filter(([method]) => ["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method) && !(path.includes("/consultations/[id]/emr/") && method==="GET"))
    .map(([method, handler]) => ({ path, method, handler })));

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network access forbidden in offline tests"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function request(method: string, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/test", { method, headers: {
    origin, cookie: "nexusmd_session=" + Buffer.from(JSON.stringify({ id: "doctor-demo", role: "admin" })).toString("base64"),
  } });
}

it("covers the 34 legacy HTTP exports still closed after the scoped EMR reader repair", () => { expect(endpoints.length).toBe(34); });

it.each(endpoints)("$method $path rejects an unverified forged session without running legacy logic", async ({ path, method, handler }) => {
  vi.mocked(requirePrincipal).mockRejectedValue(new HttpError(401, "AUTH_REQUIRED", "Sign in to continue."));
  const response = await handler(request(method));
  expect(response.status).toBe(path.includes("/seed/") ? 410 : 401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.text()).not.toContain("token");
});

it.each(endpoints)("$method $path remains closed even to a verified account", async ({ path, method, handler }) => {
  vi.mocked(requirePrincipal).mockResolvedValue({ id: "test", authUserId: "test", name: "Synthetic", email: "synthetic@example.test", role: "admin" });
  const response = await handler(request(method));
  expect(response.status).toBe(path.includes("/seed/") ? 410 : 503);
  const body = await response.json();
  expect(body.error.code).toBe(path.includes("/seed/") ? "ENDPOINT_REMOVED" : "WORKFLOW_NOT_READY");
});

it("rejects cross-origin mutation for a verified account", async () => {
  vi.mocked(requirePrincipal).mockResolvedValue({ id: "test", authUserId: "test", name: "Synthetic", email: "synthetic@example.test", role: "doctor" });
  const { handler } = endpoints.find(e => e.path.includes("/transcribe/"))!;
  const response = await handler(request("POST", "https://attacker.invalid"));
  expect(response.status).toBe(403);
});
