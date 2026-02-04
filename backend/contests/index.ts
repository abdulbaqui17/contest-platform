import { Router } from "express";
import { prisma } from "../../db/prismaClient";
import { authenticateToken, requireAdmin, type AuthRequest } from "../middleware/auth";
import { ContestOrchestrator, getRuntimeState } from "../services/contest.orchestrator";
import { MockContestService } from "../services/mocks";
import { RedisLeaderboardService } from "../services/leaderboard.service";
import { PrismaSubmissionService } from "../services/submission.service";
import { redis } from "../redis";
import { getPublicWs } from "../websocket/public";

const router = Router();
const contestService = new MockContestService();
const leaderboardService = new RedisLeaderboardService(redis);
const submissionService = new PrismaSubmissionService(leaderboardService);

// GET /contests - List all contests (active, upcoming, past)
router.get("/", async (req, res) => {
  try {
    const contests = await prisma.contest.findMany({
      orderBy: { startAt: 'desc' }
    });
    
    // Update status based on current time
    const now = new Date();
    const updatedContests = contests.map(contest => {
      const start = new Date(contest.startAt);
      const end = new Date(contest.endAt);
      
      let status = contest.status;
      if (end <= now) {
        status = 'COMPLETED';
      } else if (start <= now && end > now) {
        status = 'ACTIVE';
      } else if (start > now) {
        status = 'UPCOMING';
      }
      
      return { ...contest, status };
    });
    
    res.json(updatedContests);
  } catch (error) {
    console.error("Get contests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contests - Create new contest
router.post("/", async (req, res) => {
  try {
    const { title, description, startAt, endAt, questions } = req.body;
    
    console.log('🕐 Backend received:', { title, startAt, endAt });
    
    // Parse ISO strings - these should already be in UTC from frontend
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    const now = new Date();
    
    console.log('🕐 Parsed dates:', {
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
      nowISO: now.toISOString()
    });
    
    // Validate contest duration (max 24 hours)
    const durationInHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (durationInHours > 24) {
      return res.status(400).json({ error: "Contest duration cannot exceed 24 hours" });
    }
    
    // Validate end time is after start time
    if (endDate <= startDate) {
      return res.status(400).json({ error: "End time must be after start time" });
    }
    
    // Determine status based on start time
    let status: "UPCOMING" | "ACTIVE" | "COMPLETED" = "UPCOMING";
    if (startDate <= now && endDate > now) {
      status = "ACTIVE";
    } else if (endDate <= now) {
      status = "COMPLETED";
    }
    
    const contest = await prisma.contest.create({
      data: {
        title,
        description,
        startAt: startDate,
        endAt: endDate,
        status,
        questions: questions && questions.length > 0 ? {
          create: questions.map((q: any, index: number) => ({
            questionId: q.id,
            orderIndex: index,
            points: q.points || 10,
            timeLimit: q.timeLimit || 120
          }))
        } : undefined
      },
      include: {
        questions: {
          include: {
            question: true
          }
        }
      }
    });
    
    // If contest is starting now (ACTIVE), start the orchestrator
    if (status === "ACTIVE") {
      const orchestrator = ContestOrchestrator.getInstance();
      if (orchestrator) {
        await orchestrator.startContest(contest.id);
        console.log(`🚀 Started orchestrator for newly created ACTIVE contest: ${contest.id}`);
      }
    }

    const publicWs = getPublicWs();
    if (publicWs) {
      publicWs.scheduleContest(contest.id, startDate, endDate);
      await publicWs.broadcastContestsUpdate();
    }
    
    res.status(201).json(contest);
  } catch (error) {
    console.error("Create contest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /contest/:contestId - Get contest details
router.get("/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        questions: {
          include: {
            question: true
          },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }
    
    const formattedContest = {
      ...contest,
      questions: contest.questions.map(cq => ({
        id: cq.questionId,
        title: cq.question.title,
        orderIndex: cq.orderIndex,
        points: cq.points,
        timeLimit: cq.timeLimit
      }))
    };
    
    res.json(formattedContest);
  } catch (error) {
    console.error("Get contest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /contests/:contestId/questions - List contest questions (admin)
router.get("/:contestId/questions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { contestId } = req.params;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        questions: {
          include: {
            question: {
              include: {
                mcqOptions: true,
                testCases: { orderBy: { order: "asc" } },
              },
            },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    const questions = contest.questions.map((cq) => ({
      id: cq.questionId,
      type: cq.question.type,
      title: cq.question.title,
      description: cq.question.description,
      options: cq.question.mcqOptions,
      testCases: cq.question.testCases,
      points: cq.points,
      timeLimit: cq.timeLimit,
    }));

    res.json(questions);
  } catch (error) {
    console.error("Get contest questions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contests/:contestId/questions - Create and attach a question to contest (admin)
router.post("/:contestId/questions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { contestId } = req.params;
    const {
      type = "MCQ",
      title,
      description,
      options,
      testCases,
      points = 10,
      timeLimit = 60,
      difficulty,
      functionName,
      memoryLimit,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    if (type === "MCQ" && (!options || options.length === 0)) {
      return res.status(400).json({ error: "MCQ options are required" });
    }

    const existingCount = await prisma.contestQuestion.count({
      where: { contestId },
    });

    const isCodeQuestion = ["CODING", "DSA", "SANDBOX"].includes(type);
    const question = await prisma.question.create({
      data: {
        type,
        title,
        description,
        difficulty,
        functionName,
        memoryLimit: isCodeQuestion ? memoryLimit ?? 256 : null,
        timeLimit: isCodeQuestion ? (timeLimit < 1000 ? timeLimit * 1000 : timeLimit) : null,
        mcqOptions: type === "MCQ" ? {
          create: options.map((opt: any) => ({
            text: opt.text,
            isCorrect: !!opt.isCorrect,
          })),
        } : undefined,
        testCases: isCodeQuestion ? {
          create: (testCases || []).map((tc: any, index: number) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: !!tc.isHidden,
            order: tc.order ?? index,
          })),
        } : undefined,
      },
      include: {
        mcqOptions: true,
        testCases: { orderBy: { order: "asc" } },
      },
    });

    await prisma.contestQuestion.create({
      data: {
        contestId,
        questionId: question.id,
        orderIndex: existingCount,
        points,
        timeLimit,
      },
    });

    res.status(201).json({
      id: question.id,
      type: question.type,
      title: question.title,
      description: question.description,
      options: question.mcqOptions,
      testCases: question.testCases,
      points,
      timeLimit,
    });
  } catch (error) {
    console.error("Create contest question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contest/:contestId/join - Join a contest
router.post("/:contestId/join", authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = (req as AuthRequest).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    // Check if contest exists
    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    });
    
    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }
    
    // Dynamically check if contest is joinable based on current time
    const now = new Date();
    const startAt = new Date(contest.startAt);
    const endAt = new Date(contest.endAt);
    
    let actualStatus = contest.status;
    if (endAt <= now) {
      actualStatus = "COMPLETED";
    } else if (startAt <= now && endAt > now) {
      actualStatus = "ACTIVE";
    } else if (startAt > now) {
      actualStatus = "UPCOMING";
    }
    
    console.log('🕐 Join contest attempt:', {
      contestId,
      userId,
      dbStatus: contest.status,
      calculatedStatus: actualStatus,
      now: now.toISOString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString()
    });
    
    // Allow joining if UPCOMING or ACTIVE
    if (actualStatus !== "ACTIVE" && actualStatus !== "UPCOMING") {
      return res.status(400).json({ 
        error: "Contest is not joinable",
        status: actualStatus
      });
    }
    
    // Check if already joined (use correct composite key order: contestId_userId)
    const existing = await prisma.contestParticipant.findUnique({
      where: {
        contestId_userId: {
          contestId,
          userId
        }
      }
    });
    
    if (existing) {
      return res.json({ message: "Already joined contest" });
    }
    
    // Create participant record
    await prisma.contestParticipant.create({
      data: {
        userId,
        contestId,
        joinedAt: new Date()
      }
    });
    
    console.log(`✅ User ${userId} joined contest ${contestId}`);
    res.json({ message: "Successfully joined contest" });
  } catch (error) {
    console.error("Join contest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /contest/:contestId/current-question - Get current question during active contest
router.get("/:contestId/current-question", authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { id: true, startAt: true, endAt: true }
    });

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    const runtimeState = getRuntimeState(contest.startAt, contest.endAt);
    if (runtimeState !== "ACTIVE") {
      return res.status(400).json({ error: `Contest is ${runtimeState.toLowerCase()}` });
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: {
        contestId_userId: { contestId, userId }
      }
    });

    if (!participant) {
      return res.status(403).json({ error: "You must join the contest first" });
    }

    const orchestrator = ContestOrchestrator.getInstance();
    if (orchestrator) {
      await orchestrator.ensureContestRunning(contestId);
    }

    const question = await contestService.getCurrentQuestion(contestId, userId);
    if (!question) {
      return res.json({ completed: true, message: "All questions answered" });
    }

    res.json(question);
  } catch (error) {
    console.error("Get current question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contest/:contestId/submit - Submit answer for current question
router.post("/:contestId/submit", authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const { questionId, selectedOptionId } = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!questionId) {
      return res.status(400).json({ error: "questionId is required" });
    }

    const result = await submissionService.submitAnswer({
      userId,
      contestId,
      questionId,
      selectedOptionId: selectedOptionId || null,
      submittedAt: new Date().toISOString(),
    });

    const orchestrator = ContestOrchestrator.getInstance();
    if (orchestrator) {
      orchestrator.recordSubmission(contestId, userId, questionId);
    }

    const publicWs = getPublicWs();
    if (publicWs) {
      await publicWs.broadcastLeaderboardUpdate(contestId);
    }

    res.json(result);
  } catch (error: any) {
    console.error("Submit answer error:", error);
    if (error?.message?.includes("CONTEST_NOT_ACTIVE")) {
      return res.status(400).json({ error: error.message });
    }
    if (error?.message?.includes("NOT_PARTICIPANT")) {
      return res.status(403).json({ error: "You must join the contest first" });
    }
    if (error?.message?.includes("ALREADY_SUBMITTED")) {
      return res.status(409).json({ error: "Already submitted for this question" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /leaderboard/:contestId - Get full leaderboard (top 50)
router.get("/leaderboard/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    const topN = await leaderboardService.getTopN(contestId, 50);
    const totalParticipants = await leaderboardService.getTotalParticipants(contestId);
    res.json({ leaderboard: topN, totalParticipants });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /leaderboard/:contestId/me - Get user's leaderboard position
router.get("/leaderboard/:contestId/me", authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const entry = await leaderboardService.getUserRank(contestId, userId);
    if (!entry) {
      return res.status(404).json({ error: "Leaderboard entry not found" });
    }

    res.json(entry);
  } catch (error) {
    console.error("Get my leaderboard entry error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /contest/:contestId/leaderboard - Get leaderboard for a contest
router.get("/:contestId/leaderboard", async (req, res) => {
  try {
    const { contestId } = req.params;
    
    // Check if contest exists
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        participants: true
      }
    });
    
    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }
    
    // First try to get from LeaderboardSnapshot (for completed contests)
    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where: { contestId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { rank: 'asc' }
    });
    
    if (snapshots.length > 0) {
      // Use persisted leaderboard data
      const leaderboard = snapshots.map(s => ({
        rank: s.rank,
        userId: s.userId,
        userName: s.user.name,
        score: s.score,
        questionsAnswered: 0 // Will be calculated below
      }));
      
      // Get submission counts
      const submissionCounts = await prisma.submission.groupBy({
        by: ['userId'],
        where: {
          contestId,
          userId: { in: leaderboard.map(l => l.userId) },
          isCorrect: true
        },
        _count: { userId: true }
      });
      
      const countMap = new Map(submissionCounts.map(s => [s.userId, s._count.userId]));
      leaderboard.forEach(entry => {
        entry.questionsAnswered = countMap.get(entry.userId) || 0;
      });
      
      return res.json({
        leaderboard,
        totalParticipants: contest.participants.length
      });
    }
    
    // For active contests, calculate from submissions
    const participants = await prisma.contestParticipant.findMany({
      where: { contestId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });
    
    // Get correct submissions with points
    const submissions = await prisma.submission.findMany({
      where: {
        contestId,
        isCorrect: true
      },
      include: {
        question: {
          include: {
            contests: {
              where: { contestId },
              select: { points: true }
            }
          }
        }
      }
    });
    
    // Calculate scores
    const scoreMap = new Map<string, { score: number; questionsAnswered: number }>();
    
    // Initialize all participants with 0
    participants.forEach(p => {
      scoreMap.set(p.userId, { score: 0, questionsAnswered: 0 });
    });
    
    // Add up scores from correct submissions
    submissions.forEach(s => {
      const current = scoreMap.get(s.userId) || { score: 0, questionsAnswered: 0 };
      const points = s.question.contests[0]?.points || 10;
      scoreMap.set(s.userId, {
        score: current.score + points,
        questionsAnswered: current.questionsAnswered + 1
      });
    });
    
    // Build leaderboard
    const leaderboard = participants.map(p => {
      const data = scoreMap.get(p.userId) || { score: 0, questionsAnswered: 0 };
      return {
        userId: p.userId,
        userName: p.user.name,
        score: data.score,
        questionsAnswered: data.questionsAnswered,
        rank: 0 // Will be calculated
      };
    });
    
    // Sort by score descending and assign ranks
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    
    res.json({
      leaderboard,
      totalParticipants: participants.length
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /contests/:contestId - Delete a contest
router.delete("/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    
    // Check if contest exists
    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    });
    
    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }
    
    // Use transaction to delete related records first, then the contest
    await prisma.$transaction(async (tx) => {
      // Delete all ContestQuestion records for this contest
      await tx.contestQuestion.deleteMany({
        where: { contestId: contestId }
      });
      
      // Delete all ContestParticipant records for this contest
      await tx.contestParticipant.deleteMany({
        where: { contestId: contestId }
      });
      
      // Delete all Submission records for this contest
      await tx.submission.deleteMany({
        where: { contestId: contestId }
      });
      
      // Delete all LeaderboardSnapshot records for this contest
      await tx.leaderboardSnapshot.deleteMany({
        where: { contestId: contestId }
      });
      
      // Finally delete the contest
      await tx.contest.delete({
        where: { id: contestId }
      });
    });
    
    res.json({ message: "Contest deleted successfully" });

    const publicWs = getPublicWs();
    if (publicWs) {
      publicWs.unscheduleContest(contestId);
      await publicWs.broadcastContestsUpdate();
    }
  } catch (error) {
    console.error("Delete contest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
