import {afterEach,expect,it,vi} from 'vitest';
import {previewOCRAccounting} from '@/lib/server/ocr/preview-accounting';
import {requestBound} from '@/lib/server/ocr/accounting';
import {OCR_PROMPT} from '@/lib/server/ocr/provider';
import {speechTransport,deepgramTransport,retainedSpeech} from '@/lib/server/speech/transport';
afterEach(()=>vi.unstubAllEnvs());
it('two source images plus documented framing and bounded output fit the actual 8000 TPM ceiling',()=>{
 const b=requestBound(previewOCRAccounting,OCR_PROMPT,[2,1]);expect(b.imageTokens).toBe(4096);expect(b.input+b.output).toBeLessThanOrEqual(8000);expect(b.output).toBe(1000);
 expect(()=>requestBound({...previewOCRAccounting,maxInputTokens:50000},'x'.repeat(6000),[1])).toThrow('OCR_REQUEST_LIMIT');
});
it('model and language must move together while the legacy injected adapter retains its exact contract',async()=>{
 vi.stubEnv('SPEECH_ENABLED','true');vi.stubEnv('SPEECH_PROVIDER_VERIFIED','true');vi.stubEnv('DEEPGRAM_API_KEY','synthetic');vi.stubEnv('LIVE_SPEECH_AUTHORIZATION_REF','synthetic');vi.stubEnv('AI_SPEECH_MODEL','nova-3-medical');vi.stubEnv('AI_SPEECH_LANGUAGE','hi');expect(speechTransport().mode).toBe('disabled');
 const send=vi.fn(async(_request:{url:string})=>({results:{channels:[{alternatives:[{transcript:'Synthetic historical transcript'}]}]}}));
 await deepgramTransport('offline_fixture','synthetic',send,retainedSpeech).transcribe(new Uint8Array([1]),new AbortController().signal);
 const url=new URL(send.mock.calls[0][0].url);expect(url.searchParams.get('model')).toBe('nova-2');expect(url.searchParams.get('language')).toBe('hi');expect(url.searchParams.getAll('keywords')).toContain('paracetamol:5');
});

it('keeps raw provider output separate from the normalized transcript',async()=>{const raw={metadata:{request_id:'synthetic'},results:{channels:[{alternatives:[{transcript:'  No fever.  ',confidence:0.9}]}]}};const reply=await deepgramTransport('offline_fixture','synthetic',async()=>raw,retainedSpeech).transcribe(new Uint8Array([1]),new AbortController().signal);expect(reply.text).toBe('No fever.');expect(reply.raw).toEqual(raw);});
