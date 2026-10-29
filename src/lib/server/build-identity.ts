import {readFileSync} from 'node:fs';
import path from 'node:path';
export function buildIdentity():{sourceSha:string;parserSha256:string}{
 try{const value=JSON.parse(readFileSync(path.join(process.cwd(),'public/build-identity.json'),'utf8'));if(/^[a-f0-9]{40}$/.test(value.sourceSha)&&/^[a-f0-9]{64}$/.test(value.parserSha256))return{sourceSha:value.sourceSha,parserSha256:value.parserSha256};}catch{}
 return{sourceSha:'unavailable',parserSha256:'unavailable'};
}
