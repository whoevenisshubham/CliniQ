import {afterEach,it,expect,vi} from 'vitest';
const f=vi.hoisted(()=>({cap:180000,upgrade:vi.fn(()=>new Response(null,{status:200}))}));
vi.mock('@vercel/functions',()=>({upgradeWebSocket:f.upgrade}));
vi.mock('@/lib/supabase-server',()=>({getSupabaseServerClient:async()=>({rpc:async()=>({data:1,error:null})}),getSupabaseAdminClient:()=>({})}));
vi.mock('@/lib/server/speech/service',()=>({speechContext:vi.fn(),speechAvailability:async()=>({available:true,mode:'live',maxClipMs:f.cap})}));
vi.mock('@/lib/server/speech/stream',()=>({relaySpeech:vi.fn()}));
import {GET} from '@/app/api/clinical/[id]/speech/live/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();f.cap=180000;});
const request=(version:string)=>new Request('https://preview.example/api/clinical/visit/speech/live?operation=11111111-1111-4111-8111-111111111111&segment=22222222-2222-4222-8222-222222222222&sequence=0&revision=0'+version,{headers:{origin:'https://preview.example',upgrade:'websocket'}});
it('rejects an old client before upgrading or consuming an extended allowance',async()=>{
 vi.stubEnv('APP_ORIGIN','https://preview.example');vi.stubEnv('SPEECH_STREAMING_ENABLED','true');const r=await GET(request(''),{params:Promise.resolve({id:'visit'})});expect(r.status).toBe(409);expect(f.upgrade).not.toHaveBeenCalled();
});
it('allows the matching extended protocol and preserves older one-minute clients',async()=>{
 vi.stubEnv('APP_ORIGIN','https://preview.example');vi.stubEnv('SPEECH_STREAMING_ENABLED','true');expect((await GET(request('&streamVersion=2'),{params:Promise.resolve({id:'visit'})})).status).toBe(200);expect(f.upgrade).toHaveBeenCalledOnce();f.cap=60000;expect((await GET(request(''),{params:Promise.resolve({id:'visit'})})).status).toBe(200);expect(f.upgrade).toHaveBeenCalledTimes(2);
});
