export const MAX_SPEECH_MS = 60000;
export const MAX_SPEECH_PCM_BYTES = 1920000;
// Only the canonical 44-byte PCM container emitted below is admitted.
export const SPEECH_WAV_OVERHEAD = 44;
export const MAX_SPEECH_WAV_BYTES = MAX_SPEECH_PCM_BYTES + SPEECH_WAV_OVERHEAD;
// PCM conversion/downsampling adapted from MediFlow 45fbfb853338d5236f2c34eb83e771ac4e9307ca
// src/hooks/useSTT.ts (Sujit Jaju and contributors). No provider transport.
export function downsample(input: Float32Array, inputRate: number) {
    if (!Number.isFinite(inputRate) || inputRate < 16000 || inputRate > 192000 || input.length > inputRate * MAX_SPEECH_MS / 1000 || !input.length)
        throw new Error("INVALID_AUDIO");
    if (input.some(x => !Number.isFinite(x)))
        throw new Error("INVALID_AUDIO");
    if (inputRate === 16000)
        return input;
    const ratio = inputRate / 16000, result = new Float32Array(Math.round(input.length / ratio));
    let offset = 0;
    for (let i = 0; i < result.length; i++) {
        const end = Math.round((i + 1) * ratio);
        let sum = 0, count = 0;
        for (let j = offset; j < end && j < input.length; j++) {
            sum += input[j];
            count++;
        }
        result[i] = count ? sum / count : 0;
        offset = end;
    }
    return result;
}
export function encodeWav(input: Float32Array, inputRate: number) {
    const samples = downsample(input, inputRate), bytes = new Uint8Array(44 + samples.length * 2), v = new DataView(bytes.buffer);
    const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++)
        v.setUint8(offset + i, s.charCodeAt(i)); };
    text(0, 'RIFF');
    v.setUint32(4, bytes.length - 8, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    text(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return bytes;
}
export function validateWav(bytes: Uint8Array) {
    if (bytes.length < 46 || bytes.length > MAX_SPEECH_WAV_BYTES || bytes.length % 2)
        throw new Error('INVALID_WAV');
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), text = (o: number, n: number) => new TextDecoder().decode(bytes.slice(o, o + n));
    if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE' || text(12, 4) !== 'fmt ' || text(36, 4) !== 'data' || v.getUint32(4, true) !== bytes.length - 8 || v.getUint32(16, true) !== 16 || v.getUint16(20, true) !== 1 || v.getUint16(22, true) !== 1 || v.getUint32(24, true) !== 16000 || v.getUint32(28, true) !== 32000 || v.getUint16(32, true) !== 2 || v.getUint16(34, true) !== 16 || v.getUint32(40, true) !== bytes.length - 44)
        throw new Error('INVALID_WAV');
    const durationMs = (bytes.length - 44) / 32;
    if (durationMs <= 0 || durationMs > MAX_SPEECH_MS)
        throw new Error('AUDIO_DURATION_LIMIT');
    return { durationMs, sampleRate: 16000, channels: 1, bytes: bytes.length };
}
