import { GoogleGenAI, Modality } from "@google/genai";
import { requireSessionUser } from "@/lib/auth";
import { getProviderPoolStatus, runWithProviderKey } from "@/lib/providers/keyPool";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    liveVoice: getProviderPoolStatus("gemini"),
    webSpeechFallback: true,
    textFallback: true,
    rawAudioStored: false,
    liveModel: process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview",
  });
}

export async function POST() {
  try {
    await requireSessionUser();
    if (!getProviderPoolStatus("gemini").available) {
      return NextResponse.json({ error: "Live voice is unavailable. Browser speech and text remain available." }, { status: 503 });
    }
    const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
    const token = await runWithProviderKey("gemini", async (key) => {
      const client = new GoogleGenAI({ apiKey: key });
      return client.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model,
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          },
          httpOptions: { apiVersion: "v1alpha" },
        },
      });
    });
    return NextResponse.json({ token: token.name, model, expiresInSeconds: 60 });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json(
      { error: unauthorized ? "Unauthorized" : "Live voice is unavailable. Browser speech and text remain available." },
      { status: unauthorized ? 401 : 503 },
    );
  }
}
