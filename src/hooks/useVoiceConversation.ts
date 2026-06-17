"use client";

import {
  canUseSpeechRecognition,
  canUseSpeechSynthesis,
  createContinuousSpeechRecognition,
  createInterruptListener,
  type ContinuousListener,
  type VoiceOrbStatus,
  stopSpeaking,
  speakText,
} from "@/lib/voice";
import { useCallback, useEffect, useRef } from "react";

type UseVoiceConversationOptions = {
  enabled: boolean;
  active: boolean;
  onSilenceSubmit: (transcript: string) => void | Promise<void>;
};

export function useVoiceConversation({ enabled, active, onSilenceSubmit }: UseVoiceConversationOptions) {
  const statusRef = useRef<VoiceOrbStatus>("idle");
  const listenerRef = useRef<ContinuousListener | null>(null);
  const interruptRef = useRef<ReturnType<typeof createInterruptListener> | null>(null);
  const processingRef = useRef(false);
  const onSubmitRef = useRef(onSilenceSubmit);

  useEffect(() => {
    onSubmitRef.current = onSilenceSubmit;
  }, [onSilenceSubmit]);

  const stopAll = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    interruptRef.current?.stop();
    interruptRef.current = null;
    stopSpeaking();
  }, []);

  const startListening = useCallback(() => {
    if (!enabled || !active || !canUseSpeechRecognition()) return;

    listenerRef.current?.stop();
    listenerRef.current = createContinuousSpeechRecognition({
      silenceMs: 5000,
      onSpeechActivity: () => {
        if (statusRef.current === "speaking") {
          stopSpeaking();
          interruptRef.current?.stop();
          statusRef.current = "listening";
        }
      },
      onSilenceSubmit: async (transcript) => {
        if (processingRef.current || !transcript.trim()) return;
        processingRef.current = true;
        listenerRef.current?.stop();
        statusRef.current = "thinking";
        try {
          await onSubmitRef.current(transcript);
        } finally {
          processingRef.current = false;
        }
      },
      onError: () => {
        statusRef.current = "idle";
      },
    });

    statusRef.current = "listening";
    listenerRef.current?.start();
  }, [enabled, active]);

  const speakThenListen = useCallback(
    (text: string, onStatus?: (status: VoiceOrbStatus, label: string) => void, listenAfter = true) => {
      if (!enabled) return;

      const deliver = () => {
        if (listenAfter && active) startListening();
      };

      if (!canUseSpeechSynthesis()) {
        statusRef.current = "listening";
        onStatus?.("listening", "Listening");
        deliver();
        return;
      }

      statusRef.current = "speaking";
      onStatus?.("speaking", "Speaking");

      interruptRef.current?.stop();
      interruptRef.current = createInterruptListener(() => {
        stopSpeaking();
        interruptRef.current?.stop();
        statusRef.current = "listening";
        onStatus?.("listening", "Listening");
        startListening();
      });
      interruptRef.current.start();

      speakText(text, () => {
        interruptRef.current?.stop();
        if (statusRef.current === "speaking") {
          statusRef.current = listenAfter ? "listening" : "thinking";
          onStatus?.(listenAfter ? "listening" : "thinking", listenAfter ? "Listening" : "Working");
          deliver();
        }
      });
    },
    [enabled, active, startListening],
  );

  const markThinking = useCallback((onStatus?: (status: VoiceOrbStatus, label: string) => void) => {
    statusRef.current = "thinking";
    onStatus?.("thinking", "Thinking");
  }, []);

  useEffect(() => {
    if (!enabled) stopAll();
    return () => stopAll();
  }, [enabled, stopAll]);

  return {
    speakThenListen,
    startListening,
    stopAll,
    markThinking,
    getStatus: () => statusRef.current,
  };
}
