/**
 * Submission Routes - Production-Grade Code Execution
 * 
 * Endpoints:
 * - POST /run        → Run code against SAMPLE test cases (fast feedback)
 * - POST /submit     → Submit code against ALL test cases (final verdict)
 * - POST /callback   → Judge0 webhook callback
 * - GET  /:id        → Get submission details
 * - GET  /history    → Get user's submission history
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../../db/prismaClient";
import { authenticateToken, optionalAuth } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import {
  codeExecutionService,
  type ExecutionResult,
  type SubmissionStatus,
} from "../services/code-execution.service";
import { getWss } from "../websocket/server";
import { LANGUAGE_IDS } from "../services/code-execution.service";

const router = Router();

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

/**
 * Get supported programming languages
 * GET /submissions/languages
 */
router.get("/languages", async (_req: Request, res: Response) => {
  const languages = Object.entries(LANGUAGE_IDS)
    .filter(([key]) => !["python3", "c++"].includes(key)) // Filter aliases
    .map(([name, id]) => ({
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      judge0Id: id,
    }));
  
  res.json(languages);
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Derive runtime state from timestamps
 */
function getRuntimeState(startAt: Date, endAt: Date): "UPCOMING" | "ACTIVE" | "COMPLETED" {
  const now = new Date();
  if (now < startAt) return "UPCOMING";
  if (now >= startAt && now <= endAt) return "ACTIVE";
  return "COMPLETED";
}

/**
 * Send WebSocket update to user
 */
function sendSubmissionUpdate(userId: string, data: any) {
  try {
    const wss = getWss();
    if (wss) {
      // Find client connection and send update
      wss.clients.forEach((client: any) => {
        if (client.userId === userId && client.readyState === 1) {
          client.send(JSON.stringify({
            type: "SUBMISSION_UPDATE",
            ...data,
          }));
        }
      });
    }
  } catch (error) {
    console.error("WebSocket send error:", error);
  }
}

/**
 * Update user stats after successful submission
 */
async function updateUserStats(userId: string, questionId: string, isAccepted: boolean) {
  try {
    // Get or create user stats
    let stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      stats = await prisma.userStats.create({
        data: { userId },
      });
    }

    // Get question difficulty
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { difficulty: true },
    });

    // Check if user already solved this
    const alreadySolved = await prisma.solvedQuestion.findUnique({
      where: {
        userId_questionId: { userId, questionId },
      },
    });

    // Update stats
    const updateData: any = {
      totalSubmissions: { increment: 1 },
      lastActiveAt: new Date(),
    };

    if (isAccepted) {
      updateData.acceptedCount = { increment: 1 };

      // First time solving this problem
      if (!alreadySolved) {
        updateData.totalSolved = { increment: 1 };
        updateData.totalAttempted = { increment: 1 };

        // Update difficulty-specific count
        if (question?.difficulty === "EASY") {
          updateData.easySolved = { increment: 1 };
        } else if (question?.difficulty === "MEDIUM") {
          updateData.mediumSolved = { increment: 1 };
        } else if (question?.difficulty === "HARD") {
          updateData.hardSolved = { increment: 1 };
        }

        // Mark as solved
        await prisma.solvedQuestion.create({
          data: { userId, questionId },
        });

        // Update streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const lastActive = new Date(stats.lastActiveAt);
        lastActive.setHours(0, 0, 0, 0);

        if (lastActive >= yesterday) {
          updateData.currentStreak = { increment: 1 };
        } else {
          updateData.currentStreak = 1;
        }
      }
    } else {
      // Attempted but not solved yet
      if (!alreadySolved) {
        const attempted = await prisma.practiceSubmission.findFirst({
          where: { userId, questionId },
        });
        if (!attempted) {
          updateData.totalAttempted = { increment: 1 };
        }
      }
    }

    await prisma.userStats.update({
      where: { userId },
      data: updateData,
    });

    // Recalculate acceptance rate
    const updatedStats = await prisma.userStats.findUnique({
      where: { userId },
    });
    if (updatedStats && updatedStats.totalSubmissions > 0) {
      await prisma.userStats.update({
        where: { userId },
        data: {
          acceptanceRate: (updatedStats.acceptedCount / updatedStats.totalSubmissions) * 100,
          maxStreak: Math.max(updatedStats.maxStreak, updatedStats.currentStreak),
        },
      });
    }
  } catch (error) {
    console.error("Error updating user stats:", error);
  }
}

