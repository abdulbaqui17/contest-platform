import { prisma } from "../../db/prismaClient";
import type {
  ContestService,
  LeaderboardService,
  SubmissionService,
  TimerService,
} from "./interfaces";
import { ContestOrchestrator, getRuntimeState, type RuntimeState } from "./contest.orchestrator";
import { redis } from "../redis";

export class MockContestService implements ContestService {
  async getContest(contestId: string) {
    // Get actual contest from database
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        questions: {
          include: {
            question: true
          }
        }
      }
    });
    
    if (!contest) {
      return null;
    }
    
    return {
      id: contest.id,
      title: contest.title,
      status: contest.status,
      startAt: contest.startAt,
      endAt: contest.endAt,
      questions: contest.questions
    };
  }

  async isUserParticipant(contestId: string, userId: string): Promise<boolean> {
    // Check if user has joined the contest
    const participant = await prisma.contestParticipant.findUnique({
      where: {
        contestId_userId: {
          contestId,
          userId
        }
      }
    });
    return !!participant;
  }

  async getCurrentQuestion(contestId: string, userId: string) {
    // CRITICAL FIX: Get the user's next unanswered question, NOT the orchestrator's current question
    // This allows users to progress at their own pace through sequential questions
    
    // Get all contest questions ordered by orderIndex
    const contestQuestions = await prisma.contestQuestion.findMany({
      where: { contestId },
      include: { question: true },
      orderBy: { orderIndex: 'asc' }
    });

    if (contestQuestions.length === 0) {
      console.log(`📭 No questions found for contest ${contestId}`);
      return null;
    }

    // Get all submissions by this user for this contest
    const userSubmissions = await prisma.submission.findMany({
      where: { contestId, userId },
      select: { questionId: true }
    });
    const submittedQuestionIds = new Set(userSubmissions.map(s => s.questionId));

    // Find the first unanswered question
    const nextQuestion = contestQuestions.find(cq => !submittedQuestionIds.has(cq.questionId));
    
    if (!nextQuestion) {
      // User has answered all questions
      console.log(`✅ User ${userId} has answered all questions in contest ${contestId}`);
      return null;
    }

    const question = nextQuestion.question;
    const questionNumber = nextQuestion.orderIndex + 1;
    const totalQuestions = contestQuestions.length;

    // Get MCQ options if it's an MCQ question
    let mcqOptions: Array<{ id: string; text: string }> = [];
    if (question.type === "MCQ") {
      const options = await prisma.mcqOption.findMany({
        where: { questionId: question.id },
        select: { id: true, text: true }
      });
      mcqOptions = options;
    }

    // Get timer info from orchestrator if available (for synchronized time remaining)
    const orchestrator = ContestOrchestrator.getInstance();
    let remainingTime = nextQuestion.timeLimit;
    
    if (orchestrator) {
      const orchestratorData = orchestrator.getCurrentQuestionData(contestId);
      // If the orchestrator is on the same question, use its timer
      if (orchestratorData && orchestratorData.question.id === question.id) {
        remainingTime = orchestratorData.remainingTime;
      }
    }

    return {
      questionId: question.id,
      contestQuestionId: nextQuestion.id,
      type: question.type as "MCQ" | "DSA" | "SANDBOX",
      title: question.title,
      description: question.description,
      mcqOptions,
      timeLimit: nextQuestion.timeLimit,
      points: nextQuestion.points,
      questionNumber,
      totalQuestions,
      startedAt: new Date().toISOString(),
    };
  }

  async getContestState(contestId: string) {
    // Get contest from database
    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    });

    if (!contest) {
      return { status: "NOT_FOUND" as const };
    }

    // CRITICAL: Calculate runtime state from timestamps, NOT DB status
    const startAt = new Date(contest.startAt);
    const endAt = new Date(contest.endAt);
    const runtimeState = getRuntimeState(startAt, endAt);

    // Get current question from orchestrator if active
    const orchestrator = ContestOrchestrator.getInstance();
    let currentQuestion = null;
    let timerRemaining = 0;

    if (runtimeState === "ACTIVE" && orchestrator) {
      // Ensure orchestrator is running for this contest
      await orchestrator.ensureContestRunning(contestId);
      
      const questionData = orchestrator.getCurrentQuestionData(contestId);
      if (questionData) {
        currentQuestion = questionData.question;
        timerRemaining = questionData.remainingTime;
      }
    }

    // For UPCOMING contests, include countdown to start
    const countdownToStart = runtimeState === "UPCOMING" 
      ? Math.max(0, Math.floor((startAt.getTime() - Date.now()) / 1000))
      : 0;

    return {
      status: runtimeState,
      currentQuestion,
      timerRemaining,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      countdownToStart,
    };
  }
}

