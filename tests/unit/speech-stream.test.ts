import {PcmStreamEncoder} from '@/lib/clinical/audio';
import {it,expect} from 'vitest';
import {SpeechStreamText} from '@/lib/clinical/speech-stream';
import {LiveSpeechTiming} from '@/lib/clinical/live-timing';
const frame=(start:number,text:string,final=true)=>({type:'Results',start,is_final:final,channel:{alternatives:[{transcript:text}]}});
it('keeps interim text separate and replaces duplicate final time spans without duplicate words',()=>{
 const s=new SpeechStreamText();expect(s.accept(frame(0,'five',false))).toMatchObject({type:'interim',text:'five'});expect(s.text).toBe('');
 s.accept(frame(0,'five mg'));s.accept(frame(0,'five milligrams'));s.accept(frame(2,'Sorry, ten milligrams.'));
 expect(s.text).toBe('five milligrams Sorry, ten milligrams.');expect(s.rawFinals).toHaveLength(3);expect(s.interim).toBe('');
});
it('bounds the result, rejects missing ordering/finality and does not manufacture a final from interim',()=>{
 const s=new SpeechStreamText();s.accept(frame(0,'No fever',false));expect(s.text).toBe('');expect(()=>s.accept({...frame(0,'bad'),start:NaN})).toThrow();expect(()=>s.accept(frame(0,'x'.repeat(8001)))).toThrow();
});

it('streams exactly sixty seconds of 44.1kHz input without per-frame rounding exceeding the PCM ceiling',()=>{
 const encoder=new PcmStreamEncoder(44100);let total=0;const source=new Float32Array(44100*60);for(let at=0;at<source.length;at+=4096)total+=encoder.encode(source.subarray(at,at+4096)).length;expect(total).toBe(1920000);
});
it('labels audio-energy timing separately from capture startup and retains timestamps only',()=>{const t=new LiveSpeechTiming();t.observe(new Uint8Array(3200),500);const samples=new Int16Array(1600).fill(4000);t.observe(new Uint8Array(samples.buffer),1000);t.interim(1200);t.final(1550);expect(t.metrics()).toEqual({energyOnsetToInterimMs:300,energyEndToFinalMs:550});});
