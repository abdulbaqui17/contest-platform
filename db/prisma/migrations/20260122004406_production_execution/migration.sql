/*
  Warnings:

  - The `status` column on the `Submission` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'RUNNING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILATION_ERROR');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "functionName" TEXT,
ADD COLUMN     "starterCode" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "compileOutput" TEXT,
ADD COLUMN     "judge0Token" TEXT,
ADD COLUMN     "stderr" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "explanation" TEXT;

-- CreateTable
CREATE TABLE "UserStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalSolved" INTEGER NOT NULL DEFAULT 0,
    "easySolved" INTEGER NOT NULL DEFAULT 0,
    "mediumSolved" INTEGER NOT NULL DEFAULT 0,
    "hardSolved" INTEGER NOT NULL DEFAULT 0,
    "totalAttempted" INTEGER NOT NULL DEFAULT 0,
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contestsParticipated" INTEGER NOT NULL DEFAULT 0,
    "bestContestRank" INTEGER,
    "totalContestScore" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "maxStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Editorial" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "approach" TEXT NOT NULL,
    "timeComplexity" TEXT NOT NULL,
    "spaceComplexity" TEXT NOT NULL,
    "solutionCode" JSONB NOT NULL,
    "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Editorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolvedQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestRuntime" INTEGER,
    "bestMemory" INTEGER,
    "language" TEXT,

    CONSTRAINT "SolvedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "executionTime" INTEGER,
    "memoryUsed" INTEGER,
    "testCasesPassed" INTEGER,
    "totalTestCases" INTEGER,
    "judge0Token" TEXT,
    "compileOutput" TEXT,
    "stderr" TEXT,
    "testResults" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStats_userId_key" ON "UserStats"("userId");

-- CreateIndex
CREATE INDEX "UserStats_totalSolved_idx" ON "UserStats"("totalSolved");

-- CreateIndex
CREATE INDEX "UserStats_currentStreak_idx" ON "UserStats"("currentStreak");

-- CreateIndex
CREATE UNIQUE INDEX "Editorial_questionId_key" ON "Editorial"("questionId");

-- CreateIndex
CREATE INDEX "SolvedQuestion_userId_idx" ON "SolvedQuestion"("userId");

-- CreateIndex
CREATE INDEX "SolvedQuestion_questionId_idx" ON "SolvedQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SolvedQuestion_userId_questionId_key" ON "SolvedQuestion"("userId", "questionId");

-- CreateIndex
CREATE INDEX "PracticeSubmission_userId_idx" ON "PracticeSubmission"("userId");

-- CreateIndex
CREATE INDEX "PracticeSubmission_questionId_idx" ON "PracticeSubmission"("questionId");

-- CreateIndex
CREATE INDEX "PracticeSubmission_userId_questionId_idx" ON "PracticeSubmission"("userId", "questionId");

-- CreateIndex
CREATE INDEX "PracticeSubmission_status_idx" ON "PracticeSubmission"("status");

-- CreateIndex
CREATE INDEX "Question_difficulty_idx" ON "Question"("difficulty");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "TestCase_questionId_isHidden_idx" ON "TestCase"("questionId", "isHidden");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Editorial" ADD CONSTRAINT "Editorial_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvedQuestion" ADD CONSTRAINT "SolvedQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSubmission" ADD CONSTRAINT "PracticeSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSubmission" ADD CONSTRAINT "PracticeSubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