export class MockSubmissionService implements SubmissionService {
  async submitAnswer(data: {
    userId: string;
    contestId: string;
    questionId: string;
    selectedOptionId: string | null;
    submittedAt: string;
  }) {
    const { userId, contestId, questionId, selectedOptionId, submittedAt } = data;

    // Get the contest question for points
    const contestQuestion = await prisma.contestQuestion.findFirst({
      where: { contestId, questionId },
      include: { question: true }
    });

    if (!contestQuestion) {
      throw new Error("Invalid question for this contest");
    }

    // Check if correct (for MCQ)
    let isCorrect = false;
    if (selectedOptionId) {
      const option = await prisma.mcqOption.findUnique({
        where: { id: selectedOptionId }
      });
      isCorrect = option?.isCorrect ?? false;
    }

    const pointsEarned = isCorrect ? contestQuestion.points : 0;

    // Calculate time taken
    const orchestrator = ContestOrchestrator.getInstance();
    let timeTaken = 0;
    if (orchestrator) {
      const questionData = orchestrator.getCurrentQuestionData(contestId);
      if (questionData) {
        timeTaken = questionData.question.timeLimit - questionData.remainingTime;
      }
    }

    // Save submission to database
    const submission = await prisma.submission.create({
      data: {
        contestId,
        userId,
        questionId,
        selectedOptionId: selectedOptionId || null,
        isCorrect,
        submittedAt: new Date(submittedAt),
      }
    });

    // Update Redis leaderboard
    const redisKey = `leaderboard:${contestId}`;
    await redis.zincrby(redisKey, pointsEarned, userId);

    // Get current score and rank
    const currentScore = await redis.zscore(redisKey, userId);
    const currentRank = await redis.zrevrank(redisKey, userId);

    console.log(`✅ Submission saved: user=${userId}, question=${questionId}, correct=${isCorrect}, points=${pointsEarned}`);

    return {
      submissionId: submission.id,
      isCorrect,
      pointsEarned,
      timeTaken,
      currentScore: parseInt(currentScore || "0"),
      currentRank: (currentRank ?? 0) + 1, // Redis is 0-indexed
    };
  }

  async hasUserSubmitted(
    userId: string,
    contestId: string,
    questionId: string
  ): Promise<boolean> {
    const submission = await prisma.submission.findFirst({
      where: {
        participantId: userId,
        contestId,
        questionId,
      }
    });
    return !!submission;
  }
}

export class MockLeaderboardService implements LeaderboardService {
  async updateScore(contestId: string, userId: string, score: number): Promise<void> {
    const redisKey = `leaderboard:${contestId}`;
    await redis.zadd(redisKey, score, userId);
  }

  async getTopN(contestId: string, n: number) {
    const redisKey = `leaderboard:${contestId}`;
    const results = await redis.zrevrange(redisKey, 0, n - 1, "WITHSCORES");
    
    const topN: Array<{
      rank: number;
      userId: string;
      userName: string;
      score: number;
      questionsAnswered: number;
    }> = [];

    for (let i = 0; i < results.length; i += 2) {
      const odUserId = results[i];
      const score = parseInt(results[i + 1] || "0");
      
      // Get user name from database
      const user = await prisma.user.findUnique({
        where: { id: odUserId },
        select: { name: true }
      });

      // Count questions answered
      const questionsAnswered = await prisma.submission.count({
        where: { participantId: odUserId, contestId }
      });

      topN.push({
        rank: Math.floor(i / 2) + 1,
        userId: odUserId,
        userName: user?.name || "Unknown",
        score,
        questionsAnswered,
      });
    }

    return topN;
  }

  async getUserRank(contestId: string, userId: string) {
    const redisKey = `leaderboard:${contestId}`;
    
    const rank = await redis.zrevrank(redisKey, userId);
    const score = await redis.zscore(redisKey, userId);
    
    if (rank === null) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true }
    });

    const questionsAnswered = await prisma.submission.count({
      where: { participantId: userId, contestId }
    });

    return {
      rank: rank + 1,
      userId,
      userName: user?.name || "Unknown",
      score: parseInt(score || "0"),
      questionsAnswered,
    };
  }

  async getTotalParticipants(contestId: string): Promise<number> {
    const redisKey = `leaderboard:${contestId}`;
    return await redis.zcard(redisKey);
  }

  async persistLeaderboard(contestId: string): Promise<void> {
    const redisKey = `leaderboard:${contestId}`;
    const results = await redis.zrevrange(redisKey, 0, -1, "WITHSCORES");
    
    // Save to LeaderboardSnapshot table
    for (let i = 0; i < results.length; i += 2) {
      const odUserId = results[i];
      const score = parseInt(results[i + 1] || "0");
      const rank = Math.floor(i / 2) + 1;

      // Check if already exists
      const existing = await prisma.leaderboardSnapshot.findFirst({
        where: { contestId, userId: odUserId }
      });

      if (existing) {
        await prisma.leaderboardSnapshot.update({
          where: { id: existing.id },
          data: { rank, score }
        });
      } else {
        await prisma.leaderboardSnapshot.create({
          data: {
            contestId,
            userId: odUserId,
            rank,
            score,
          }
        });
      }
    }
    
    console.log(` Leaderboard persisted for contest ${contestId}`);
  }
}

export class MockTimerService implements TimerService {
  private timers: Map<string, { endTime: number; duration: number }> = new Map();

  startQuestionTimer(contestId: string, questionId: string, duration: number): void {
    const key = `${contestId}:${questionId}`;
    this.timers.set(key, {
      endTime: Date.now() + duration * 1000,
      duration,
    });
  }

  stopQuestionTimer(contestId: string, questionId: string): void {
    const key = `${contestId}:${questionId}`;
    this.timers.delete(key);
  }

  getRemainingTime(contestId: string, questionId: string): number | null {
    const key = `${contestId}:${questionId}`;
    const timer = this.timers.get(key);
    
    if (!timer) return null;
    
    const remaining = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
    return remaining;
  }
}
