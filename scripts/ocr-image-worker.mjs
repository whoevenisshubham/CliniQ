import {parentPort,workerData} from 'node:worker_threads';
import {createCanvas,loadImage,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
import path from 'node:path';
// Inspect dimensions before native decode; reject oversized/decompression-heavy inputs.
function imageSize(b,mime){
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(mime==='image/png'&&b.length>=24&&b[0]===137&&b[1]===80)return[v.getUint32(16),v.getUint32(20)];
 if(mime==='image/jpeg'&&b[0]===255&&b[1]===216){for(let i=2;i+8<b.length;){if(b[i]!==255)throw Error('IMAGE_HEADER');const marker=b[i+1];if(marker===217||marker===218)break;if(marker===216||marker===1||(marker>=208&&marker<=215)){i+=2;continue;}const n=v.getUint16(i+2);if(n<2||i+2+n>b.length)throw Error('IMAGE_HEADER');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return[v.getUint16(i+7),v.getUint16(i+5)];i+=2+n;}}
 throw Error('IMAGE_HEADER');
}
function size(w,h){if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>4096||h>4096||w*h>8000000)throw Error('IMAGE_DIMENSIONS');}
async function render(){
 const {mime,pages}=workerData,b=new Uint8Array(workerData.bytes);if(b.length>4194304||!Array.isArray(pages)||pages.length<1||pages.length>2||new Set(pages).size!==pages.length||pages.some(p=>!Number.isInteger(p)||p<1||p>20))throw Error('IMAGE_BOUND');
 const output=[];let total=0;
 function add(canvas,page){const bytes=new Uint8Array(canvas.toBuffer('image/png'));total+=bytes.length;if(total>2097152)throw Error('RENDER_BYTE_LIMIT');output.push({page,width:canvas.width,height:canvas.height,bytes});}
 if(mime==='image/png'||mime==='image/jpeg'){
  if(pages.length!==1||pages[0]!==1)throw Error('IMAGE_PAGE');const [w,h]=imageSize(b,mime);size(w,h);const image=await loadImage(Buffer.from(b));if(image.width!==w||image.height!==h)throw Error('IMAGE_HEADER');const scale=Math.min(1,1600/Math.max(w,h)),canvas=createCanvas(Math.max(1,Math.ceil(w*scale)),Math.max(1,Math.ceil(h*scale)));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);add(canvas,1);
 }else if(mime==='application/pdf'){
  Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading=getDocument({data:b,useWasm:false,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,enableXfa:false,maxImageSize:8000000,stopAtErrors:true,cMapUrl:path.join(process.cwd(),'node_modules/pdfjs-dist/cmaps').split(path.sep).join('/')+'/',cMapPacked:true,standardFontDataUrl:path.join(process.cwd(),'node_modules/pdfjs-dist/standard_fonts').split(path.sep).join('/')+'/',verbosity:0});const doc=await loading.promise;
  try{if(doc.numPages>20)throw Error('PAGE_LIMIT');for(const n of pages){if(n>doc.numPages)throw Error('IMAGE_PAGE');const page=await doc.getPage(n);const content=await page.getTextContent();if(content.items.some(x=>typeof x.str==='string'&&x.str.trim()))throw Error('LOCAL_TEXT_AVAILABLE');const base=page.getViewport({scale:1});if(base.width<1||base.height<1||base.width>14400||base.height>14400)throw Error('PAGE_DIMENSIONS');const viewport=page.getViewport({scale:Math.min(2,1600/Math.max(base.width,base.height))});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;add(canvas,n);page.cleanup();}}finally{await loading.destroy();}
 }else throw Error('IMAGE_TYPE');return output;
}
try{parentPort.postMessage({pages:await render()});}catch(e){parentPort.postMessage({error:/^[A-Z_]+$/.test(e.message)?e.message:'IMAGE_UNREADABLE'});}


