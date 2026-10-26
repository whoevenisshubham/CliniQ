import { encodeWav, MAX_SPEECH_MS } from './audio';
// Capture lifecycle/PCM processing adapted from MediFlow useSTT 45fbfb85 and
// CliniQ useMedicalScribe d2fadb62. This bounded local adapter has no transport,
// keys or automatic provider/model selection. Start only after a user action.
export async function captureClip(options: {
    signal: AbortSignal;
    onClip: (wav: Uint8Array) => void;
    onError: (code: string) => void;
    windowMs?: number;
    onCaptureEnd?: () => void;
}) {
    const windowMs = options.windowMs ?? 15000;
    if (windowMs < 1000 || windowMs > MAX_SPEECH_MS)
        throw new Error('INVALID_CAPTURE_WINDOW');
    let stream: MediaStream | null = null, context: AudioContext | null = null, source: MediaStreamAudioSourceNode | null = null, processor: ScriptProcessorNode | null = null, gain: GainNode | null = null;
    let frames: Float32Array[] = [], length = 0, closed = false, timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { if (closed)
        return; closed = true; if (timer)
        clearTimeout(timer); processor?.disconnect(); source?.disconnect(); gain?.disconnect(); stream?.getTracks().forEach(t => t.stop()); void context?.close(); frames = []; length = 0; options.signal.removeEventListener('abort', stop); };
    options.signal.addEventListener('abort', stop, { once: true });
    try {
        if (options.signal.aborted) {
            stop();
            return { stop };
        }
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined')
            throw new Error('CAPTURE_UNSUPPORTED');
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
        if (closed || options.signal.aborted) {
            stream.getTracks().forEach(t => t.stop());
            return { stop };
        }
        context = new AudioContext();
        if (context.sampleRate < 16000 || context.sampleRate > 192000)
            throw new Error('CAPTURE_RATE_UNSUPPORTED');
        await context.resume();
        if (closed || options.signal.aborted) {
            stop();
            return { stop };
        }
        source = context.createMediaStreamSource(stream);
        processor = context.createScriptProcessor(4096, 1, 1);
        gain = context.createGain();
        gain.gain.value = 0;
        const maxSamples = Math.floor(context.sampleRate * windowMs / 1000);
        const finish = () => { if (closed)
            return; try {
            if (!length)
                throw new Error('CAPTURE_EMPTY');
            options.onCaptureEnd?.();
            const samples = new Float32Array(length);
            let offset = 0;
            for (const frame of frames) {
                samples.set(frame, offset);
                offset += frame.length;
            }
            const wav = encodeWav(samples, context!.sampleRate);
            stop();
            options.onClip(wav);
        }
        catch (e) {
            stop();
            options.onError(e instanceof Error ? e.message : 'CAPTURE_FAILED');
        } };
        processor.onaudioprocess = event => { if (closed)
            return; const frame = event.inputBuffer.getChannelData(0).slice(0, maxSamples - length); if (frame.length) {
            frames.push(frame);
            length += frame.length;
        } if (length >= maxSamples)
            finish(); };
        source.connect(processor);
        processor.connect(gain);
        gain.connect(context.destination);
        timer = setTimeout(finish, windowMs + 1000);
        return { stop, finish };
    }
    catch (e) {
        stop();
        options.onError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'MICROPHONE_DENIED' : e instanceof Error ? e.message : 'CAPTURE_FAILED');
        return { stop };
    }
}
