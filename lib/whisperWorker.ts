/* eslint-disable @typescript-eslint/no-explicit-any */
import { pipeline, env } from '@huggingface/transformers';

// Skip local model check and strictly use HF hub models.
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: any = null;

self.onmessage = async (e: MessageEvent) => {
    const { type, id, device, audio, language } = e.data;

    if (type === 'load') {
        try {
            // Load the pipeline
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
                device: device === 'webgpu' ? 'webgpu' : 'wasm',
            });
            self.postMessage({ type: 'loaded' });
        } catch (err: any) {
            self.postMessage({ type: 'error', error: err.message || err.toString() });
        }
    } else if (type === 'transcribe') {
        if (!transcriber) return;
        try {
            // Run transcription
            // The transformers pipeline expects Float32Array
            const result = await transcriber(audio, {
                language,
                task: 'transcribe',
                // To keep latency low for small chunks, we don't need large chunk_length_s
            });
            self.postMessage({ type: 'result', id, text: result.text });
        } catch (err: any) {
            self.postMessage({ type: 'error', id, error: err.message || err.toString() });
        }
    }
};
