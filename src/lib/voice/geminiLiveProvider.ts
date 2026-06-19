import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { isUnexpectedTranscriptScript } from "./transcriptGuard";
import type { IVoiceProvider, VoiceConfig, VoiceEventHandler, VoiceProvider } from "./voiceProvider";

export class GeminiLiveProvider implements IVoiceProvider {
  private session: Session | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private processorSink: GainNode | null = null;
  private micPaused = false;
  private allowPlayback = false;
  private serverTurnComplete = false;
  private nextPlaybackTime = 0;
  private activePlaybackSources = new Set<AudioBufferSourceNode>();

  constructor(
    private readonly config: VoiceConfig,
    private readonly eventHandler: VoiceEventHandler,
  ) {}

  isAvailable() {
    return Boolean(
      this.config.ephemeralToken &&
      typeof window !== "undefined" &&
      navigator.mediaDevices?.getUserMedia,
    );
  }

  getProvider(): VoiceProvider {
    return "gemini-live";
  }

  async start() {
    if (!this.isAvailable()) {
      throw new Error("Secure live voice session is unavailable");
    }

    const ai = new GoogleGenAI({
      apiKey: this.config.ephemeralToken,
      httpOptions: { apiVersion: "v1alpha" },
    });

    this.audioContext = new AudioContext();
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.session = await ai.live.connect({
      model: this.config.model || "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        temperature: 0.2,
        systemInstruction:
          "You are LaunchPilot's English voice transport. Speak only when the client supplies an interview question as text. Read that question naturally in English, once. Never answer microphone audio, never invent founder answers, never translate, and never switch languages.",
      },
      callbacks: {
        onopen: () => this.eventHandler({ type: "listening" }),
        onmessage: (message) => this.handle(message),
        onerror: () =>
          this.eventHandler({
            type: "error",
            message: "Live voice failed. Continue with browser speech or text.",
          }),
        onclose: () => this.eventHandler({ type: "end" }),
      },
    });

    this.record();
  }

  private record() {
    if (!this.mediaStream || !this.audioContext) return;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processorSink = this.audioContext.createGain();
    this.processorSink.gain.value = 0;

    const inputRate = this.audioContext.sampleRate;
    this.processorNode.onaudioprocess = (event) => {
      if (!this.session || this.micPaused) return;

      const channel = event.inputBuffer.getChannelData(0);
      const length = Math.max(1, Math.round((channel.length * 16000) / inputRate));
      const pcm = new Int16Array(length);

      for (let index = 0; index < length; index += 1) {
        const sample = channel[
          Math.min(channel.length - 1, Math.floor((index * inputRate) / 16000))
        ];
        const value = Math.max(-1, Math.min(1, sample));
        pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
      }

      this.session.sendRealtimeInput({
        audio: {
          data: this.toBase64(pcm.buffer),
          mimeType: "audio/pcm;rate=16000",
        },
      });
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.processorSink);
    this.processorSink.connect(this.audioContext.destination);
  }

  private handle(message: LiveServerMessage) {
    const input = message.serverContent?.inputTranscription;
    if (input?.text) {
      if (isUnexpectedTranscriptScript(input.text)) {
        if (input.finished) {
          this.eventHandler({
            type: "notice",
            message: "That did not transcribe confidently as English. Please repeat the answer.",
          });
        }
      } else {
        this.eventHandler({
          type: "transcript",
          text: input.text,
          isFinal: Boolean(input.finished),
        });
        if (input.finished) {
          this.eventHandler({ type: "utterance-ready", text: input.text });
        }
      }
    }

    const output = message.serverContent?.outputTranscription;
    if (output?.text && this.allowPlayback) {
      this.eventHandler({ type: "speaking", text: output.text });
    }

    for (const part of message.serverContent?.modelTurn?.parts || []) {
      if (
        this.allowPlayback &&
        part.inlineData?.data &&
        part.inlineData.mimeType?.startsWith("audio/")
      ) {
        const audio = this.fromBase64(part.inlineData.data);
        this.eventHandler({ type: "audio", data: audio });
        this.play(audio);
      }
    }

    if (message.serverContent?.interrupted) {
      this.stopPlayback();
      this.resumeListening();
    }

    if (message.serverContent?.turnComplete) {
      this.serverTurnComplete = true;
      this.resumeAfterPlayback();
    }
  }

  private play(buffer: ArrayBuffer) {
    if (!this.audioContext) return;

    const input = new Int16Array(buffer);
    const output = new Float32Array(input.length);
    input.forEach((sample, index) => {
      output[index] = sample / (sample < 0 ? 0x8000 : 0x7fff);
    });

    const audio = this.audioContext.createBuffer(1, output.length, 24000);
    audio.copyToChannel(output, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audio;
    source.connect(this.audioContext.destination);

    const startAt = Math.max(this.audioContext.currentTime + 0.02, this.nextPlaybackTime);
    this.nextPlaybackTime = startAt + audio.duration;
    this.activePlaybackSources.add(source);
    source.onended = () => {
      this.activePlaybackSources.delete(source);
      this.resumeAfterPlayback();
    };
    source.start(startAt);
  }

  private stopPlayback() {
    for (const source of this.activePlaybackSources) {
      try {
        source.stop();
      } catch {
        // The source may already have completed.
      }
    }
    this.activePlaybackSources.clear();
    this.nextPlaybackTime = this.audioContext?.currentTime || 0;
    this.allowPlayback = false;
    this.serverTurnComplete = false;
  }

  private resumeAfterPlayback() {
    if (!this.serverTurnComplete || this.activePlaybackSources.size > 0) return;
    this.resumeListening();
  }

  pauseListening() {
    this.micPaused = true;
  }

  resumeListening() {
    this.allowPlayback = false;
    this.serverTurnComplete = false;
    this.micPaused = false;
    this.eventHandler({ type: "listening" });
  }

  async send(text: string) {
    if (!this.session) {
      throw new Error("Live voice is not connected");
    }

    this.stopPlayback();
    this.micPaused = true;
    this.allowPlayback = true;
    this.eventHandler({ type: "speaking", text });
    this.session.sendRealtimeInput({ text });
  }

  stop() {
    this.stopPlayback();

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
    }
    this.processorSink?.disconnect();
    this.sourceNode?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());

    this.session?.sendRealtimeInput({ audioStreamEnd: true });
    this.session?.close();
    void this.audioContext?.close();

    this.processorNode = null;
    this.processorSink = null;
    this.sourceNode = null;
    this.mediaStream = null;
    this.session = null;
    this.audioContext = null;
    this.eventHandler({ type: "end" });
  }

  private toBase64(buffer: ArrayBuffer) {
    let binary = "";
    new Uint8Array(buffer).forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  private fromBase64(value: string) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }
}
