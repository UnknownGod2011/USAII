import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type { IVoiceProvider, VoiceConfig, VoiceEventHandler, VoiceProvider } from "./voiceProvider";

export class GeminiLiveProvider implements IVoiceProvider {
  private session: Session | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  constructor(
    private readonly config: VoiceConfig,
    private readonly eventHandler: VoiceEventHandler,
  ) {}

  isAvailable(): boolean {
    return Boolean(
      this.config.ephemeralToken
      && typeof window !== "undefined"
      && navigator.mediaDevices?.getUserMedia,
    );
  }

  getProvider(): VoiceProvider {
    return "gemini-live";
  }

  async start(): Promise<void> {
    if (!this.isAvailable()) throw new Error("Secure live voice session is unavailable");
    const ai = new GoogleGenAI({
      apiKey: this.config.ephemeralToken,
      httpOptions: { apiVersion: "v1alpha" },
    });
    this.audioContext = new AudioContext();
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    this.session = await ai.live.connect({
      model: this.config.model || "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        temperature: 0.3,
        systemInstruction: "You are the voice transport for LaunchPilot's structured founder interview. Ask only the supplied interview question, keep responses concise, and never invent or skip founder answers.",
      },
      callbacks: {
        onopen: () => this.eventHandler({ type: "listening" }),
        onmessage: (message) => this.handleMessage(message),
        onerror: () => this.eventHandler({ type: "error", message: "Live voice connection failed. Continue with browser speech or text." }),
        onclose: () => this.eventHandler({ type: "end" }),
      },
    });
    this.startRecording();
  }

  private startRecording() {
    if (!this.mediaStream || !this.audioContext) return;
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    const inputRate = this.audioContext.sampleRate;
    this.processorNode.onaudioprocess = (event) => {
      if (!this.session) return;
      const channel = event.inputBuffer.getChannelData(0);
      const pcm = this.toPcm16(this.resample(channel, inputRate, 16000));
      this.session.sendRealtimeInput({
        audio: { data: this.arrayBufferToBase64(pcm.buffer), mimeType: "audio/pcm;rate=16000" },
      });
    };
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  private handleMessage(message: LiveServerMessage) {
    const input = message.serverContent?.inputTranscription;
    if (input?.text) this.eventHandler({ type: "transcript", text: input.text, isFinal: Boolean(input.finished) });
    const output = message.serverContent?.outputTranscription;
    if (output?.text) this.eventHandler({ type: "speaking", text: output.text });
    for (const part of message.serverContent?.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) {
        const audio = this.base64ToArrayBuffer(part.inlineData.data);
        this.eventHandler({ type: "audio", data: audio });
        void this.playPcm(audio);
      }
    }
  }

  private resample(input: Float32Array, inputRate: number, outputRate: number) {
    if (inputRate === outputRate) return input;
    const length = Math.max(1, Math.round(input.length * outputRate / inputRate));
    const output = new Float32Array(length);
    const ratio = inputRate / outputRate;
    for (let index = 0; index < length; index += 1) {
      const position = index * ratio;
      const left = Math.floor(position);
      const right = Math.min(left + 1, input.length - 1);
      const weight = position - left;
      output[index] = input[left] * (1 - weight) + input[right] * weight;
    }
    return output;
  }

  private toPcm16(channel: Float32Array) {
    const pcm = new Int16Array(channel.length);
    channel.forEach((sample, index) => {
      const value = Math.max(-1, Math.min(1, sample));
      pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
    });
    return pcm;
  }

  private async playPcm(buffer: ArrayBuffer) {
    if (!this.audioContext) return;
    const input = new Int16Array(buffer);
    const output = new Float32Array(input.length);
    input.forEach((sample, index) => { output[index] = sample / (sample < 0 ? 0x8000 : 0x7fff); });
    const audioBuffer = this.audioContext.createBuffer(1, output.length, 24000);
    audioBuffer.copyToChannel(output, 0);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  async send(text: string): Promise<void> {
    if (!this.session) throw new Error("Live voice session is not connected");
    this.session.sendRealtimeInput({ text });
  }

  stop(): void {
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
    }
    this.sourceNode?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.session?.sendRealtimeInput({ audioStreamEnd: true });
    this.session?.close();
    void this.audioContext?.close();
    this.processorNode = null;
    this.sourceNode = null;
    this.mediaStream = null;
    this.session = null;
    this.audioContext = null;
    this.eventHandler({ type: "end" });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = "";
    new Uint8Array(buffer).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  private base64ToArrayBuffer(value: string) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }
}
