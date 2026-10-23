import { afterEach, expect, it, vi } from "vitest";
import { errorResponse, readJson, requireSameOrigin } from "@/lib/server/http";

afterEach(() => vi.unstubAllEnvs());

it.each([null, "null", "https://attacker.invalid", "https://cliniq.example.attacker.invalid"])("rejects origin %s", origin => {
  vi.stubEnv("APP_ORIGIN", "https://cliniq.example");
  const request = new Request("https://cliniq.example/api/auth/login", { method: "POST", headers: origin ? { origin } : {} });
  expect(() => requireSameOrigin(request)).toThrow("must come from the application");
});

it("accepts only the configured exact origin", () => {
  vi.stubEnv("APP_ORIGIN", "https://cliniq.example");
  expect(() => requireSameOrigin(new Request("https://internal.invalid", { headers: { origin: "https://cliniq.example" } }))).not.toThrow();
});

it("requires explicit origin configuration", () => {
  vi.stubEnv("APP_ORIGIN", "");
  expect(() => requireSameOrigin(new Request("https://cliniq.example"))).toThrow("not configured");
});

it("caps actual bytes even when content-length lies", async () => {
  const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body: JSON.stringify({ text: "x".repeat(32) }) });
  await expect(readJson(request, 10)).rejects.toMatchObject({ status: 413 });
});

it("distinguishes malformed JSON from unsupported content type", async () => {
  await expect(readJson(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }))).rejects.toMatchObject({ status: 400 });
  await expect(readJson(new Request("http://localhost", { method: "POST", body: "{}" }))).rejects.toMatchObject({ status: 415 });
});

it("does not expose raw dependency errors", async () => {
  const response = errorResponse(new Error("secret database diagnostics"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});
