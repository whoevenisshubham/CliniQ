import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
function chunksFor(pages) {
  const chunks = [];
  let total = 0;
  for (let p = 0; p < pages.length; p++) {
    const chars = Array.from(pages[p]);
    total += chars.length;
    if (total > 100000) throw new Error("TEXT_LIMIT");
    for (let start = 0; start < chars.length; ) {
      const end = Math.min(start + 1000, chars.length),
        part = chars.slice(start, end).join("");
      if (part.trim()) {
        chunks.push({
          ordinal: chunks.length,
          page: p + 1,
          text: part,
          offset_start: start,
          offset_end: end,
          text_sha256: createHash("sha256").update(part).digest("hex"),
        });
        if (chunks.length > 100) throw new Error("CHUNK_LIMIT");
      }
      if (end === chars.length) break;
      start = end - 150;
    }
  }
  return chunks;
}
async function parse() {
  const { mime } = workerData,
    bytes = new Uint8Array(workerData.bytes);
  let pages = [];
  if (mime === "image/png" || mime === "image/jpeg")
    return { status: "needs_transcription", pages: 0, chunks: [] };
  if (mime === "text/plain") {
    pages = new TextDecoder("utf-8", { fatal: true }).decode(bytes).split("\f");
    if (pages.length > 20) throw new Error("PAGE_LIMIT");
  } else {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({
      data: bytes,
      useWasm: false,
      useSystemFonts: false,
      disableFontFace: true,
      isOffscreenCanvasSupported: false,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      enableXfa: false,
      verbosity: 0,
    });
    let doc;
    try {
      doc = await loading.promise;
      if (doc.numPages > 20) throw new Error("PAGE_LIMIT");
      let total = 0;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent({
          disableNormalization: true,
        });
        const text = content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
          )
          .join("")
          .trimEnd();
        total += text.length;
        if (total > 100000) throw new Error("TEXT_LIMIT");
        pages.push(text);
        page.cleanup();
      }
    } catch (e) {
      if (e?.name === "PasswordException")
        return { status: "encrypted", pages: 0, chunks: [] };
      throw e;
    } finally {
      await loading.destroy();
    }
  }
  const chunks = chunksFor(pages);
  return {
    status: chunks.length
      ? "text_ready"
      : mime === "application/pdf"
        ? "needs_transcription"
        : "empty",
    pages: pages.length,
    chunks,
  };
}
try {
  parentPort.postMessage(await parse());
} catch (e) {
  parentPort.postMessage({
    status: ["PAGE_LIMIT", "TEXT_LIMIT", "CHUNK_LIMIT"].includes(e?.message)
      ? "unsupported"
      : "failed",
    pages: 0,
    chunks: [],
  });
}
