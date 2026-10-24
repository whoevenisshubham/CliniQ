import type { NextConfig } from "next";
import {readFileSync} from 'node:fs';
let sourceSha='unavailable';
try{sourceSha=JSON.parse(readFileSync('public/build-identity.json','utf8')).sourceSha;}catch{}

const nextConfig: NextConfig = {
  env:{NEXT_PUBLIC_BUILD_SHA:sourceSha},
};

export default nextConfig;
