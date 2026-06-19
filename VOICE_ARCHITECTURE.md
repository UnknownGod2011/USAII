# Voice Architecture

Voice and chat feed the same validated founder-intake pipeline.

## Runtime order

1. English browser speech recognition and speech synthesis for stable app-controlled turns.
2. Short-lived Gemini Live session when browser recognition is unavailable and a server-side key exists.
3. Typed answer input.
4. Chat interview remains available at all times.

## Turn control

- The microphone is paused while LaunchPilot speaks.
- Browser speech uses silence detection before committing an answer.
- Gemini Live only plays audio for an explicitly supplied interview question.
- PCM response chunks are queued sequentially rather than started simultaneously.
- Unsolicited model audio is suppressed.
- Input is fixed to English (`en-IN`) for the target demo audience.
- Transcripts dominated by an unexpected CJK script are rejected and the user is asked to repeat.

## Security and privacy

- The Gemini API key never reaches the browser.
- `/api/voice` issues a one-use, short-lived token.
- Raw audio is not written to the database or filesystem.
- Only transcript text and validated founder answers are persisted.
- Ending a conversation stops microphone tracks, playback, recognition, and the live session.

## Fallback behavior

Microphone denial, provider errors, or unsupported browser APIs do not crash the interview. The screen exposes typed input or links to chat mode with the same answer validation and persistence behavior.
