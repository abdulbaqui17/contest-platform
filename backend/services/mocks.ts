import { prisma } from "../../db/prismaClient";
import type {
  ContestService,
  LeaderboardService,
  SubmissionService,
  TimerService,
} from "./interfaces";

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
    // TODO: Implement with Prisma
    return null;
  }

  async getContestState(contestId: string) {
    // TODO: Implement with Prisma
    return {
      status: "ACTIVE",
      currentQuestion: null,
      timerRemaining: 0,
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
    // TODO: Implement with Prisma + validation logic
    return {
      submissionId: "mock-submission-id",
      isCorrect: false,
      pointsEarned: 0,
      timeTaken: 0,
      currentScore: 0,
      currentRank: 0,
    };
  }

  async hasUserSubmitted(
    userId: string,
    contestId: string,
    questionId: string
  ): Promise<boolean> {
    // TODO: Implement with Prisma
    return false;
  }
}

export class MockLeaderboardService implements LeaderboardService {
  async updateScore(contestId: string, userId: string, score: number): Promise<void> {
    // TODO: Implement with Redis ZADD
  }

  async getTopN(contestId: string, n: number) {
    // TODO: Implement with Redis ZREVRANGE
    return [];
  }

  async getUserRank(contestId: string, userId: string) {
    // TODO: Implement with Redis ZREVRANK
    return null;
  }

  async getTotalParticipants(contestId: string): Promise<number> {
    // TODO: Implement with Redis ZCARD
    return 0;
  }

  async persistLeaderboard(contestId: string): Promise<void> {
    // TODO: Implement - read from Redis, write to Prisma
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
