import { Worker } from "node:worker_threads";
import path from "node:path";
export type ParseResult = {
  status: string;
  pages: number;
  chunks: {
    ordinal: number;
    page: number;
    text: string;
    offset_start: number;
    offset_end: number;
    text_sha256: string;
  }[];
};
export function parseDocument(
  bytes: Uint8Array,
  mime: string,
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(process.cwd(), "scripts/document-parser-worker.mjs"),
      {
        workerData: { bytes, mime },
        resourceLimits: {
          maxOldGenerationSizeMb: 256,
          maxYoungGenerationSizeMb: 32,
        },
      },
    );
    let settled = false;
    const finish = (error: Error | null, result?: ParseResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(() => finish(new Error("PARSER_DEADLINE")), 30000);
    worker.once("message", (result) => finish(null, result));
    worker.once("error", () => finish(new Error("PARSER_UNAVAILABLE")));
    worker.once("exit", (code) => {
      if (!settled) finish(new Error("PARSER_EXIT_" + code));
    });
  });
}
