import { GoogleGenAI, Modality } from "@google/genai";
import { requireSessionUser } from "@/lib/auth";
import { getProviderPoolStatus, runWithProviderKey } from "@/lib/providers/keyPool";
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ liveVoice: getProviderPoolStatus("gemini"), webSpeechFallback: true, textFallback: true, rawAudioStored: false });
}
export async function POST() {
  try {
    await requireSessionUser();
    if (!getProviderPoolStatus("gemini").available) return NextResponse.json({ error: "Live voice unavailable. Browser speech remains available." }, { status: 503 });
    const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
    const token = await runWithProviderKey("gemini", async (key) => new GoogleGenAI({ apiKey: key }).authTokens.create({
      config: { uses: 1, expireTime: new Date(Date.now() + 1_800_000).toISOString(), newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(), liveConnectConstraints: { model, config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {} } }, httpOptions: { apiVersion: "v1alpha" } },
    }));
    return NextResponse.json({ token: token.name, model, expiresInSeconds: 60 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "UNAUTHORIZED" ? "Unauthorized" : "Live voice unavailable. Browser speech remains available." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 503 });
  }
}
