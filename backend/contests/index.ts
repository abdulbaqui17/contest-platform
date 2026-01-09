import { Router } from "express";
import { z } from "zod";
import prisma from "../../db/db";

const router = Router();

// GET /contests - List all contests (active, upcoming, past)
router.get("/", async (req, res) => {
  try {
    // Implementation will fetch all contests
    // Returns array of contest summaries with status
    res.json([]);
  } catch (error) {
    console.error("Get contests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /contest/:contestId - Get contest details
router.get("/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    
    // Implementation will fetch contest by ID with questions
    // Returns contest metadata, status, and questions list
    
    res.json({});
  } catch (error) {
    console.error("Get contest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contest/:contestId/join - Join a contest
router.post("/:contestId/join", async (req, res) => {
  try {
    const { contestId } = req.params;
    // userId from JWT middleware will be available
    
    // Implementation will create ContestParticipant record
    // Check if contest is joinable (UPCOMING or ACTIVE)
    // Check if user already joined
    
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

export default router;
