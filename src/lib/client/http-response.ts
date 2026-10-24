/** Preserve access-denial status even when an intermediary returns HTML or no body. */
export async function readJsonResponse(response: Response, valid?: (body: unknown) => boolean) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw Object.assign(
      new Error("The server response could not be read. Try again."),
      response.ok ? {} : { status: response.status },
    );
  }
  if (!response.ok) {
    // Never surface an intermediary/dependency body as a product error.
    const messages: Record<number, string> = {
      400: "The request could not be completed.",
      401: "Sign in again to continue.",
      403: "Access to this resource is no longer available.",
      404: "This resource is no longer available.",
      409: "This source changed. Review saved state before starting another action.",
      413: "The request is too large.",
      422: "Review the entered values before trying again.",
      429: "Too many requests. Wait before trying again.",
    };
    const codes:Record<string,[number,string]>={
      BYTE_QUOTA:[409,"Your private storage allowance is full. Review existing records before uploading again."],
      DOCUMENT_QUOTA:[409,"Your library has reached its record limit."],
      VERSION_QUOTA:[409,"This document has reached its version limit."],
      UPLOAD_QUOTA:[409,"Uploads are still pending. Wait for recovery before starting another upload."],
      UPLOAD_EXPIRED:[409,"This upload expired. Start a new upload after checking the saved library."],
      UPLOAD_RATE_LIMIT:[429,"Daily upload admission limit reached. Try again tomorrow."],
      REVIEW_REQUIRED:[422,"Review the current saved draft and confirm it before approval."],
      MEDICATION_REVIEW_REQUIRED:[422,"Complete medication fields or record explicit unknowns with review reasons."],
      ALLERGY_REVIEW_REQUIRED:[422,"Review the recorded allergy match and acknowledge it with a reason."],
      UNIT_REVIEW_REQUIRED:[422,"Review conflicting measurement units and record a reason."],
      CORRECTION_REASON_REQUIRED:[422,"Record a reason for correcting the earlier report."],
      TARIFF_UNAVAILABLE:[422,"The selected synthetic tariff is unavailable. Review saved selections."],
      INVALID_SCHEDULE:[422,"Check explicit tracking times, dates and time zone."],
      LEGACY_RECONCILIATION_REQUIRED:[409,"This historical encounter needs explicit reconciliation before editing."],
    };
    const code=typeof body?.error?.code==='string'?codes[body.error.code]:undefined;
    throw Object.assign(
      new Error(code?.[0]===response.status?code[1]:messages[response.status] ?? "The service is temporarily unavailable."),
      { status: response.status },
    );
  }
  if (valid && !valid(body))
    throw new Error("The server response could not be validated. Refresh saved state or reconcile the saved request.");
  return body;
}

export const accessDenied = (error: unknown) => [401, 403, 404].includes((error as { status?: number })?.status ?? 0);
