import {timingSafeEqual} from 'node:crypto';
export function workerAuthorized(request:Request){const expected=process.env.DOCUMENT_DISPATCH_SECRET??'',supplied=request.headers.get('x-document-dispatch')??'';return expected.length>=32&&supplied.length<=512&&Buffer.byteLength(expected)===Buffer.byteLength(supplied)&&timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));}
