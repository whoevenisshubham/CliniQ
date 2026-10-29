import {afterEach,it,expect,vi} from 'vitest';
import {captureClip} from '@/lib/clinical/capture';
import {speechResponse} from '@/lib/client/workspace-response';
afterEach(()=>vi.unstubAllGlobals());
it('admits three minutes only for streaming; batch and oversized envelopes remain rejected',()=>{
 const body=(streaming:boolean,maxClipMs:number)=>({data:{available:true,mode:'live',streaming,maxClipMs}});
 expect(speechResponse(body(true,180000),'availability')).toBe(true);
 expect(speechResponse(body(false,180000),'availability')).toBe(false);
 expect(speechResponse(body(true,180001),'availability')).toBe(false);
});
it('streams three minutes of PCM without constructing a batch WAV and cleans up once',async()=>{
 const stop=vi.fn(),close=vi.fn(async()=>{}),onClip=vi.fn(),onStreamEnd=vi.fn(),onError=vi.fn();let bytes=0;
 const processor={connect:vi.fn(),disconnect:vi.fn(),onaudioprocess:null as null|((e:{inputBuffer:{getChannelData:()=>Float32Array}})=>void)};
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop}]})}});
 vi.stubGlobal('AudioContext',class{sampleRate=16000;destination={};close=close;resume=async()=>{};createMediaStreamSource=()=>({connect:vi.fn(),disconnect:vi.fn()});createScriptProcessor=()=>processor;createGain=()=>({gain:{value:1},connect:vi.fn(),disconnect:vi.fn()});});
 await captureClip({signal:new AbortController().signal,windowMs:180000,streamOnly:true,onFrame:p=>{bytes+=p.length;},onStreamEnd,onClip,onError});
 const frame=new Float32Array(4096).fill(0.1);for(let i=0;i<Math.ceil(16000*180/4096);i++)processor.onaudioprocess!({inputBuffer:{getChannelData:()=>frame}});
 expect(bytes).toBe(5760000);expect(onStreamEnd).toHaveBeenCalledOnce();expect(onClip).not.toHaveBeenCalled();expect(onError).not.toHaveBeenCalled();expect(stop).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
});
it('rejects an extended batch capture before asking for microphone access',async()=>{
 const mic=vi.fn();vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:mic}});
 await expect(captureClip({signal:new AbortController().signal,windowMs:180000,onClip:vi.fn(),onError:vi.fn()})).rejects.toThrow('INVALID_CAPTURE_WINDOW');expect(mic).not.toHaveBeenCalled();
});
