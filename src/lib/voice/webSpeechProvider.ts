import type { IVoiceProvider, VoiceConfig, VoiceEventHandler, VoiceProvider } from "./voiceProvider";
import { cancelSpeech, speakNaturally } from "./speechSynthesis";

/**
 * Web Speech API Provider
 * Listens with silence detection, speaks with natural pacing.
 */

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

const SILENCE_MS = 2000;

export class WebSpeechProvider implements IVoiceProvider {
  private config: VoiceConfig;
  private eventHandler: VoiceEventHandler;
  private recognition: BrowserSpeechRecognition | null = null;
  private isListening = false;
  private shouldListen = false;
  private micPaused = false;
  private isSpeaking = false;
  private committedThisTurn = "";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: VoiceConfig, eventHandler: VoiceEventHandler) {
    this.config = config;
    this.eventHandler = eventHandler;
  }

  isAvailable(): boolean {
    if (typeof window === "undefined") return false;

    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }

  getProvider(): VoiceProvider {
    return "web-speech";
  }

  pauseListening(): void {
    this.micPaused = true;
    this.clearSilenceTimer();
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  resumeListening(): void {
    this.micPaused = false;
    this.committedThisTurn = "";
    if (this.shouldListen && !this.isSpeaking) {
      this.startRecognition();
    }
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private scheduleUtteranceCheck() {
    this.clearSilenceTimer();
    if (this.micPaused || this.isSpeaking) return;

    this.silenceTimer = setTimeout(() => {
      const text = this.committedThisTurn.trim();
      if (!text || this.micPaused || this.isSpeaking) return;

      this.eventHandler({ type: "utterance-ready", text });
      this.committedThisTurn = "";
      this.eventHandler({ type: "transcript", text: "", isFinal: true });
    }, SILENCE_MS);
  }

  private emitLiveTranscript(interim: string) {
    const live = [this.committedThisTurn.trim(), interim.trim()].filter(Boolean).join(" ");
    this.eventHandler({ type: "transcript", text: live, isFinal: false });
  }

  private startRecognition() {
    if (!this.recognition || !this.shouldListen || this.micPaused || this.isSpeaking) return;

    try {
      this.recognition.start();
      this.isListening = true;
      this.eventHandler({ type: "listening" });
    } catch {
      // start() can throw if already running
    }
  }

  async start(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error("Web Speech API not available");
    }

    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Speech Recognition not supported");
    }

    this.shouldListen = true;
    this.micPaused = false;
    this.committedThisTurn = "";
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.config.language || "en-IN";

    this.recognition.onresult = (event) => {
      if (this.micPaused || this.isSpeaking) return;

      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() || "";
        if (!text) continue;

        if (result.isFinal) {
          this.committedThisTurn = [this.committedThisTurn.trim(), text].filter(Boolean).join(" ");
          this.scheduleUtteranceCheck();
        } else {
          interim = [interim, text].filter(Boolean).join(" ");
        }
      }

      this.emitLiveTranscript(interim);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.shouldListen && !this.micPaused && !this.isSpeaking) {
        window.setTimeout(() => this.startRecognition(), 300);
      } else if (!this.shouldListen) {
        this.eventHandler({ type: "end" });
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        if (this.shouldListen && !this.micPaused && !this.isSpeaking) {
          window.setTimeout(() => this.startRecognition(), 400);
        }
        return;
      }
      this.isListening = false;
      this.eventHandler({
        type: "error",
        message: `Speech recognition error: ${event.error}`,
      });
    };

    this.startRecognition();
  }

  async send(text: string): Promise<void> {
    this.pauseListening();
    this.isSpeaking = true;
    this.eventHandler({ type: "speaking", text });

    await speakNaturally(text, this.config.language || "en-IN");

    this.isSpeaking = false;
    this.committedThisTurn = "";

    if (this.shouldListen) {
      this.micPaused = false;
      this.startRecognition();
    }
  }

  stop(): void {
    this.shouldListen = false;
    this.micPaused = false;
    this.isSpeaking = false;
    this.clearSilenceTimer();
    this.committedThisTurn = "";

    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
      this.isListening = false;
    }

    cancelSpeech();
  }
}
