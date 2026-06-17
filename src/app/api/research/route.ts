import { demoProfile } from "@/lib/seed";
import { generateResearchedBrief, runLiveResearch } from "@/lib/research";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const profile = { ...demoProfile, ...body.profile };
  const brief = await generateResearchedBrief(profile);
  return NextResponse.json({ brief, research: brief.research });
}

export async function GET() {
  const research = await runLiveResearch(demoProfile);
  return NextResponse.json({ research });
}
