import { Router } from "express";
import { prisma } from "../../db/prismaClient";

const router = Router();

// POST /questions - Create new question
router.post("/", async (req, res) => {
  try {
    const {
      type,
      title,
      description,
      options,
      testCases,
      timeLimit,
      memoryLimit,
      difficulty,
      functionName,
      starterCode,
      tags,
    } = req.body;

    if (!type || !title || !description) {
      return res.status(400).json({ error: "type, title, and description are required" });
    }

    if (type === "MCQ") {
      const hasCorrect = Array.isArray(options) && options.some((opt: any) => opt.isCorrect);
      if (!hasCorrect) {
        return res.status(400).json({ error: "MCQ requires at least one correct option" });
      }
    }

    const isCodeQuestion = ["CODING", "DSA", "SANDBOX"].includes(type);
    const codingTimeLimit =
      typeof timeLimit === "number"
        ? timeLimit < 1000
          ? timeLimit * 1000
          : timeLimit
        : 2000;
    const codingMemoryLimit = typeof memoryLimit === "number" ? memoryLimit : 256;

    // Create question with options (for MCQ) or test cases (for CODING)
    const question = await prisma.question.create({
      data: {
        type,
        title,
        description,
        difficulty,
        functionName,
        starterCode,
        tags: Array.isArray(tags) ? tags : undefined,
        timeLimit: isCodeQuestion ? codingTimeLimit : null,
        memoryLimit: isCodeQuestion ? codingMemoryLimit : null,
        mcqOptions: type === "MCQ" && options ? {
          create: options.map((opt: any) => ({
            text: opt.text,
            isCorrect: !!opt.isCorrect,
          })),
        } : undefined,
        testCases: isCodeQuestion && testCases ? {
          create: testCases.map((tc: any, index: number) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: !!tc.isHidden,
            order: tc.order ?? index,
          })),
        } : undefined,
      },
      include: {
        mcqOptions: true,
        testCases: {
          orderBy: { order: "asc" },
        },
      },
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
        mcqOptions: true,
        testCases: {
          orderBy: { order: 'asc' }
        }
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
        mcqOptions: true,
        testCases: {
          orderBy: { order: 'asc' }
        }
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

// GET /questions/:id/testcases - Get test cases for a coding question (visible only for users)
router.get("/:id/testcases", async (req, res) => {
  try {
    const { id } = req.params;
    const { includeHidden } = req.query;
    
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        testCases: {
          where: includeHidden === 'true' ? {} : { isHidden: false },
          orderBy: { order: 'asc' }
        }
      }
    });
    
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }
    
    if (!["CODING", "DSA", "SANDBOX"].includes(question.type)) {
      return res.status(400).json({ error: "Test cases only available for coding questions" });
    }
    
    res.json({
      questionId: id,
      timeLimit: question.timeLimit,
      memoryLimit: question.memoryLimit,
      testCases: question.testCases.map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        order: tc.order
      }))
    });
  } catch (error) {
    console.error("Get test cases error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
