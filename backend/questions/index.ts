import { Router } from "express";
import { prisma } from "../../db/prismaClient";

const router = Router();

// POST /questions - Create new question
router.post("/", async (req, res) => {
  try {
    const { type, title, description, options } = req.body;
    
    // Create question with options (for MCQ)
    const question = await prisma.question.create({
      data: {
        type,
        title,
        description,
        mcqOptions: type === 'MCQ' && options ? {
          create: options.map((opt: any) => ({
            text: opt.text,
            isCorrect: opt.isCorrect
          }))
        } : undefined
      },
      include: {
        mcqOptions: true
      }
    });
    
    res.status(201).json(question);
  } catch (error) {
    console.error("Create question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /questions - Get all questions
router.get("/", async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        mcqOptions: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(questions);
  } catch (error) {
    console.error("Get questions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /questions/:id - Get question by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        mcqOptions: true
      }
    });
    
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }
    
    res.json(question);
  } catch (error) {
    console.error("Get question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
