import {getSupabaseServerClient,getSupabaseAdminClient} from '@/lib/supabase-server';
import {speechContext} from '@/lib/server/speech/service';
import {privateJson,errorResponse,HttpError} from '@/lib/server/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Explicit read-only account preflight for the finite synthetic demonstration.
// No /listen request, audio, key distribution or billing mutation is reachable.
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
 const client=await getSupabaseServerClient(),cid=(await params).id,actor=await speechContext(client,cid),ref=process.env.LIVE_CONSULTATION_DEMO_REF,project=process.env.DEEPGRAM_PROJECT_ID;
 if(!ref||!project||!process.env.DEEPGRAM_API_KEY)throw new HttpError(503,'READINESS_NOT_CONFIGURED','Demonstration readiness is not configured.');
 const scope=await getSupabaseAdminClient().from('speech_allowances').select('id').eq('authorization_ref',ref).eq('actor_id',actor.actorId).eq('consultation_id',cid).eq('mode','live').maybeSingle();
 if(scope.error||!scope.data)throw new HttpError(404,'NOT_FOUND','Demonstration scope unavailable.');
 if(!/^[a-f0-9-]{36}$/i.test(project))throw new HttpError(503,'READINESS_NOT_CONFIGURED','Project reference is unavailable.');
 const r=await fetch('https://api.deepgram.com/v1/projects/'+project+'/balances',{headers:{authorization:'Token '+process.env.DEEPGRAM_API_KEY},signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store'});
 if(!r.ok)return privateJson({data:{verified:false,layer:'deepgram-management',status:r.status,inferenceCalls:0}});
 const raw=await r.json() as{balances?:{amount?:unknown;units?:unknown}[]};
 const usd=raw.balances?.filter(b=>b.units==='USD'&&typeof b.amount==='number'&&Number.isFinite(b.amount)).reduce((sum,b)=>sum+Number(b.amount),0);
 return privateJson({data:{verified:typeof usd==='number'&&usd>=1,availableUsd:usd??null,layer:'deepgram-management',inferenceCalls:0}});
 }catch(e){return errorResponse(e);}
}
