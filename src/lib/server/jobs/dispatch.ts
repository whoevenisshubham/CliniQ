// Durable SQL queue is authoritative. Missing dispatch leaves a queued job for
// explicit preview reconciliation, never a fabricated parsing success.
export async function dispatchDocumentWork() {
  const secret = process.env.DOCUMENT_DISPATCH_SECRET,
    origin = process.env.APP_ORIGIN;
  if (!secret || secret.length < 32 || !origin) return false;
  try {
    const r = await fetch(
      new URL("/.netlify/functions/document-worker-background", origin),
      {
        method: "POST",
        headers: { "x-document-dispatch": secret },
        signal: AbortSignal.timeout(2000),
      },
    );
    return r.status === 202;
  } catch {
    return false;
  }
}