// ============================================================================
// RUN CODE (Sample Tests Only)
// ============================================================================

/**
 * Run code against sample test cases for quick feedback
 * This does NOT create a submission record
 * 
 * POST /submissions/run
 */
router.post("/run", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { code, language, questionId } = req.body;

    // Validate required fields
    if (!code || !language || !questionId) {
      return res.status(400).json({
        error: "Missing required fields: code, language, questionId",
      });
    }

    // Validate language
    if (!codeExecutionService.isLanguageSupported(language)) {
      return res.status(400).json({
        error: `Unsupported language: ${language}. Supported: ${codeExecutionService.getSupportedLanguages().join(", ")}`,
      });
    }

    // Verify question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.type !== "CODING") {
      return res.status(400).json({ error: "This endpoint is only for coding questions" });
    }

    if (question.testCases.length === 0) {
      return res.status(400).json({ error: "No sample test cases available" });
    }

    console.log(`🏃 Running code against ${question.testCases.length} sample test cases`);

    // Execute against sample tests only
    const result = await codeExecutionService.runCode(code, language, questionId);

    // Return visible results only
    const visibleResults = result.testCaseResults.map((tc, index) => ({
      testCase: index + 1,
      input: tc.input,
      expected: tc.expectedOutput,
      actual: tc.actualOutput,
      passed: tc.passed,
      time: Math.round(tc.executionTime),
      memory: Math.round(tc.memoryUsed * 10) / 10,
      error: tc.error,
    }));

    res.json({
      status: result.status,
      results: visibleResults,
      allPassed: result.testCasesPassed === result.totalTestCases,
      passed: result.testCasesPassed,
      total: result.totalTestCases,
      totalTime: Math.round(result.totalExecutionTime),
      maxMemory: Math.round(result.maxMemoryUsed * 10) / 10,
      compilationError: result.compilationError,
      runtimeError: result.runtimeError,
    });
  } catch (error) {
    console.error("Run code error:", error);
    res.status(500).json({ error: "Failed to run code" });
  }
});

// ============================================================================
// SUBMIT CODE (All Tests - Practice Mode)
// ============================================================================

/**
 * Submit code for practice (non-contest)
 * Creates a submission record and runs against ALL test cases
 * 
 * POST /submissions/practice
 */
router.post("/practice", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { code, language, questionId } = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Validate required fields
    if (!code || !language || !questionId) {
      return res.status(400).json({
        error: "Missing required fields: code, language, questionId",
      });
    }

    // Validate language
    if (!codeExecutionService.isLanguageSupported(language)) {
      return res.status(400).json({
        error: `Unsupported language: ${language}`,
      });
    }

    // Verify question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.type !== "CODING") {
      return res.status(400).json({ error: "This endpoint is only for coding questions" });
    }

    // Create submission record
    const submission = await prisma.practiceSubmission.create({
      data: {
        userId,
        questionId,
        code,
        language,
        status: "PENDING",
      },
    });

    console.log(`📝 Created practice submission ${submission.id}`);

    // Update status to RUNNING
    await prisma.practiceSubmission.update({
      where: { id: submission.id },
      data: { status: "RUNNING" },
    });

    // Notify via WebSocket
    sendSubmissionUpdate(userId, {
      submissionId: submission.id,
      status: "RUNNING",
    });

    // Execute against ALL test cases
    const result = await codeExecutionService.submitCode(
      code,
      language,
      questionId
    );

    // Update submission with results
    await prisma.practiceSubmission.update({
      where: { id: submission.id },
      data: {
        status: result.status,
        executionTime: Math.round(result.totalExecutionTime),
        memoryUsed: Math.round(result.maxMemoryUsed),
        testCasesPassed: result.testCasesPassed,
        totalTestCases: result.totalTestCases,
        compileOutput: result.compilationError,
        stderr: result.runtimeError,
        testResults: result.testCaseResults
          .filter((tc) => !tc.isHidden)
          .map((tc) => ({
            input: tc.input,
            expected: tc.expectedOutput,
            actual: tc.actualOutput,
            passed: tc.passed,
            time: tc.executionTime,
            memory: tc.memoryUsed,
          })),
      },
    });

    // Update user stats
    await updateUserStats(userId, questionId, result.status === "ACCEPTED");

    // Notify via WebSocket
    sendSubmissionUpdate(userId, {
      submissionId: submission.id,
      status: result.status,
      testCasesPassed: result.testCasesPassed,
      totalTestCases: result.totalTestCases,
      runtime: Math.round(result.totalExecutionTime),
      memory: Math.round(result.maxMemoryUsed * 10) / 10,
    });

    console.log(`✅ Practice submission ${submission.id}: ${result.status} (${result.testCasesPassed}/${result.totalTestCases})`);

    // Prepare response (hide hidden test case details)
    const visibleResults = result.testCaseResults
      .filter((tc) => !tc.isHidden)
      .map((tc, index) => ({
        testCase: index + 1,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: tc.actualOutput,
        passed: tc.passed,
        time: Math.round(tc.executionTime),
        memory: Math.round(tc.memoryUsed * 10) / 10,
        error: tc.error,
      }));

    res.json({
      submissionId: submission.id,
      status: result.status,
      isAccepted: result.status === "ACCEPTED",
      testCasesPassed: result.testCasesPassed,
      totalTestCases: result.totalTestCases,
      runtime: Math.round(result.totalExecutionTime),
      memory: Math.round(result.maxMemoryUsed * 10) / 10,
      compilationError: result.compilationError,
      runtimeError: result.runtimeError,
      results: visibleResults,
      // Hidden test summary
      hiddenTestsPassed: result.testCaseResults.filter((tc) => tc.isHidden && tc.passed).length,
      hiddenTestsTotal: result.testCaseResults.filter((tc) => tc.isHidden).length,
    });
  } catch (error) {
    console.error("Practice submission error:", error);
    res.status(500).json({ error: "Failed to process submission" });
  }
});

