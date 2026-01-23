-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'CODING';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "memoryLimit" INTEGER,
ADD COLUMN     "timeLimit" INTEGER;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "code" TEXT,
ADD COLUMN     "executionTime" INTEGER,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "memoryUsed" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "testCasesPassed" INTEGER,
ADD COLUMN     "totalTestCases" INTEGER;

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCase_questionId_idx" ON "TestCase"("questionId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
