# Whisper WebGPU Transcription — Implementation Plan

## Problem

Open Meet currently uses the browser's Web Speech API (`webkitSpeechRecognition`) for live transcription. This has significant limitations:

- Chrome/Edge only
- Requires an internet connection (audio is sent to Google servers)
- Poor accuracy for non-English languages
- No control over the model or its behavior
- Privacy concern — audio leaves the device

We want to replace this with **Whisper running locally via WebGPU**, keeping everything on-device. The reference implementation is [xenova/whisper-web (experimental-webgpu branch)](https://github.com/xenova/whisper-web/tree/experimental-webgpu), which uses `@huggingface/transformers` to run quantized Whisper ONNX models entirely in the browser.

## Reference Architecture (whisper-web)

```
Main Thread (React)                       Web Worker
┌────────────────────────┐               ┌──────────────────────────────┐
│ AudioManager           │               │ PipelineFactory (singleton)  │
│  • URL / File / Mic    │  postMessage  │  • @huggingface/transformers │
│  • AudioContext@16kHz  │──────────────►│  • device: "webgpu"          │
│  • Stereo→Mono mixdown │               │  • dtype: fp16/fp32 + q4     │
│                        │               │                              │
│ useTranscriber hook    │  postMessage  │ WhisperTextStreamer           │
│  • progress tracking   │◄──────────────│  • token-by-token streaming  │
│  • streaming UI update │               │  • TPS measurement           │
│                        │               │  • chunk offset tracking     │
└────────────────────────┘               └──────────────────────────────┘
```

Key patterns from the reference:
- **Singleton pipeline factory** — one model instance, disposed + recreated on model change
- **7-status worker protocol**: `initiate → progress → done` (per model file), `ready`, `update` (streaming), `complete`, `error`
- **Sliding-window chunking**: 30s chunks / 5s stride (standard), 20s / 3s (distil)
- **Greedy decoding**: `top_k: 0, do_sample: false, return_timestamps: true`
- **Quantization**: encoder at fp16/fp32, decoder at q4 (4-bit)

## Our Architecture

Unlike whisper-web (which transcribes pre-recorded audio files), Open Meet needs **live microphone transcription**. This requires a fundamentally different audio pipeline: we must continuously capture mic audio, buffer it, and feed chunks to Whisper in a loop.

```
┌─ Main Thread ─────────────────────────────────────────────────────────┐
│                                                                       │
│  RecordingSession / MeetingDetail                                     │
│    │                                                                  │
│    ├── createWhisperTranscriber(onSegment, onError, lang)             │
│    │     returns SpeechController { start(), stop(), isListening() }  │
│    │                                                                  │
│    └── lib/whisper.ts                                                 │
│          ├── getUserMedia → MediaStream                               │
│          ├── AudioContext (sampleRate: 16000)                          │
│          ├── MediaStreamSource → AudioWorkletNode                     │
│          │     (captures PCM float32 chunks in real-time)             │
│          ├── Ring buffer accumulates ~10-15s of audio                 │
│          ├── On buffer full → postMessage(float32Array) to worker     │
│          └── Worker responses → mapped to TranscriptSegment           │
│                                                                       │
├─ AudioWorklet Thread ─────────────────────────────────────────────────┤
│  audio-capture-processor.js                                           │
│    • Receives 128-sample frames from AudioContext                     │
│    • Posts PCM chunks to main thread via port.postMessage             │
│                                                                       │
├─ Web Worker Thread ───────────────────────────────────────────────────┤
│  whisper-worker.ts                                                    │
│    • PipelineFactory singleton (same pattern as reference)            │
│    • Receives audio chunks, runs transcriber pipeline                 │
│    • Streams partial results back via WhisperTextStreamer              │
│    • Handles model download progress reporting                        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Implementation Todos

### 1. Next.js Configuration

Update `next.config.ts`:
- Add `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers (required for `SharedArrayBuffer` which `@huggingface/transformers` may use internally)
- Configure webpack to handle `.wasm` files and ONNX model loading if needed
- Ensure web workers can be bundled correctly with Next.js

### 2. Web Worker — `lib/whisper-worker.ts`

Port the worker from whisper-web, adapted for our needs:
- `PipelineFactory` singleton with WebGPU device, same quantization strategy (encoder fp16/fp32, decoder q4)
- `AutomaticSpeechRecognitionPipelineFactory` extending it
- Message handler supporting: `load` (pre-load model), `transcribe` (process audio chunk), `dispose` (cleanup)
- `WhisperTextStreamer` for streaming partial results
- Same 7-status protocol: `initiate`, `progress`, `done`, `ready`, `update`, `complete`, `error`
- Model hot-swap with `dispose()` on change

### 3. AudioWorklet Processor — `public/audio-capture-processor.js`

A minimal AudioWorkletProcessor that:
- Receives 128-sample PCM frames from the AudioContext
- Forwards them to the main thread via `port.postMessage`
- This runs on a dedicated audio thread, ensuring no gaps in capture

### 4. Whisper Transcription Module — `lib/whisper.ts`

The main integration module, implementing the existing `SpeechController` interface:

```typescript
export function createWhisperTranscriber(
  onSegment: SpeechCb,
  onError: ErrorCb,
  lang: string
): SpeechController
```

Responsibilities:
- **Audio pipeline setup**: `getUserMedia` → `AudioContext@16kHz` → `MediaStreamSource` → `AudioWorkletNode`
- **Audio buffering**: Accumulate PCM frames from the worklet into a ring buffer. When ~10-15 seconds of audio is collected, send to the worker for transcription
- **Worker lifecycle**: Create worker, handle all 7 message statuses, map Whisper output chunks to `TranscriptSegment { text, timestamp, isFinal }`
- **Overlap handling**: Maintain a small overlap between consecutive audio buffers (2-3s) to avoid cutting words at boundaries. De-duplicate overlapping text
- **Cleanup**: On `stop()`, flush remaining buffer, close AudioContext, terminate worker

### 5. Language Mapping

Create a mapping from our BCP-47 language codes to Whisper language tokens:

```
hi-IN → hindi
en-IN → english
en-US → english
en-GB → english
ta-IN → tamil
te-IN → telugu
kn-IN → kannada
mr-IN → marathi
bn-IN → bengali
```

Add this to `lib/whisper.ts` or as a shared constant.

### 6. Feature Detection & Fallback — Update `lib/speech.ts`

Add WebGPU detection:

```typescript
export function isWhisperSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}
```

Update consuming components to prefer Whisper when available, falling back to Web Speech API. The `SpeechController` interface stays identical — consumers don't need to know which engine is running.

### 7. Model Download Progress UI

Add a progress indicator for first-time model download (models are ~120-600MB depending on selection):
- Show download progress per file (the worker reports `initiate`/`progress`/`done` per ONNX shard)
- Cache in browser (OPFS/Cache API — handled by `@huggingface/transformers` automatically)
- Subsequent loads are instant from cache

### 8. Update `RecordingSession.tsx` and `MeetingDetail.tsx`

Both components currently call `createSpeechRecognizer()`. Update them to:
- Check `isWhisperSupported()` first, fall back to `createSpeechRecognizer()`
- Or: create a unified factory function `createTranscriber()` that auto-selects
- Wire up model download progress state for the UI indicator
- Handle the async nature of Whisper model loading (show loading state before first transcription)

### 9. Model Selection UI (Optional / Future)

Add a setting to choose Whisper model size:

| Model | Size | Quality | Speed |
|-------|------|---------|-------|
| whisper-tiny | ~120 MB | Basic | Fastest |
| whisper-base | ~206 MB | Good | Fast |
| whisper-small | ~586 MB | Better | Moderate |
| whisper-large-v3-turbo | ~1.6 GB | Best | Slower |

Default: `whisper-base` on desktop, `whisper-tiny` on mobile (same strategy as reference).

## Dependency

One new dependency: `@huggingface/transformers` (v3+ with WebGPU support).

## Key Differences From Reference

| Aspect | whisper-web | Our implementation |
|--------|------------|-------------------|
| Audio source | File / URL / one-shot recording | **Live continuous mic stream** |
| Transcription mode | Process entire audio at once | **Rolling buffer, process in ~10-15s chunks** |
| Framework | Vite + React | **Next.js + React** |
| Worker bundling | Vite ES module worker | **Next.js webpack worker** |
| Result display | Timestamped chunks | **TranscriptSegment stream (text + timestamp + isFinal)** |
| Fallback | None (WebGPU required) | **Web Speech API fallback** |
| State management | React hooks (useTranscriber) | **Component-local state + IndexedDB persistence** |

## Implementation Order

1. Next.js config (headers, webpack)
2. AudioWorklet processor
3. Web Worker (port from reference)
4. `lib/whisper.ts` (core module)
5. Language mapping
6. Feature detection + fallback wiring
7. Component updates (RecordingSession + MeetingDetail)
8. Model download progress UI
9. Testing across browsers with WebGPU support
