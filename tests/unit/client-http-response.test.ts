import { expect, it } from "vitest";
import { readJsonResponse } from "@/lib/client/http-response";

it.each([401, 403, 404])("retains HTTP %i when the access-denial body is not JSON", async (status) => {
  await expect(readJsonResponse(new Response("<html>Denied</html>", { status })))
    .rejects.toMatchObject({ status, message: "The server response could not be read. Try again." });
});

it("retains a definitive error status for an empty JSON error value", async () => {
  await expect(readJsonResponse(Response.json(null, { status: 403 })))
    .rejects.toMatchObject({ status: 403, message: "The request could not be completed." });
});

it("does not turn an unreadable successful mutation response into a definitive failure", async () => {
  const error = await readJsonResponse(new Response("", { status: 200 })).catch(e => e);
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toHaveProperty("status");
});

it("preserves structured API errors and successful payloads", async () => {
  await expect(readJsonResponse(Response.json({ error: { message: "Source changed." } }, { status: 409 })))
    .rejects.toMatchObject({ status: 409, message: "Source changed." });
  await expect(readJsonResponse(Response.json({ document_id: "synthetic-document" })))
    .resolves.toEqual({ document_id: "synthetic-document" });
});