// ============================================================================
// SUBMIT CODE (All Tests - Contest Mode)
// ============================================================================

/**
 * Submit code for contest
 * 
 * POST /submissions/contest
 */
router.post("/contest", authenticateToken, async (req: Request, res: Response) => {
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

    // Validate language
    if (!codeExecutionService.isLanguageSupported(language)) {
      return res.status(400).json({
        error: `Unsupported language: ${language}`,
      });
    }

    // Verify contest exists and is active
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        questions: {
          where: { questionId },
          include: { question: true },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    // Check runtime state
    const runtimeState = getRuntimeState(new Date(contest.startAt), new Date(contest.endAt));
    if (runtimeState !== "ACTIVE") {
      return res.status(400).json({ error: `Contest is ${runtimeState.toLowerCase()}` });
    }

    // Verify question is part of contest
    const contestQuestion = contest.questions[0];
    if (!contestQuestion) {
      return res.status(400).json({ error: "Question is not part of this contest" });
    }

    // Verify it's a coding question
    if (contestQuestion.question.type !== "CODING") {
      return res.status(400).json({ error: "This endpoint is only for coding questions" });
    }

    // Check user is participant
    const participant = await prisma.contestParticipant.findUnique({
      where: {
        contestId_userId: { contestId, userId },
      },
    });

    if (!participant) {
      return res.status(403).json({ error: "You must join the contest before submitting" });
    }

    // Check for existing submission (update instead of create)
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        userId_contestId_questionId: { userId, contestId, questionId },
      },
    });

    let submission;
    if (existingSubmission) {
      // Update existing
      submission = await prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          code,
          language,
          status: "PENDING",
          submittedAt: new Date(),
        },
      });
    } else {
      // Create new
      submission = await prisma.submission.create({
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
    }

    console.log(`📝 Contest submission ${submission.id} for contest ${contestId}`);

    // Update status to RUNNING
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "RUNNING" },
    });

    // Execute against ALL test cases
    const result = await codeExecutionService.submitCode(
      code,
      language,
      questionId
    );

    // Calculate points
    const isCorrect = result.status === "ACCEPTED";
    const points = isCorrect ? contestQuestion.points : 0;

    // Update submission with results
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: result.status,
        isCorrect,
        executionTime: Math.round(result.totalExecutionTime),
        memoryUsed: Math.round(result.maxMemoryUsed),
        testCasesPassed: result.testCasesPassed,
        totalTestCases: result.totalTestCases,
        compileOutput: result.compilationError,
        stderr: result.runtimeError,
      },
    });

    console.log(`✅ Contest submission ${submission.id}: ${result.status} (${points} points)`);

    // Prepare response
    const visibleResults = result.testCaseResults
      .filter((tc) => !tc.isHidden)
      .map((tc, index) => ({
        testCase: index + 1,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: tc.actualOutput,
        passed: tc.passed,
        time: Math.round(tc.executionTime),
        memory: Math.round(tc.memoryUsed * 10) / 10,
      }));

    res.json({
      submissionId: submission.id,
      status: result.status,
      isCorrect,
      points,
      testCasesPassed: result.testCasesPassed,
      totalTestCases: result.totalTestCases,
      runtime: Math.round(result.totalExecutionTime),
      memory: Math.round(result.maxMemoryUsed * 10) / 10,
      compilationError: result.compilationError,
      results: visibleResults,
    });
  } catch (error) {
    console.error("Contest submission error:", error);
    res.status(500).json({ error: "Failed to process submission" });
  }
});

