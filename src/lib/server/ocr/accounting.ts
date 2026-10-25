import {createHash} from 'node:crypto';
// No model/account entitlement is inferred. Profiles are supplied only after
// reconciling published image accounting and actual account limits.
export type OCRAccounting={
 version:'ocr-accounting-v1';model:string;documentation:string;
 textAccounting:'utf8-byte-upper-bound';framingTokens:number;
 image:{kind:'fixed';tokens:number}|{kind:'tiles';width:number;height:number;base:number;tokens:number};
 contextTokens:number;maxInputTokens:number;maxOutputTokens:number;outputTokens:number;
};
export type OCRBound={profile:OCRAccounting;pages:number[];dimensions:{width:number;height:number}[];promptSha256:string;textBytes:number;imageTokens:number;input:number;output:number};
const integer=(n:unknown,max:number,min=1)=>Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max;
export function parseAccounting(value:unknown,model:string):OCRAccounting{
 const p=value as OCRAccounting;
 if(!p||p.version!=='ocr-accounting-v1'||p.model!==model||typeof p.documentation!=='string'||!/^https:\/\//.test(p.documentation)||p.documentation.length>500||p.textAccounting!=='utf8-byte-upper-bound'||!integer(p.framingTokens,10000)||!integer(p.contextTokens,1000000)||!integer(p.maxInputTokens,50000)||!integer(p.maxOutputTokens,3000)||!integer(p.outputTokens,p.maxOutputTokens)||!p.image)throw Error('OCR_ACCOUNTING_UNAVAILABLE');
 if(p.image.kind==='fixed'){if(!integer(p.image.tokens,50000))throw Error('OCR_ACCOUNTING_UNAVAILABLE');}
 else if(p.image.kind==='tiles'){if(!integer(p.image.width,1600)||!integer(p.image.height,1600)||!integer(p.image.base,50000,0)||!integer(p.image.tokens,50000))throw Error('OCR_ACCOUNTING_UNAVAILABLE');}
 else throw Error('OCR_ACCOUNTING_UNAVAILABLE');
 const image=p.image.kind==='fixed'?{kind:'fixed' as const,tokens:p.image.tokens}:{kind:'tiles' as const,width:p.image.width,height:p.image.height,base:p.image.base,tokens:p.image.tokens};
 return{version:p.version,model:p.model,documentation:p.documentation,textAccounting:p.textAccounting,framingTokens:p.framingTokens,image,contextTokens:p.contextTokens,maxInputTokens:p.maxInputTokens,maxOutputTokens:p.maxOutputTokens,outputTokens:p.outputTokens};
}
// Published Groq image accounting, checked 2026-10-26. This technical rule is
// not evidence of this account's access, free allowance or tokenizer limits.
export const VISION_ACCOUNTING_DOC='https://console.groq.com/docs/vision';
export function configuredAccounting(model:string):OCRAccounting|null{try{const p=parseAccounting(JSON.parse(process.env.OCR_ACCOUNTING_JSON??''),model);if(model!=='qwen/qwen3.8-27b'||p.documentation!==VISION_ACCOUNTING_DOC||p.image.kind!=='fixed'||p.image.tokens!==2048)return null;return p;}catch{return null;}}
export function pageInstruction(pages:number[]){return 'Original page numbers, in image order: '+pages.join(',');}
export function requestBound(profile:OCRAccounting,prompt:string,pages:number[],dimensions=pages.map(()=>({width:1600,height:1600}))):OCRBound{
 const p=parseAccounting(profile,profile.model);
 if(!pages.length||pages.length>2||new Set(pages).size!==pages.length||pages.some(n=>!integer(n,20))||dimensions.length!==pages.length||dimensions.some(d=>!integer(d.width,1600)||!integer(d.height,1600)))throw Error('OCR_IMAGE_BOUND');
 // UTF-8 bytes conservatively bound text tokens ONLY for a reconciled byte-level
 // tokenizer profile. Framing includes all model-specific chat/image wrappers.
 const textBytes=Buffer.byteLength(prompt,'utf8')+Buffer.byteLength(pageInstruction(pages),'utf8');
 const imageTokens=dimensions.reduce((n,d)=>n+(p.image.kind==='fixed'?p.image.tokens:p.image.base+Math.ceil(d.width/p.image.width)*Math.ceil(d.height/p.image.height)*p.image.tokens),0);
 const input=textBytes+p.framingTokens+imageTokens,output=p.outputTokens;
 if(!Number.isSafeInteger(input)||input>p.maxInputTokens||input+output>p.contextTokens)throw Error('OCR_REQUEST_LIMIT');
 return{profile:p,pages,dimensions:dimensions.map(d=>({width:d.width,height:d.height})),promptSha256:createHash('sha256').update(prompt+'\n'+pageInstruction(pages)).digest('hex'),textBytes,imageTokens,input,output};
}
export function validUsage(usage:unknown,bound:OCRBound):{input:number;output:number}|null{
 const u=usage as {input?:unknown;output?:unknown};return u&&integer(u.input,bound.input)&&integer(u.output,bound.output,0)?{input:Number(u.input),output:Number(u.output)}:null;
}
