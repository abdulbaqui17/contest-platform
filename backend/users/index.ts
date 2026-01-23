/**
 * User Stats Routes
 * 
 * Endpoints:
 * - GET /stats          → Get current user's stats
 * - GET /stats/:userId  → Get any user's public stats
 * - GET /profile        → Get current user's profile with stats
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../../db/prismaClient";
import { authenticateToken, optionalAuth } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

// ============================================================================
// GET CURRENT USER STATS
// ============================================================================

/**
 * Get authenticated user's complete stats
 * 
 * GET /users/stats
 */
router.get("/stats", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get or create stats
    let stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      stats = await prisma.userStats.create({
        data: { userId },
      });
    }

    // Get recent submissions
    const recentSubmissions = await prisma.practiceSubmission.findMany({
      where: { userId },
      include: {
        question: {
          select: { id: true, title: true, difficulty: true },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
    });

    // Get solved problems by difficulty for calendar/heatmap
    const solvedProblems = await prisma.solvedQuestion.findMany({
      where: { userId },
      include: {
        question: {
          select: { id: true, title: true, difficulty: true },
        },
      },
      orderBy: { solvedAt: "desc" },
    });

    // Calculate submission activity for last 365 days (for heatmap)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const submissionActivity = await prisma.practiceSubmission.groupBy({
      by: ["submittedAt"],
      where: {
        userId,
        submittedAt: { gte: oneYearAgo },
      },
      _count: true,
    });

    // Group by date
    const activityByDate: Record<string, number> = {};
    submissionActivity.forEach((item: any) => {
      const date = new Date(item.submittedAt).toISOString().split("T")[0];
      activityByDate[date] = (activityByDate[date] || 0) + item._count;
    });

    // Get language distribution
    const languageStats = await prisma.practiceSubmission.groupBy({
      by: ["language"],
      where: { userId, status: "ACCEPTED" },
      _count: true,
    });

    res.json({
      // Core stats
      totalSolved: stats.totalSolved,
      easySolved: stats.easySolved,
      mediumSolved: stats.mediumSolved,
      hardSolved: stats.hardSolved,
      totalAttempted: stats.totalAttempted,

      // Submission stats
      totalSubmissions: stats.totalSubmissions,
      acceptedCount: stats.acceptedCount,
      acceptanceRate: Math.round(stats.acceptanceRate * 10) / 10,

      // Contest stats
      contestsParticipated: stats.contestsParticipated,
      bestContestRank: stats.bestContestRank,
      totalContestScore: stats.totalContestScore,

      // Streak
      currentStreak: stats.currentStreak,
      maxStreak: stats.maxStreak,
      lastActiveAt: stats.lastActiveAt,

      // Recent activity
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        question: s.question,
        language: s.language,
        status: s.status,
        runtime: s.executionTime,
        submittedAt: s.submittedAt,
      })),

      // Solved problems list
      solvedProblems: solvedProblems.map((sp) => ({
        questionId: sp.questionId,
        title: sp.question.title,
        difficulty: sp.question.difficulty,
        solvedAt: sp.solvedAt,
        bestRuntime: sp.bestRuntime,
        bestMemory: sp.bestMemory,
        language: sp.language,
      })),

      // Activity heatmap data
      activityHeatmap: activityByDate,

      // Language distribution
      languageDistribution: languageStats.map((ls: any) => ({
        language: ls.language,
        count: ls._count,
      })),
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Failed to get user stats" });
  }
});

// ============================================================================
// GET PUBLIC USER STATS
// ============================================================================

/**
 * Get any user's public stats (for profile pages)
 * 
 * GET /users/stats/:userId
 */
router.get("/stats/:userId", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get stats
    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      return res.json({
        user: { id: user.id, name: user.name, joinedAt: user.createdAt },
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        acceptanceRate: 0,
        currentStreak: 0,
        maxStreak: 0,
      });
    }

    res.json({
      user: { id: user.id, name: user.name, joinedAt: user.createdAt },
      totalSolved: stats.totalSolved,
      easySolved: stats.easySolved,
      mediumSolved: stats.mediumSolved,
      hardSolved: stats.hardSolved,
      totalSubmissions: stats.totalSubmissions,
      acceptanceRate: Math.round(stats.acceptanceRate * 10) / 10,
      contestsParticipated: stats.contestsParticipated,
      bestContestRank: stats.bestContestRank,
      currentStreak: stats.currentStreak,
      maxStreak: stats.maxStreak,
    });
  } catch (error) {
    console.error("Get public stats error:", error);
    res.status(500).json({ error: "Failed to get user stats" });
  }
});

// ============================================================================
// GET USER PROFILE
// ============================================================================

/**
 * Get current user's complete profile
 * 
 * GET /users/profile
 */
router.get("/profile", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    res.json({
      ...user,
      stats: stats || {
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        totalSubmissions: 0,
        acceptanceRate: 0,
        currentStreak: 0,
        maxStreak: 0,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// ============================================================================
// GET LEADERBOARD
// ============================================================================

/**
 * Get global leaderboard by problems solved
 * 
 * GET /users/leaderboard?limit=50
 */
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const { limit = "50" } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 100);

    const leaderboard = await prisma.userStats.findMany({
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { totalSolved: "desc" },
        { acceptanceRate: "desc" },
      ],
      take,
    });

    res.json({
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        name: entry.user.name,
        totalSolved: entry.totalSolved,
        easySolved: entry.easySolved,
        mediumSolved: entry.mediumSolved,
        hardSolved: entry.hardSolved,
        acceptanceRate: Math.round(entry.acceptanceRate * 10) / 10,
        currentStreak: entry.currentStreak,
      })),
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
