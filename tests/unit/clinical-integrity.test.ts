import { it, expect, vi, afterEach } from 'vitest';
import { captureClip } from '@/lib/clinical/capture';
import { encodeWav, validateWav } from '@/lib/clinical/audio';
import { validateProposal, proposalCandidate } from '@/lib/clinical/proposals';
import { emptySnapshot } from '@/lib/contracts/clinical';
import { approvedReport } from '@/lib/clinical/approved-report';
const source = { id: '00000000-0000-4000-8000-000000000081', sequence: 0, text: 'No fever. Source dose 2.5 mg, not 25 mg.' };
afterEach(() => vi.unstubAllGlobals());
it('capture reports microphone denial and abort during permission never retains a late stream', async () => {
    const onError = vi.fn(), onClip = vi.fn(), stop = vi.fn();
    vi.stubGlobal('AudioContext', class {
    });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
    await captureClip({ signal: new AbortController().signal, onError, onClip });
    expect(onError).toHaveBeenCalledWith('MICROPHONE_ACCESS_NOT_ALLOWED');
    expect(onClip).not.toHaveBeenCalled();
    let resolve!: (x: unknown) => void;
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(r => { resolve = r; }) } });
    const abort = new AbortController();
    const pending = captureClip({ signal: abort.signal, onError, onClip });
    abort.abort();
    resolve({ getTracks: () => [{ stop }] });
    await pending;
    expect(stop).toHaveBeenCalledOnce();
    expect(onClip).not.toHaveBeenCalled();
});
it('round trips bounded 48kHz PCM into independently decodable 16kHz mono WAV with measured duration', () => { const bytes = encodeWav(new Float32Array(48000 * 15).fill(0.25), 48000); expect(validateWav(bytes)).toMatchObject({ durationMs: 15000, sampleRate: 16000, channels: 1 }); expect(new DataView(bytes.buffer).getInt16(44, true)).toBe(8191); });
it('rejects forged duration/sample counts, compressed payloads and overlong audio instead of trusting metadata', () => { const bytes = encodeWav(new Float32Array(16000), 16000); new DataView(bytes.buffer).setUint32(24, 8000, true); expect(() => validateWav(bytes)).toThrow('INVALID_WAV'); expect(() => encodeWav(new Float32Array(16000 * 61), 16000)).toThrow(); expect(() => encodeWav(new Float32Array([NaN]), 16000)).toThrow(); expect(() => validateWav(new Uint8Array(44))).toThrow(); });
it('rejects arbitrary/prototype paths, unrelated source IDs and cursor drift', () => { for (const path of ['__proto__.admin', 'constructor.prototype', 'medications[1000000000].dose', 'unknown'])
    expect(() => validateProposal({ baseRevision: 1, throughSegmentId: source.id, operations: [{ op: 'set_fact', path, value: 'wrong', evidence_segment_ids: [source.id] }] }, [source])).toThrow(); expect(() => validateProposal({ baseRevision: 1, throughSegmentId: source.id, operations: [{ op: 'set_fact', path: 'chief_complaint', value: 'wrong', evidence_segment_ids: ['00000000-0000-4000-8000-000000000099'] }] }, [source])).toThrow(); });
it('late extraction never overwrites the manual dose, negation, units or numbers', () => { const snapshot = { ...emptySnapshot(), chief_complaint: 'No fever; 2.5 mg, not 25 mg' }; const p = validateProposal({ baseRevision: 2, throughSegmentId: source.id, operations: [{ op: 'set_fact', path: 'chief_complaint', value: 'fever; 25 mg', evidence_segment_ids: [source.id] }] }, [source]); const result = proposalCandidate(snapshot, 3, p); expect(result.state).toBe('stale'); expect(result.snapshot).toEqual(snapshot); expect(result.requiresReview).toBe(true); });
it('uncertain/retracted facts stay review tasks and cannot silently erase clinician findings', () => { const snapshot = { ...emptySnapshot(), chief_complaint: 'No fever' }; const p = validateProposal({ baseRevision: 2, throughSegmentId: source.id, operations: [{ op: 'retract_fact', path: 'chief_complaint', evidence_segment_ids: [source.id] }] }, [source]); expect(proposalCandidate(snapshot, 2, p)).toMatchObject({ state: 'review_required', snapshot, uncertain: ['chief_complaint'] }); });
it('print export escapes hostile notes while retaining negation, decimals and exact units', () => { const html = approvedReport({ id: 'test', reviewed_at: '2026-10-23', source_revision: 1, snapshot: { ...emptySnapshot(), chief_complaint: '<img src=x onerror=alert(1)> & no fever', vitals: [{ name: 'temperature', value: 98.6, unit: '°F', observedAt: null }] } }); expect(html).not.toContain('<img'); expect(html).toContain('&lt;img'); expect(html).toContain('98.6 °F'); expect(html).toContain('no fever'); expect(html).not.toContain('<script'); });

it('accepts exactly sixty seconds with validated 44-byte overhead and rejects extra samples/container padding', () => { const bytes=encodeWav(new Float32Array(16000*60),16000); expect(bytes.length).toBe(1920044); expect(validateWav(bytes).durationMs).toBe(60000); expect(()=>validateWav(new Uint8Array([...bytes,0,0]))).toThrow(); const forged=new Uint8Array(bytes); new DataView(forged.buffer).setUint32(40,1920002,true); expect(()=>validateWav(forged)).toThrow(); });

it('does not call a Web Audio start failure microphone permission denial; closes the granted stream',async()=>{
 const stop=vi.fn(),close=vi.fn(async()=>{}),onError=vi.fn(),onClip=vi.fn();
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop}]})}});
 vi.stubGlobal('AudioContext',class{sampleRate=48000;close=close;resume=async()=>{throw new DOMException('Audio start not allowed','NotAllowedError');};});
 await captureClip({signal:new AbortController().signal,onError,onClip,windowMs:60000});
 expect(onError).toHaveBeenCalledWith('AUDIO_START_NOT_ALLOWED');expect(onClip).not.toHaveBeenCalled();expect(stop).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
});
