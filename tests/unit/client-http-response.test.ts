import { expect, it } from "vitest";
import { readJsonResponse } from "@/lib/client/http-response";

it.each([401, 403, 404])("retains HTTP %i when the access-denial body is not JSON", async (status) => {
  await expect(readJsonResponse(new Response("<html>Denied</html>", { status })))
    .rejects.toMatchObject({ status, message: "The server response could not be read. Try again." });
});

it("retains a definitive error status for an empty JSON error value", async () => {
  await expect(readJsonResponse(Response.json(null, { status: 403 })))
    .rejects.toMatchObject({ status: 403, message: "Access to this resource is no longer available." });
});

it("does not turn an unreadable successful mutation response into a definitive failure", async () => {
  const error = await readJsonResponse(new Response("", { status: 200 })).catch(e => e);
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toHaveProperty("status");
});

it("preserves structured API errors and successful payloads", async () => {
  await expect(readJsonResponse(Response.json({ error: { message: "Source changed." } }, { status: 409 })))
    .rejects.toMatchObject({ status: 409, message: "This source changed. Review saved state before starting another action." });
  await expect(readJsonResponse(Response.json({ document_id: "synthetic-document" })))
    .resolves.toEqual({ document_id: "synthetic-document" });
});

it.each([401,403,500,503])("never displays private/dependency error-body text for HTTP %i", async status => {
  const error = await readJsonResponse(Response.json({error:{message:'private dependency diagnostic / synthetic secret'}},{status})).catch(e=>e);
  expect(error.status).toBe(status);
  expect(error.message).not.toContain('private dependency');
  expect(error.message).not.toContain('secret');
});

it('uses curated, status-matched server codes for actionable guidance without echoing diagnostics',async()=>{
 const error=await readJsonResponse(Response.json({error:{code:'BYTE_QUOTA',message:'private raw body'}},{status:409})).catch(e=>e);
 expect(error.message).toContain('storage allowance');expect(error.message).not.toContain('private raw body');
 const mismatch=await readJsonResponse(Response.json({error:{code:'BYTE_QUOTA',message:'private raw body'}},{status:403})).catch(e=>e);
 expect(mismatch.message).toBe('Access to this resource is no longer available.');
});
