/**
 * Editorial Routes
 * 
 * Endpoints:
 * - GET /editorials/:questionId       → Get editorial for a question
 * - POST /editorials/:questionId      → Create/update editorial (admin)
 * - GET /editorials/:questionId/hints → Get progressive hints
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../../db/prismaClient";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

// ============================================================================
// GET EDITORIAL
// ============================================================================

/**
 * Get editorial for a question
 * Only available after user has solved the problem OR is admin
 * 
 * GET /editorials/:questionId
 */
router.get("/:questionId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const userId = (req as AuthRequest).user?.userId;
    const userRole = (req as AuthRequest).user?.role;

    // Get question with editorial
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        editorial: true,
      },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (!question.editorial) {
      return res.status(404).json({ error: "No editorial available for this question" });
    }

    // Check if user has access (solved the problem or is admin)
    const isAdmin = userRole === "ADMIN";
    
    if (!isAdmin) {
      const hasSolved = await prisma.solvedQuestion.findUnique({
        where: {
          userId_questionId: { userId: userId!, questionId },
        },
      });

      if (!hasSolved) {
        return res.status(403).json({
          error: "You must solve this problem first to view the editorial",
          hint: "Keep trying! You can do it.",
        });
      }
    }

    const editorial = question.editorial;

    res.json({
      questionId,
      questionTitle: question.title,
      approach: editorial.approach,
      timeComplexity: editorial.timeComplexity,
      spaceComplexity: editorial.spaceComplexity,
      solutionCode: editorial.solutionCode,
      hints: editorial.hints,
      videoUrl: editorial.videoUrl,
    });
  } catch (error) {
    console.error("Get editorial error:", error);
    res.status(500).json({ error: "Failed to get editorial" });
  }
});

// ============================================================================
// GET HINTS (Progressive - doesn't require solving)
// ============================================================================

/**
 * Get progressive hints for a question
 * Each call reveals the next hint
 * 
 * GET /editorials/:questionId/hints?revealed=1
 */
router.get("/:questionId/hints", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const { revealed = "0" } = req.query;
    const revealCount = Math.max(0, parseInt(revealed as string) || 0);

    // Get question with editorial
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        editorial: {
          select: { hints: true },
        },
      },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (!question.editorial || !question.editorial.hints.length) {
      return res.status(404).json({ error: "No hints available for this question" });
    }

    const allHints = question.editorial.hints;
    const visibleHints = allHints.slice(0, Math.min(revealCount + 1, allHints.length));
    const hasMoreHints = revealCount + 1 < allHints.length;

    res.json({
      questionId,
      hints: visibleHints,
      totalHints: allHints.length,
      revealedCount: visibleHints.length,
      hasMore: hasMoreHints,
      nextHintIndex: hasMoreHints ? revealCount + 1 : null,
    });
  } catch (error) {
    console.error("Get hints error:", error);
    res.status(500).json({ error: "Failed to get hints" });
  }
});

// ============================================================================
// CREATE/UPDATE EDITORIAL (Admin)
// ============================================================================

/**
 * Create or update editorial for a question
 * 
 * POST /editorials/:questionId
 */
router.post("/:questionId", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const {
      approach,
      timeComplexity,
      spaceComplexity,
      solutionCode,
      hints,
      videoUrl,
    } = req.body;

    // Validate required fields
    if (!approach || !timeComplexity || !spaceComplexity) {
      return res.status(400).json({
        error: "Missing required fields: approach, timeComplexity, spaceComplexity",
      });
    }

    // Verify question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Upsert editorial
    const editorial = await prisma.editorial.upsert({
      where: { questionId },
      update: {
        approach,
        timeComplexity,
        spaceComplexity,
        solutionCode: solutionCode || {},
        hints: hints || [],
        videoUrl,
      },
      create: {
        questionId,
        approach,
        timeComplexity,
        spaceComplexity,
        solutionCode: solutionCode || {},
        hints: hints || [],
        videoUrl,
      },
    });

    res.json({
      message: "Editorial saved successfully",
      editorial: {
        id: editorial.id,
        questionId: editorial.questionId,
        approach: editorial.approach,
        timeComplexity: editorial.timeComplexity,
        spaceComplexity: editorial.spaceComplexity,
        hintsCount: editorial.hints.length,
        hasVideo: !!editorial.videoUrl,
      },
    });
  } catch (error) {
    console.error("Save editorial error:", error);
    res.status(500).json({ error: "Failed to save editorial" });
  }
});

// ============================================================================
// DELETE EDITORIAL (Admin)
// ============================================================================

/**
 * Delete editorial for a question
 * 
 * DELETE /editorials/:questionId
 */
router.delete("/:questionId", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;

    await prisma.editorial.delete({
      where: { questionId },
    });

    res.json({ message: "Editorial deleted successfully" });
  } catch (error) {
    console.error("Delete editorial error:", error);
    res.status(500).json({ error: "Failed to delete editorial" });
  }
});

export default router;
