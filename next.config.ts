import type { NextConfig } from "next";
import {readFileSync} from 'node:fs';
let sourceSha='unavailable';
try{sourceSha=JSON.parse(readFileSync('public/build-identity.json','utf8')).sourceSha;}catch{}

const nextConfig: NextConfig = {
  // Keep ws optional native resolution in Node, not a bundled empty module.
  serverExternalPackages:['@napi-rs/canvas','pdfjs-dist','ws'],
  // Include subprocess entry points, native bindings and PDF assets in actual
  // Next/Vercel route traces, rather than relying on Netlify's included_files.
  outputFileTracingIncludes:{'/api/**':['./scripts/document-parser-worker.mjs','./scripts/ocr-image-worker.mjs','./node_modules/pdfjs-dist/legacy/build/**','./node_modules/pdfjs-dist/cmaps/**','./node_modules/pdfjs-dist/standard_fonts/**','./node_modules/@napi-rs/canvas*/**','./public/build-identity.json']},
  env:{NEXT_PUBLIC_BUILD_SHA:sourceSha},
};

export default nextConfig;
