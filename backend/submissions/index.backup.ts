import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../../db/prismaClient";
import { authenticateToken } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import {
  codeExecutionService,
  type ExecutionResult,
} from "../services/code-execution.service";

const router = Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

/**
 * Derive runtime state from timestamps (same logic as contest.orchestrator.ts)
 */
function getRuntimeState(startAt: Date, endAt: Date): "UPCOMING" | "ACTIVE" | "COMPLETED" {
  const now = new Date();
  if (now < startAt) return "UPCOMING";
  if (now >= startAt && now <= endAt) return "ACTIVE";
  return "COMPLETED";
}

/**
 * Submit code for a coding challenge
 * POST /submissions/code
 */
router.post("/code", async (req: Request, res: Response) => {
  try {
    const { questionId, contestId, code, language } = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Validate required fields
    if (!questionId || !contestId || !code || !language) {
      return res.status(400).json({
        error: "Missing required fields: questionId, contestId, code, language",
      });
    }

    // Check if language is supported
    if (!codeExecutionService.isLanguageSupported(language)) {
      return res.status(400).json({
        error: `Unsupported language: ${language}. Supported: ${codeExecutionService
          .getSupportedLanguages()
          .join(", ")}`,
      });
    }

    // Verify contest exists and is active
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        questions: {
          where: { questionId },
          include: {
            question: true,
          },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    // CRITICAL: Use runtime state from timestamps, NOT db status
    const runtimeState = getRuntimeState(new Date(contest.startAt), new Date(contest.endAt));
    if (runtimeState !== "ACTIVE") {
      return res.status(400).json({ error: `Contest is ${runtimeState.toLowerCase()}` });
    }

    // Verify question is part of contest
    const contestQuestion = contest.questions[0];
    if (!contestQuestion) {
      return res.status(400).json({
        error: "Question is not part of this contest",
      });
    }

    // Verify it's a coding question
    if (contestQuestion.question.type !== "CODING") {
      return res.status(400).json({
        error: "This endpoint is only for coding questions",
      });
    }

    // Check user is participant
    const participant = await prisma.contestParticipant.findUnique({
      where: {
        contestId_userId: {
          contestId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({
        error: "You must join the contest before submitting",
      });
    }

    // Get question limits
    const question = contestQuestion.question;
    const timeLimit = question.timeLimit || 5;
    const memoryLimit = question.memoryLimit || 256;

    // Create submission record with PENDING status
    const submission = await prisma.submission.create({
      data: {
        userId,
        contestId,
        questionId,
        code,
        language,
        status: "PENDING",
        isCorrect: false,
      },
    });

    // Execute code (async)
    console.log(
      `🚀 Executing code submission ${submission.id} for question ${questionId}`
    );

    // Update status to RUNNING
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "RUNNING" },
    });

    // Execute code against test cases
    const result = await codeExecutionService.executeCode(
      code,
      language,
      questionId,
      timeLimit,
      memoryLimit
    );

    // Update submission with results
    const isCorrect = result.status === "ACCEPTED";
    const points = isCorrect ? contestQuestion.points : 0;

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: result.status,
        isCorrect,
        executionTime: Math.round(result.totalExecutionTime),
        memoryUsed: Math.round(result.maxMemoryUsed),
        testCasesPassed: result.testCasesPassed,
        totalTestCases: result.totalTestCases,
      },
    });

    // Prepare response (hide hidden test case details)
    const visibleResults = result.testCaseResults.map((tc) => ({
      testCaseId: tc.testCaseId,
      passed: tc.passed,
      input: tc.isHidden ? "[Hidden]" : tc.input,
      expectedOutput: tc.isHidden ? "[Hidden]" : tc.expectedOutput,
      actualOutput: tc.isHidden ? "[Hidden]" : tc.actualOutput,
      executionTime: tc.executionTime,
      memoryUsed: tc.memoryUsed,
      error: tc.error,
      isHidden: tc.isHidden,
    }));

    console.log(
      `✅ Submission ${submission.id} completed: ${result.status} (${result.testCasesPassed}/${result.totalTestCases} passed)`
    );

    res.json({
      submissionId: submission.id,
      status: result.status,
      isCorrect,
      points,
      testCasesPassed: result.testCasesPassed,
      totalTestCases: result.totalTestCases,
      executionTime: result.totalExecutionTime,
      memoryUsed: result.maxMemoryUsed,
      compilationError: result.compilationError,
      testCaseResults: visibleResults,
    });
  } catch (error) {
    console.error("Code submission error:", error);
    res.status(500).json({ error: "Failed to process code submission" });
  }
});

