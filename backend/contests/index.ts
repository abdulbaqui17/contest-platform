import { Router } from "express";
import { prisma } from "../../db/prismaClient";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { ContestOrchestrator } from "../services/contest.orchestrator";

const router = Router();

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
router.get("/:contestId/current-question", async (req, res) => {
  try {
    const { contestId } = req.params;
    // userId from JWT middleware will be available
    
    // Implementation will:
    // - Verify contest is ACTIVE
    // - Verify user is a participant
    // - Find next unanswered question for user
    // - Return question with options (for MCQ) but not correct answers
    
    res.json({});
  } catch (error) {
    console.error("Get current question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contest/:contestId/submit - Submit answer for current question
router.post("/:contestId/submit", async (req, res) => {
  try {
    const { contestId } = req.params;
    const { questionId, selectedOptionId } = req.body;
    // userId from JWT middleware will be available
    
    // Implementation will:
    // - Verify contest is ACTIVE
    // - Verify user is a participant
    // - Verify question belongs to contest
    // - Check if user already submitted for this question
    // - Validate answer and create Submission record
    // - Return whether answer is correct and points earned
    
    res.json({ isCorrect: false, points: 0 });
  } catch (error) {
    console.error("Submit answer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /leaderboard/:contestId - Get full leaderboard
router.get("/leaderboard/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    
    // Implementation will:
    // - Verify contest is COMPLETED
    // - Fetch leaderboard snapshots ordered by rank
    // - Return array of rank, user, and score
    
    res.json([]);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /leaderboard/:contestId/me - Get user's leaderboard position
router.get("/leaderboard/:contestId/me", async (req, res) => {
  try {
    const { contestId } = req.params;
    // userId from JWT middleware will be available
    
    // Implementation will:
    // - Verify contest is COMPLETED
    // - Fetch user's leaderboard snapshot
    // - Return user's rank and score
    
    res.json({});
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
  } catch (error) {
    console.error("Delete contest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
