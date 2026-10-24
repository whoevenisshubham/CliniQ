/** Preserve access-denial status even when an intermediary returns HTML or no body. */
export async function readJsonResponse(response: Response) {
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
    const message = body?.error?.message;
    throw Object.assign(
      new Error(typeof message === "string" ? message : "The request could not be completed."),
      { status: response.status },
    );
  }
  return body;
}
