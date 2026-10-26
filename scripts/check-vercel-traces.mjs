// Validate actual Next traces; no server, network or provider call is started.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const routes=['api/documents/route','api/documents/[id]/recover/route','api/internal/document-worker/route'];
for(const route of routes){const file=path.resolve('.next/server/app',route+'.js.nft.json'),base=path.dirname(file),files=JSON.parse(fs.readFileSync(file,'utf8')).files.map(p=>p.replaceAll('\\','/'));
 const has=s=>files.some(f=>f.endsWith(s));
 for(const name of ['scripts/document-parser-worker.mjs','scripts/ocr-image-worker.mjs','public/build-identity.json'])assert(has(name),route+' missing '+name);
 const cmaps=fs.readdirSync('node_modules/pdfjs-dist/cmaps').filter(f=>f.endsWith('.bcmap'));for(const name of cmaps)assert(has('/cmaps/'+name),route+' missing CMap '+name);assert(files.filter(f=>f.includes('/standard_fonts/')).length>=16);assert(files.some(f=>f.includes('/canvas-')&&f.endsWith('.node')));
 for(const p of files)assert(fs.existsSync(path.resolve(base,p)),'traced file absent: '+p);
 console.log(JSON.stringify({route,tracedFiles:files.length,parser:true,ocrRenderer:true,cmaps:cmaps.length,fonts:true,nativeBinding:true}));
}
