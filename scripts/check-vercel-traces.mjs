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

// A handshake-only probe missed the hosted native-addon stub failure. Exercise
// actual masked payloads through the traced ws package, without any listener,
// outbound connection, microphone, provider or allowance.
const wsRoute=path.resolve('.next/server/app/api/clinical/[id]/speech/live/route.js.nft.json');
const wsFiles=JSON.parse(fs.readFileSync(wsRoute,'utf8')).files.map(f=>f.replaceAll('\\','/'));
for(const name of ['node_modules/ws/package.json','node_modules/ws/lib/buffer-util.js','node_modules/ws/lib/receiver.js'])assert(wsFiles.some(f=>f.endsWith(name)),'Live route must trace external '+name);
process.env.WS_NO_BUFFER_UTIL='1';
const {createRequire}=await import('node:module');const {Sender,Receiver}=createRequire(import.meta.url)('ws');
for(const [opcode,payload]of [[2,Buffer.alloc(8192,37)],[1,Buffer.from(JSON.stringify({type:'transport_probe',payload:'x'.repeat(96)}))]]){
 const expected=Buffer.from(payload),receiver=new Receiver({isServer:true,maxPayload:32768});
 const received=new Promise((resolve,reject)=>{receiver.once('message',data=>resolve(data));receiver.once('error',reject);});
 const frame=Buffer.concat(Sender.frame(Buffer.from(payload),{fin:true,mask:true,opcode,rsv1:false,readOnly:false}));
 receiver.write(frame.subarray(0,13));receiver.write(frame.subarray(13));assert.deepEqual(await received,expected);receiver.end();
}
console.log(JSON.stringify({liveWsExternalTrace:true,maskedBinaryBytes:8192,maskedText:true,providerCalls:0,listeningServers:0}));
