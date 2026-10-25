import type { NextConfig } from "next";
import {readFileSync} from 'node:fs';
let sourceSha='unavailable';
try{sourceSha=JSON.parse(readFileSync('public/build-identity.json','utf8')).sourceSha;}catch{}

const nextConfig: NextConfig = {
  serverExternalPackages:['@napi-rs/canvas','pdfjs-dist'],
  // Native raster assets are packaged explicitly by Netlify and the staged
  // smoke. Turbopack's worker-file tracer cannot traverse their Node builtins.
  outputFileTracingExcludes:{'/api/documents/**':['./scripts/ocr-image-worker.mjs']},
  env:{NEXT_PUBLIC_BUILD_SHA:sourceSha},
};

export default nextConfig;
