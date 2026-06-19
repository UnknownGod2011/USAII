ALTER TABLE "ResearchRun" ADD COLUMN "intakeJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ResearchRun" ADD COLUMN "researchPlanJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ResearchRun" ADD COLUMN "evidenceClaimsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ResearchRun" ADD COLUMN "logsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ResearchRun" ADD COLUMN "packJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ResearchRun" ADD COLUMN "scoreJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "ResearchSource" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'offline';
ALTER TABLE "ResearchSource" ADD COLUMN "query" TEXT;
ALTER TABLE "ResearchSource" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ResearchSource" ADD COLUMN "relevanceScore" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ResearchSource" ADD COLUMN "qualityScore" REAL NOT NULL DEFAULT 0;