// ============================================================================
// LEGACY ENDPOINT (for backward compatibility)
// ============================================================================

/**
 * Legacy code submission endpoint
 * Routes to either contest or practice based on presence of contestId
 * 
 * POST /submissions/code
 */
router.post("/code", authenticateToken, async (req: Request, res: Response) => {
  const { contestId } = req.body;
  
  if (contestId) {
    // Forward to contest endpoint
    return router.handle(
      { ...req, url: "/contest", method: "POST" } as any,
      res,
      () => {}
    );
  } else {
    // Forward to practice endpoint
    return router.handle(
      { ...req, url: "/practice", method: "POST" } as any,
      res,
      () => {}
    );
  }
});

// ============================================================================
// GET SUBMISSION DETAILS
// ============================================================================

/**
 * Get submission details by ID
 * 
 * GET /submissions/:id
 */
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.userId;

    // Try practice submission first
    let submission = await prisma.practiceSubmission.findUnique({
      where: { id },
      include: {
        question: {
          select: { id: true, title: true, difficulty: true },
        },
      },
    });

    if (submission) {
      // Verify ownership
      if (submission.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      return res.json({
        id: submission.id,
        type: "practice",
        question: submission.question,
        code: submission.code,
        language: submission.language,
        status: submission.status,
        runtime: submission.executionTime,
        memory: submission.memoryUsed,
        testCasesPassed: submission.testCasesPassed,
        totalTestCases: submission.totalTestCases,
        testResults: submission.testResults,
        compilationError: submission.compileOutput,
        runtimeError: submission.stderr,
        submittedAt: submission.submittedAt,
      });
    }

    // Try contest submission
    const contestSubmission = await prisma.submission.findUnique({
      where: { id },
      include: {
        question: {
          select: { id: true, title: true, difficulty: true },
        },
        contest: {
          select: { id: true, title: true },
        },
      },
    });

    if (!contestSubmission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Verify ownership
    if (contestSubmission.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      id: contestSubmission.id,
      type: "contest",
      contest: contestSubmission.contest,
      question: contestSubmission.question,
      code: contestSubmission.code,
      language: contestSubmission.language,
      status: contestSubmission.status,
      isCorrect: contestSubmission.isCorrect,
      runtime: contestSubmission.executionTime,
      memory: contestSubmission.memoryUsed,
      testCasesPassed: contestSubmission.testCasesPassed,
      totalTestCases: contestSubmission.totalTestCases,
      compilationError: contestSubmission.compileOutput,
      runtimeError: contestSubmission.stderr,
      submittedAt: contestSubmission.submittedAt,
    });
  } catch (error) {
    console.error("Get submission error:", error);
    res.status(500).json({ error: "Failed to get submission" });
  }
});

// ============================================================================
// GET SUBMISSION HISTORY
// ============================================================================

