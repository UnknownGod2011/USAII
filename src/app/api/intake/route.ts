import { requireSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FounderIntakeSchema } from "@/lib/intake/schema";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const parsed = FounderIntakeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Some founder answers are incomplete.", details: parsed.error.flatten() }, { status: 400 });
    const intake = parsed.data;
    const created = await getDb().founderIntake.create({
      data: {
        userId: user.id, name: intake.name, locationCountry: intake.locationCountry, locationCity: intake.locationCity, status: intake.status,
        hoursPerWeek: intake.hoursPerWeek, budget: intake.budget, skillsJson: JSON.stringify(intake.skills), teamStatus: intake.teamStatus,
        stage: intake.stage, rawIdea: intake.rawIdea, targetUser: intake.targetUser, problem: intake.problem, evidenceLevel: intake.evidenceLevel,
        alternatives: intake.alternatives, thirtyDayGoal: intake.thirtyDayGoal, openToModification: intake.openToModification,
        transcriptJson: JSON.stringify(intake.transcript), skippedOrUnclearJson: JSON.stringify(intake.skippedOrUnclearFields),
        discoveryJson: JSON.stringify({ accessibleCommunities: intake.accessibleCommunities, noticedProblems: intake.noticedProblems, reachableUsers: intake.reachableUsers }),
        answerValidations: { create: intake.answerValidations.map((validation) => ({
          questionId: validation.questionId, originalQuestion: validation.originalQuestion, userAnswer: validation.userAnswer,
          expectedField: validation.expectedField, isUsable: validation.isUsable, qualityScore: validation.qualityScore,
          extractedValueJson: JSON.stringify(validation.extractedValue), issuesJson: JSON.stringify(validation.issues),
          followUpQuestion: validation.followUpQuestion, normalizedAnswer: validation.normalizedAnswer, provider: validation.provider,
        })) },
        ideas: { create: { userId: user.id, name: "Working direction", originalIdea: intake.rawIdea, finalizedIdea: intake.rawIdea, targetUser: intake.targetUser, problemStatement: intake.problem, status: "researching" } },
      }, include: { ideas: true },
    });
    return NextResponse.json({ intakeId: created.id, startupIdeaId: created.ideas[0].id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "UNAUTHORIZED" ? "Sign in before saving your interview." : "Could not save the founder intake." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
