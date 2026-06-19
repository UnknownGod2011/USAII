/**
 * Voice Provider Interface
 * Supports Gemini Live API, Web Speech API, and text fallback
 */

export type VoiceProvider = "gemini-live" | "web-speech" | "text-fallback";

export type VoiceConfig = {
  provider: VoiceProvider;
  ephemeralToken?: string;
  model?: string;
  language?: string;
  voice?: string;
};

export type VoiceEvent =
  | { type: "listening" }
  | { type: "transcribing" }
  | { type: "transcript"; text: string; isFinal: boolean }
  | { type: "thinking" }
  | { type: "speaking"; text: string }
  | { type: "audio"; data: ArrayBuffer }
  | { type: "error"; message: string }
  | { type: "end" };

export type VoiceEventHandler = (event: VoiceEvent) => void;

export interface IVoiceProvider {
  start(): Promise<void>;
  stop(): void;
  send(text: string): Promise<void>;
  isAvailable(): boolean;
  getProvider(): VoiceProvider;
}

export const voiceStoragePolicy = {
  rawAudioStored: false,
  transcriptStored: true,
} as const;

export function liveClientConfig(token: string, model = "gemini-3.1-flash-live-preview"): VoiceConfig {
  return { provider: "gemini-live", ephemeralToken: token, model };
}

export function selectVoiceProvider(capabilities: {
  geminiLiveAvailable: boolean;
  webSpeechAvailable: boolean;
}): VoiceProvider {
  if (capabilities.geminiLiveAvailable) return "gemini-live";
  if (capabilities.webSpeechAvailable) return "web-speech";
  return "text-fallback";
}

/**
 * Detect which voice provider is available
 */
export function detectAvailableProvider(): VoiceProvider {
  if (typeof window !== "undefined") {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    return selectVoiceProvider({ geminiLiveAvailable: false, webSpeechAvailable: Boolean(SpeechRecognition) });
  }
  return "text-fallback";
}

/**
 * Create appropriate voice provider
 */
export async function createVoiceProvider(
  config: VoiceConfig,
  eventHandler: VoiceEventHandler
): Promise<IVoiceProvider> {
  switch (config.provider) {
    case "gemini-live":
      const { GeminiLiveProvider } = await import("./geminiLiveProvider");
      return new GeminiLiveProvider(config, eventHandler);

    case "web-speech":
      const { WebSpeechProvider } = await import("./webSpeechProvider");
      return new WebSpeechProvider(config, eventHandler);

    default:
      const { TextFallbackProvider } = await import("./textFallbackProvider");
      return new TextFallbackProvider(config, eventHandler);
  }
}
