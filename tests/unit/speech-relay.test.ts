import {it,expect,vi,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';
import type {SupabaseClient} from '@supabase/supabase-js';
import type WebSocket from 'ws';
const fixture=vi.hoisted(()=>({upstreams:[] as unknown[]}));
vi.mock('ws',async()=>{const {EventEmitter}=await import('node:events');return{default:class extends EventEmitter{
 static OPEN=1;readyState=1;bufferedAmount=0;sent:unknown[]=[];
 constructor(public url:string,public options:unknown){super();fixture.upstreams.push(this);}
 send(data:unknown){this.sent.push(data);}terminate(){this.readyState=3;this.emit('close');}
}};});
import {relaySpeech} from '@/lib/server/speech/stream';
class ClientSocket extends EventEmitter {readyState=1;bufferedAmount=0;sent:string[]=[];send(v:string){this.sent.push(v);}close(){this.readyState=3;this.emit('close');}}
type Upstream=EventEmitter&{sent:unknown[];url:string};
afterEach(()=>{fixture.upstreams=[];vi.unstubAllEnvs();});
const command={cid:'synthetic-cid',key:'synthetic-key',segmentId:'synthetic-segment',sequence:0,revision:0,capMs:60000,ref:'synthetic-only'};
function inputs(reserve=true,checkpoints=false){
 const rpc=vi.fn(async(name:string)=>({error:null,data:name==='speech_checkpoint_capability'?(checkpoints?1:0):name==='speech_stream_checkpoint'?{id:'saved-final',revision:1}:name==='speech_admit'?'synthetic-operation':name==='speech_reserve'?reserve:name==='speech_commit'?{state:'saved',revision:1}:true}));
 return{rpc,client:{rpc,auth:{getUser:async()=>({data:{user:{id:'synthetic'}},error:null})}} as unknown as SupabaseClient,admin:{rpc} as unknown as SupabaseClient};
}
function configure(){vi.stubEnv('AI_SPEECH_MODEL','nova-3-medical');vi.stubEnv('AI_SPEECH_LANGUAGE','multi');vi.stubEnv('DEEPGRAM_API_KEY','synthetic-not-real');}
it('reserves before connecting, relays interim text, retains final raw output and saves once',async()=>{
 configure();const socket=new ClientSocket(),i=inputs();await relaySpeech(socket as unknown as WebSocket,i.client,i.admin,command);
 const upstream=fixture.upstreams[0] as Upstream;expect(i.rpc.mock.calls.findIndex(([n])=>n==='speech_reserve')).toBeGreaterThan(-1);expect(new URL(upstream.url).searchParams.get('interim_results')).toBe('true');
 upstream.emit('open');socket.emit('message',Buffer.alloc(32000),true);
 for(const is_final of [false,true])upstream.emit('message',Buffer.from(JSON.stringify({type:'Results',start:0,is_final,channel:{alternatives:[{transcript:'Synthetic no fever.'}]}})));
 socket.emit('message',Buffer.from(JSON.stringify({type:'finish'})),false);upstream.emit('close');
 await vi.waitFor(()=>expect(socket.sent.some(s=>JSON.parse(s).type==='saved')).toBe(true));
 expect(i.rpc.mock.calls.filter(([n])=>n==='speech_stream_receipt')).toHaveLength(1);expect(i.rpc.mock.calls.filter(([n])=>n==='speech_commit')).toHaveLength(1);
 expect(socket.sent.join(' ')).not.toContain('synthetic-not-real');expect(socket.sent.some(s=>JSON.parse(s).type==='interim')).toBe(true);
});
it('never opens an upstream connection when the durable reservation is refused',async()=>{
 configure();const socket=new ClientSocket(),i=inputs(false);await relaySpeech(socket as unknown as WebSocket,i.client,i.admin,command);expect(fixture.upstreams).toHaveLength(0);expect(socket.sent.join(' ')).toContain('ALLOWANCE_UNAVAILABLE');
});
it('rejects odd PCM and does not publish or automatically reconnect',async()=>{
 configure();const socket=new ClientSocket(),i=inputs();await relaySpeech(socket as unknown as WebSocket,i.client,i.admin,command);const upstream=fixture.upstreams[0] as Upstream;upstream.emit('open');socket.emit('message',Buffer.alloc(3),true);
 await vi.waitFor(()=>expect(socket.readyState).toBe(3));expect(fixture.upstreams).toHaveLength(1);expect(i.rpc.mock.calls.some(([n])=>n==='speech_stream_receipt'||n==='speech_commit')).toBe(false);
});

it('saves final checkpoints before the stream ends; interim never reaches the durable checkpoint',async()=>{
 configure();const socket=new ClientSocket(),i=inputs(true,true);await relaySpeech(socket as unknown as WebSocket,i.client,i.admin,command);const upstream=fixture.upstreams[0] as Upstream;upstream.emit('open');socket.emit('message',Buffer.alloc(32000),true);
 upstream.emit('message',Buffer.from(JSON.stringify({type:'Results',start:0,is_final:false,channel:{alternatives:[{transcript:'five'}]}})));expect(i.rpc.mock.calls.some(([n])=>n==='speech_stream_stage')).toBe(false);
 upstream.emit('message',Buffer.from(JSON.stringify({type:'Results',start:0,is_final:true,channel:{alternatives:[{transcript:'Synthetic dose 5 mg.'}]}})));
 await vi.waitFor(()=>expect(socket.sent.some(s=>JSON.parse(s).type==='checkpoint')).toBe(true));expect(i.rpc.mock.calls.some(([n])=>n==='speech_commit')).toBe(false);
 socket.emit('message',Buffer.from(JSON.stringify({type:'finish'})),false);upstream.emit('close');await vi.waitFor(()=>expect(socket.sent.some(s=>JSON.parse(s).type==='saved')).toBe(true));expect(i.rpc.mock.calls.findIndex(([n])=>n==='speech_stream_checkpoint')).toBeLessThan(i.rpc.mock.calls.findIndex(([n])=>n==='speech_stream_receipt'));
});
