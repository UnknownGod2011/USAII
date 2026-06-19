# Voice Architecture

Provider order:

1. Gemini Live with a secure ephemeral browser token
2. Browser Web Speech
3. Text input

When `GEMINI_API_KEY` or `GEMINI_API_KEYS` is configured, authenticated `/api/voice` creates a one-use, short-lived token constrained to `GEMINI_LIVE_MODEL` (default `gemini-3.1-flash-live-preview`). The browser connects with `@google/genai` using API version `v1alpha`; the long-lived key never enters client configuration.

The live client captures microphone samples, resamples them to 16 kHz PCM, and streams them without writing audio to storage. If token creation, quota, connection, microphone, or transcription fails, the UI moves to browser speech and then text.

Voice and chat share one interview state machine, answer validator, field extractor, and research gate. Only transcripts and structured answers are persisted. Raw audio is never written to browser storage, SQLite, or disk.
