import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {readPrivateContent} from '@/lib/server/documents/content';
import {resolvePrincipal} from '@/lib/server/auth/context';
import {ocrCheck} from '@/lib/server/ocr/service';
import {renderOCRImages} from '@/lib/server/ocr/images';
import {errorResponse,HttpError} from '@/lib/server/http';
export const runtime='nodejs';
export const maxDuration=120;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 // Native source rendering is a private read, not provider inference. Keep it
 // available for manual review while all live OCR admission remains disabled.
 const client=await getSupabaseServerClient();await resolvePrincipal(client);const did=(await params).id,url=new URL(request.url),vid=url.searchParams.get('version')??'',n=Number(url.searchParams.get('page'));
 if(!Number.isInteger(n)||n<1||n>20)throw new HttpError(422,'INVALID_PAGES','Choose a source page.');const current=async()=>{const d=await client.from('documents').select('current_version_id,status').eq('id',did).maybeSingle();ocrCheck(d.error);if(d.data?.current_version_id!==vid||d.data.status!=='ready')throw new HttpError(404,'NOT_FOUND','Source unavailable.');};await current();
 const r=await readPrivateContent(client,getSupabaseAdminClient,did,vid);const images=await renderOCRImages(new Uint8Array(await r.arrayBuffer()),r.headers.get('content-type')??'',[n],request.signal);await current();return new Response(new Blob([images[0].bytes as BlobPart],{type:'image/png'}),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Content-Type':'image/png','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){return errorResponse(e instanceof HttpError?e:new HttpError(422,'SOURCE_PREVIEW_UNAVAILABLE','Source preview unavailable. Use the retained original and manual transcription.'));}}
