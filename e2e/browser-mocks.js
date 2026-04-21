/**
 * Browser-side mocks for Web Speech API & MediaDevices.
 * Injected via page.addInitScript() before each test.
 *
 * Exposes window.__mocks for test-side control:
 *   - __mocks.emitSegment(text, isFinal) — simulate a speech result
 *   - __mocks.emitSpeechError(error)     — simulate a speech error
 *   - __mocks.speechInstances             — track created recognizers
 */

(() => {
  // --- MediaDevices mock ---
  const fakeDevices = [
    {
      deviceId: "default-mic",
      kind: "audioinput",
      label: "Default Microphone",
      groupId: "group1",
      toJSON() { return this; },
    },
    {
      deviceId: "secondary-mic",
      kind: "audioinput",
      label: "Secondary Microphone",
      groupId: "group2",
      toJSON() { return this; },
    },
  ];

  const fakeTrack = {
    stop: () => {},
    kind: "audio",
    id: "fake-track",
    enabled: true,
    readyState: "live",
  };

  const fakeStream = {
    getTracks: () => [fakeTrack],
    getAudioTracks: () => [fakeTrack],
    active: true,
  };

  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = async () => fakeDevices;
    navigator.mediaDevices.getUserMedia = async () => fakeStream;
  }

  // --- SpeechRecognition mock ---
  const mocks = {
    speechInstances: [],
    emitSegment(text, isFinal = true) {
      const instance = mocks.speechInstances[mocks.speechInstances.length - 1];
      if (!instance || !instance.onresult) return;
      const event = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            0: { transcript: text, confidence: 0.95 },
            isFinal,
            length: 1,
          },
        },
      };
      instance.onresult(event);
    },
    emitSpeechError(error) {
      const instance = mocks.speechInstances[mocks.speechInstances.length - 1];
      if (!instance || !instance.onerror) return;
      instance.onerror({ error });
    },
  };

  class MockSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = "";
    maxAlternatives = 1;
    onresult = null;
    onerror = null;
    onend = null;
    _running = false;

    constructor() {
      mocks.speechInstances.push(this);
    }

    start() {
      this._running = true;
    }

    stop() {
      this._running = false;
      if (this.onend) this.onend();
    }

    abort() {
      this.stop();
    }
  }

  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;
  window.__mocks = mocks;
})();
