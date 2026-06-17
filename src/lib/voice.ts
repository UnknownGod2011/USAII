export const SILENCE_SUBMIT_MS = 5000;

export type VoiceOrbStatus = "idle" | "listening" | "thinking" | "speaking";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onspeechstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

let activeUtterance: SpeechSynthesisUtterance | null = null;
let cachedVoice: SpeechSynthesisVoice | null = null;

export function canUseSpeechRecognition() {
  if (typeof window === "undefined") return false;
  const speechWindow = window as SpeechWindow;
  return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
}

export function canUseSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isSpeaking() {
  return typeof window !== "undefined" && window.speechSynthesis.speaking;
}

export function stopSpeaking() {
  if (!canUseSpeechSynthesis()) return;
  window.speechSynthesis.cancel();
  activeUtterance = null;
}

export function preloadSpeechVoices() {
  if (!canUseSpeechSynthesis()) return;
  chooseVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    chooseVoice();
  };
  window.speechSynthesis.getVoices();
}

function chooseVoice() {
  if (!canUseSpeechSynthesis()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedVoice;
  const preferred = [
    /samantha/i,
    /ava/i,
    /allison/i,
    /zoe/i,
    /google us english/i,
    /microsoft aria/i,
    /natural/i,
    /premium/i,
  ];
  cachedVoice =
    preferred.map((pattern) => voices.find((voice) => pattern.test(voice.name) && /^en[-_]/i.test(voice.lang))).find(Boolean) ||
    voices.find((voice) => /^en-US/i.test(voice.lang) && voice.localService) ||
    voices.find((voice) => /^en[-_]/i.test(voice.lang)) ||
    voices[0] ||
    null;
  return cachedVoice;
}

function addSentencePauses(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/([.!?])\s+/g, "$1 ... ")
    .trim();
}

export function speakText(text: string, onEnd?: () => void) {
  if (!canUseSpeechSynthesis() || !text.trim()) {
    onEnd?.();
    return;
  }

  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(addSentencePauses(text));
  utterance.lang = "en-US";
  utterance.voice = chooseVoice();
  utterance.rate = 0.92;
  utterance.pitch = 1.02;
  utterance.volume = 0.95;
  utterance.onend = () => {
    if (activeUtterance === utterance) activeUtterance = null;
    onEnd?.();
  };
  utterance.onerror = () => {
    if (activeUtterance === utterance) activeUtterance = null;
    onEnd?.();
  };
  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export type ContinuousListener = {
  start: () => void;
  stop: () => void;
  getTranscript: () => string;
};

export function createContinuousSpeechRecognition(handlers: {
  silenceMs?: number;
  onSilenceSubmit: (transcript: string) => void;
  onSpeechActivity?: () => void;
  onError?: () => void;
}): ContinuousListener | null {
  const SpeechRecognition = getSpeechRecognitionCtor();
  if (!SpeechRecognition) return null;

  const silenceMs = handlers.silenceMs ?? SILENCE_SUBMIT_MS;
  let recognition: BrowserSpeechRecognition | null = null;
  let transcript = "";
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function scheduleSilenceSubmit() {
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      const finalText = transcript.trim();
      if (finalText) {
        handlers.onSilenceSubmit(finalText);
      }
    }, silenceMs);
  }

  const ctor = SpeechRecognition;
  if (!ctor) return null;

  function bindRecognition() {
    const instance = new ctor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";

    instance.onresult = (event) => {
      handlers.onSpeechActivity?.();
      transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      scheduleSilenceSubmit();
    };

    instance.onspeechstart = () => {
      handlers.onSpeechActivity?.();
    };

    instance.onend = () => {
      if (!stopped) {
        try {
          instance.start();
        } catch {
          // ignore restart races
        }
      }
    };

    instance.onerror = () => {
      handlers.onError?.();
    };

    return instance;
  }

  return {
    getTranscript: () => transcript,
    start: () => {
      stopped = false;
      transcript = "";
      clearSilenceTimer();
      recognition?.abort();
      recognition = bindRecognition();
      try {
        recognition.start();
      } catch {
        handlers.onError?.();
      }
    },
    stop: () => {
      stopped = true;
      clearSilenceTimer();
      recognition?.stop();
      recognition = null;
      transcript = "";
    },
  };
}

export function createInterruptListener(onInterrupt: () => void) {
  const SpeechRecognition = getSpeechRecognitionCtor();
  if (!SpeechRecognition) return { start: () => {}, stop: () => {} };

  let recognition: BrowserSpeechRecognition | null = null;
  let stopped = true;

  return {
    start: () => {
      stopped = false;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        const text = Array.from(event.results)
          .map((r) => r[0]?.transcript || "")
          .join("")
          .trim();
        if (text) onInterrupt();
      };
      recognition.onend = () => {
        if (!stopped) {
          try {
            recognition?.start();
          } catch {
            // ignore
          }
        }
      };
      try {
        recognition.start();
      } catch {
        // ignore
      }
    },
    stop: () => {
      stopped = true;
      recognition?.abort();
      recognition = null;
    },
  };
}

export function createSpeechRecognition(handlers: {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: () => void;
}) {
  const SpeechRecognition = getSpeechRecognitionCtor();
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();
    const isFinal = event.results[event.results.length - 1]?.isFinal ?? false;
    if (transcript) handlers.onTranscript(transcript, isFinal);
  };
  recognition.onend = () => handlers.onEnd?.();
  recognition.onerror = () => handlers.onError?.();
  return recognition;
}
