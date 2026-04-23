/* eslint-disable @typescript-eslint/no-explicit-any */
import { SpeechController } from "./speech";

export interface WhisperConfig {
    device: "wasm" | "webgpu";
    language: string;
}

export async function createWhisperRecognizer(
    onSegment: (seg: { text: string; timestamp: number; isFinal: boolean }) => void,
    onError: (error: string) => void,
    config: WhisperConfig
): Promise<SpeechController> {
    let listening = false;
    let worker: Worker | null = null;
    let audioContext: AudioContext | null = null;
    let mediaStream: MediaStream | null = null;
    let processorNode: ScriptProcessorNode | null = null;
    let mediaStreamSource: MediaStreamAudioSourceNode | null = null;

    // Buffer state
    let audioData: Float32Array[] = [];
    let currentId = 0;

    // Create Web Worker
    try {
        worker = new Worker(new URL('./whisperWorker.ts', import.meta.url), { type: 'module' });
    } catch (e: any) {
        onError("Failed to create worker: " + e.message);
        throw e;
    }

    worker.onmessage = (e) => {
        const { type, text, error } = e.data;
        if (type === 'loaded') {
            // ready
        } else if (type === 'result') {
            if (text && text.trim().length > 0) {
                onSegment({
                    text: text.trim(),
                    timestamp: Date.now(),
                    isFinal: true
                });
            }
        } else if (type === 'error') {
            onError(error || "Worker error");
        }
    };

    worker.postMessage({ type: 'load', device: config.device });

    const SAMPLING_RATE = 16000;

    async function startAudio() {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLING_RATE });
            mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);

            // buffer size: 4096 (approx 0.25s at 16000Hz)
            processorNode = audioContext.createScriptProcessor(4096, 1, 1);

            processorNode.onaudioprocess = (e) => {
                if (!listening) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const chunk = new Float32Array(inputData.length);
                chunk.set(inputData);
                audioData.push(chunk);

                // Accumulate around 3 seconds of audio before sending to transcribe
                // 3 sec * 16000 samples/sec = 48000 samples
                const totalLength = audioData.reduce((acc, c) => acc + c.length, 0);
                if (totalLength >= SAMPLING_RATE * 3) {
                    const merged = new Float32Array(totalLength);
                    let offset = 0;
                    for (const ch of audioData) {
                        merged.set(ch, offset);
                        offset += ch.length;
                    }
                    audioData = []; // clear buffer

                    if (worker) {
                        worker.postMessage({
                            type: 'transcribe',
                            id: ++currentId,
                            audio: merged,
                            language: config.language
                        });
                    }
                }
            };

            mediaStreamSource.connect(processorNode);
            processorNode.connect(audioContext.destination);

        } catch (e: any) {
            onError("Audio capture failed: " + e.message);
        }
    }

    return {
        start: () => {
            listening = true;
            if (!audioContext) {
                startAudio();
            } else if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        },
        stop: () => {
            listening = false;

            // process remaining buffer
            if (audioData.length > 0 && worker) {
                const totalLength = audioData.reduce((acc, c) => acc + c.length, 0);
                const merged = new Float32Array(totalLength);
                let offset = 0;
                for (const chunk of audioData) {
                    merged.set(chunk, offset);
                    offset += chunk.length;
                }
                audioData = [];
                worker.postMessage({
                    type: 'transcribe',
                    id: ++currentId,
                    audio: merged,
                    language: config.language
                });
            }

            if (processorNode) {
                processorNode.disconnect();
                processorNode = null;
            }
            if (mediaStreamSource) {
                mediaStreamSource.disconnect();
                mediaStreamSource = null;
            }
            if (audioContext) {
                audioContext.close();
                audioContext = null;
            }
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
                mediaStream = null;
            }
        },
        isListening: () => listening
    };
}
