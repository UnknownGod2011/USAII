CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "FounderIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationCountry" TEXT NOT NULL,
    "locationCity" TEXT,
    "status" TEXT NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "budget" TEXT NOT NULL,
    "skillsJson" TEXT NOT NULL,
    "teamStatus" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "rawIdea" TEXT NOT NULL,
    "targetUser" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "evidenceLevel" TEXT NOT NULL,
    "alternatives" TEXT NOT NULL,
    "thirtyDayGoal" TEXT NOT NULL,
    "openToModification" BOOLEAN NOT NULL,
    "transcriptJson" TEXT NOT NULL,
    "skippedOrUnclearJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FounderIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AnswerValidation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intakeId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "originalQuestion" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "expectedField" TEXT NOT NULL,
    "isUsable" BOOLEAN NOT NULL,
    "qualityScore" REAL NOT NULL,
    "extractedValueJson" TEXT NOT NULL,
    "issuesJson" TEXT NOT NULL,
    "followUpQuestion" TEXT,
    "normalizedAnswer" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'deterministic-fallback',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerValidation_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "FounderIntake" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "StartupIdea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalIdea" TEXT NOT NULL,
    "finalizedIdea" TEXT NOT NULL,
    "targetUser" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StartupIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StartupIdea_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "FounderIntake" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startupIdeaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceScore" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "strongestSignal" TEXT NOT NULL,
    "weakestSignal" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "whatCouldBeWrong" TEXT NOT NULL,
    "nextValidationStep" TEXT NOT NULL,
    "fallbackUsed" BOOLEAN NOT NULL,
    "breakdownJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchRun_startupIdeaId_fkey" FOREIGN KEY ("startupIdeaId") REFERENCES "StartupIdea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "supports" TEXT NOT NULL,
    "limitation" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchSource_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "WorkspaceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startupIdeaId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "sourcesJson" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceItem_startupIdeaId_fkey" FOREIGN KEY ("startupIdeaId") REFERENCES "StartupIdea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startupIdeaId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "btsLinesJson" TEXT NOT NULL,
    "outputJson" TEXT NOT NULL,
    "sourcesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_startupIdeaId_fkey" FOREIGN KEY ("startupIdeaId") REFERENCES "StartupIdea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startupIdeaId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_startupIdeaId_fkey" FOREIGN KEY ("startupIdeaId") REFERENCES "StartupIdea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "FounderIntake_userId_idx" ON "FounderIntake"("userId");
CREATE INDEX "AnswerValidation_intakeId_idx" ON "AnswerValidation"("intakeId");
CREATE INDEX "StartupIdea_userId_idx" ON "StartupIdea"("userId");
CREATE INDEX "ResearchRun_userId_startupIdeaId_idx" ON "ResearchRun"("userId", "startupIdeaId");
CREATE INDEX "ResearchSource_researchRunId_idx" ON "ResearchSource"("researchRunId");
CREATE INDEX "WorkspaceItem_userId_startupIdeaId_idx" ON "WorkspaceItem"("userId", "startupIdeaId");
CREATE INDEX "AgentRun_userId_startupIdeaId_idx" ON "AgentRun"("userId", "startupIdeaId");
CREATE INDEX "ChatMessage_userId_startupIdeaId_idx" ON "ChatMessage"("userId", "startupIdeaId");