/**
 * Get user's submission history
 * 
 * GET /submissions/history?questionId=xxx&limit=20&offset=0
 */
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.userId;
    const { questionId, limit = "20", offset = "0" } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = parseInt(offset as string) || 0;

    // Get practice submissions
    const practiceWhere: any = { userId };
    if (questionId) {
      practiceWhere.questionId = questionId as string;
    }

    const practiceSubmissions = await prisma.practiceSubmission.findMany({
      where: practiceWhere,
      include: {
        question: {
          select: { id: true, title: true, difficulty: true },
        },
      },
      orderBy: { submittedAt: "desc" },
      take,
      skip,
    });

    // Get contest submissions
    const contestWhere: any = { userId };
    if (questionId) {
      contestWhere.questionId = questionId as string;
    }

    const contestSubmissions = await prisma.submission.findMany({
      where: contestWhere,
      include: {
        question: {
          select: { id: true, title: true, difficulty: true },
        },
        contest: {
          select: { id: true, title: true },
        },
      },
      orderBy: { submittedAt: "desc" },
      take,
      skip,
    });

    // Combine and sort
    const allSubmissions = [
      ...practiceSubmissions.map((s) => ({
        id: s.id,
        type: "practice" as const,
        question: s.question,
        language: s.language,
        status: s.status,
        runtime: s.executionTime,
        memory: s.memoryUsed,
        testCasesPassed: s.testCasesPassed,
        totalTestCases: s.totalTestCases,
        submittedAt: s.submittedAt,
      })),
      ...contestSubmissions.map((s) => ({
        id: s.id,
        type: "contest" as const,
        contest: s.contest,
        question: s.question,
        language: s.language,
        status: s.status,
        isCorrect: s.isCorrect,
        runtime: s.executionTime,
        memory: s.memoryUsed,
        testCasesPassed: s.testCasesPassed,
        totalTestCases: s.totalTestCases,
        submittedAt: s.submittedAt,
      })),
    ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    res.json({
      submissions: allSubmissions.slice(0, take),
      total: allSubmissions.length,
    });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Failed to get submission history" });
  }
});

// ============================================================================
// JUDGE0 CALLBACK (for async submissions)
// ============================================================================

/**
 * Webhook callback from Judge0
 * 
 * PUT /submissions/callback
 */
router.put("/callback", async (req: Request, res: Response) => {
  try {
    const { token, status, stdout, stderr, compile_output, time, memory } = req.body;

    console.log(`📩 Judge0 callback for token: ${token}`);

    // Find submission by judge0 token
    let submission = await prisma.practiceSubmission.findFirst({
      where: { judge0Token: token },
    });

    if (submission) {
      // Update practice submission
      await prisma.practiceSubmission.update({
        where: { id: submission.id },
        data: {
          status: mapJudge0Status(status.id),
          executionTime: parseFloat(time || "0") * 1000,
          memoryUsed: (memory || 0) / 1024,
          compileOutput: compile_output,
          stderr,
        },
      });

      // Notify via WebSocket
      sendSubmissionUpdate(submission.userId, {
        submissionId: submission.id,
        status: mapJudge0Status(status.id),
      });
    } else {
      // Try contest submission
      const contestSubmission = await prisma.submission.findFirst({
        where: { judge0Token: token },
      });

      if (contestSubmission) {
        await prisma.submission.update({
          where: { id: contestSubmission.id },
          data: {
            status: mapJudge0Status(status.id),
            isCorrect: status.id === 3,
            executionTime: parseFloat(time || "0") * 1000,
            memoryUsed: (memory || 0) / 1024,
            compileOutput: compile_output,
            stderr,
          },
        });

        sendSubmissionUpdate(contestSubmission.userId, {
          submissionId: contestSubmission.id,
          status: mapJudge0Status(status.id),
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Callback error:", error);
    res.status(500).json({ error: "Callback processing failed" });
  }
});

/**
 * Map Judge0 status ID to our status
 */
function mapJudge0Status(statusId: number): SubmissionStatus {
  switch (statusId) {
    case 1:
    case 2:
      return "RUNNING";
    case 3:
      return "ACCEPTED";
    case 4:
      return "WRONG_ANSWER";
    case 5:
      return "TIME_LIMIT_EXCEEDED";
    case 6:
      return "COMPILATION_ERROR";
    default:
      return "RUNTIME_ERROR";
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check if code execution service is healthy
 * 
 * GET /submissions/health
 */
router.get("/health/check", async (req: Request, res: Response) => {
  try {
    const healthy = await codeExecutionService.healthCheck();
    res.json({
      status: healthy ? "healthy" : "unhealthy",
      judge0: healthy,
      languages: codeExecutionService.getSupportedLanguages(),
    });
  } catch (error) {
    res.status(500).json({ status: "unhealthy", error: String(error) });
  }
});

export default router;