/**
 * Get submission result by ID
 * GET /submissions/:id
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.userId;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        question: {
          include: {
            testCases: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Users can only view their own submissions
    if (submission.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // For coding submissions, include test case info
    if (submission.question.type === "CODING") {
      const testCases = submission.question.testCases.map((tc) => ({
        id: tc.id,
        input: tc.isHidden ? "[Hidden]" : tc.input,
        expectedOutput: tc.isHidden ? "[Hidden]" : tc.expectedOutput,
        isHidden: tc.isHidden,
      }));

      res.json({
        id: submission.id,
        questionId: submission.questionId,
        contestId: submission.contestId,
        code: submission.code,
        language: submission.language,
        status: submission.status,
        isCorrect: submission.isCorrect,
        executionTime: submission.executionTime,
        memoryUsed: submission.memoryUsed,
        testCasesPassed: submission.testCasesPassed,
        totalTestCases: submission.totalTestCases,
        submittedAt: submission.submittedAt,
        testCases,
      });
    } else {
      // MCQ submission
      res.json({
        id: submission.id,
        questionId: submission.questionId,
        contestId: submission.contestId,
        selectedOptionId: submission.selectedOptionId,
        isCorrect: submission.isCorrect,
        submittedAt: submission.submittedAt,
      });
    }
  } catch (error) {
    console.error("Get submission error:", error);
    res.status(500).json({ error: "Failed to get submission" });
  }
});

/**
 * Get user's submissions for a question
 * GET /submissions/question/:questionId/contest/:contestId
 */
router.get(
  "/question/:questionId/contest/:contestId",
  async (req: Request, res: Response) => {
    try {
      const { questionId, contestId } = req.params;
      const userId = (req as AuthRequest).user?.userId;

      const submissions = await prisma.submission.findMany({
        where: {
          userId,
          questionId,
          contestId,
        },
        orderBy: { submittedAt: "desc" },
        take: 10, // Last 10 submissions
      });

      res.json(
        submissions.map((s) => ({
          id: s.id,
          status: s.status,
          isCorrect: s.isCorrect,
          language: s.language,
          executionTime: s.executionTime,
          memoryUsed: s.memoryUsed,
          testCasesPassed: s.testCasesPassed,
          totalTestCases: s.totalTestCases,
          createdAt: s.submittedAt,
        }))
      );
    } catch (error) {
      console.error("Get submissions error:", error);
      res.status(500).json({ error: "Failed to get submissions" });
    }
  }
);

/**
 * Run code against sample test cases (without saving submission)
 * POST /submissions/run
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    const { questionId, code, language, customInput } = req.body;

    if (!questionId || !code || !language) {
      return res.status(400).json({
        error: "Missing required fields: questionId, code, language",
      });
    }

    if (!codeExecutionService.isLanguageSupported(language)) {
      return res.status(400).json({
        error: `Unsupported language: ${language}`,
      });
    }

    // Get the question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        testCases: {
          where: { isHidden: false }, // Only visible test cases for "Run"
          orderBy: { order: "asc" },
          take: 3, // Limit to first 3 visible test cases
        },
      },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.type !== "CODING") {
      return res.status(400).json({
        error: "This endpoint is only for coding questions",
      });
    }

    // If custom input provided, simulate with that
    if (customInput) {
      // For custom input, we just return simulated output
      console.log(`🔧 Running code with custom input`);
      
      // Simple simulation for custom input
      res.json({
        status: "SUCCESS",
        results: [
          {
            input: customInput,
            output: "Simulated output for custom input",
            executionTime: Math.random() * 50 + 5,
            memoryUsed: Math.random() * 20 + 5,
          },
        ],
      });
      return;
    }

    // Run against visible test cases
    const timeLimit = question.timeLimit || 5;
    const memoryLimit = question.memoryLimit || 256;

    console.log(`🔧 Running code against ${question.testCases.length} sample test cases`);

    const result = await codeExecutionService.executeCode(
      code,
      language,
      questionId,
      timeLimit,
      memoryLimit
    );

    // Filter to only visible test cases
    const visibleResults = result.testCaseResults
      .filter((tc) => !tc.isHidden)
      .map((tc) => ({
        testCaseId: tc.testCaseId,
        passed: tc.passed,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: tc.actualOutput,
        executionTime: tc.executionTime,
        memoryUsed: tc.memoryUsed,
        error: tc.error,
      }));

    res.json({
      status: visibleResults.every((r) => r.passed) ? "SUCCESS" : "FAILED",
      passed: visibleResults.filter((r) => r.passed).length,
      total: visibleResults.length,
      results: visibleResults,
      compilationError: result.compilationError,
    });
  } catch (error) {
    console.error("Run code error:", error);
    res.status(500).json({ error: "Failed to run code" });
  }
});

/**
 * Get supported languages
 * GET /submissions/languages
 */
router.get("/languages/list", async (_req: Request, res: Response) => {
  res.json({
    languages: codeExecutionService.getSupportedLanguages(),
  });
});

export default router;
