import { prisma } from "../../db/prismaClient";
import type { LeaderboardService } from "./interfaces";
import { getRuntimeState } from "./contest.orchestrator";

export class PrismaSubmissionService {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  async hasUserSubmitted(
    userId: string,
    contestId: string,
    questionId: string
  ): Promise<boolean> {
    const count = await prisma.submission.count({
      where: {
        userId,
        contestId,
        questionId,
      },
    });
    return count > 0;
  }

  async submitAnswer(data: {
    userId: string;
    contestId: string;
    questionId: string;
    selectedOptionId: string | null;
    submittedAt: string;
  }): Promise<{
    submissionId: string;
    isCorrect: boolean;
    pointsEarned: number;
    timeTaken: number;
    currentScore: number;
    currentRank: number;
  }> {
    // CRITICAL: Validate contest is ACTIVE using runtime state (timestamps), NOT DB status
    const contest = await prisma.contest.findUnique({
      where: { id: data.contestId },
    });

    if (!contest) {
      throw new Error("CONTEST_NOT_FOUND");
    }

    const runtimeState = getRuntimeState(contest.startAt, contest.endAt);
    if (runtimeState !== "ACTIVE") {
      throw new Error(`CONTEST_NOT_ACTIVE: runtime state is ${runtimeState}`);
    }

    // Validate user has joined contest
    const participant = await prisma.contestParticipant.findUnique({
      where: {
        contestId_userId: {
          contestId: data.contestId,
          userId: data.userId,
        },
      },
    });

    if (!participant) {
      throw new Error("NOT_PARTICIPANT");
    }

    // Validate question exists in contest and get details
    const contestQuestion = await prisma.contestQuestion.findFirst({
      where: {
        contestId: data.contestId,
        questionId: data.questionId,
      },
      include: {
        question: {
          include: {
            mcqOptions: true,
          },
        },
      },
    });

    if (!contestQuestion) {
      throw new Error("INVALID_QUESTION");
    }

    // Check if already submitted
    if (await this.hasUserSubmitted(data.userId, data.contestId, data.questionId)) {
      throw new Error("ALREADY_SUBMITTED");
    }

    // Determine correctness
    let isCorrect = false;
    const questionType = contestQuestion.question.type;

    if (questionType === "MCQ") {
      if (data.selectedOptionId) {
        const selectedOption = contestQuestion.question.mcqOptions.find(
          (opt) => opt.id === data.selectedOptionId
        );
        if (selectedOption && selectedOption.isCorrect) {
          isCorrect = true;
        }
      }
    } else {
      // DSA/SANDBOX: not scored yet, mark as incorrect
      isCorrect = false;
    }

    const pointsEarned = isCorrect ? contestQuestion.points : 0;

    // Calculate time taken (placeholder: 0 for now)
    const timeTaken = 0;

    // Persist submission
    const submission = await prisma.submission.create({
      data: {
        userId: data.userId,
        contestId: data.contestId,
        questionId: data.questionId,
        selectedOptionId: data.selectedOptionId,
        isCorrect,
        submittedAt: new Date(data.submittedAt),
      },
    });

    // Calculate current score: sum points from all correct submissions
    const correctSubmissions = await prisma.submission.findMany({
      where: {
        userId: data.userId,
        contestId: data.contestId,
        isCorrect: true,
      },
      include: {
        question: {
          include: {
            contests: {
              where: { contestId: data.contestId },
            },
          },
        },
      },
    });

    const currentScore = correctSubmissions.reduce((sum, sub) => {
      const cq = sub.question.contests[0];
      return sum + (cq ? cq.points : 0);
    }, 0);

    // Update leaderboard
    await this.leaderboardService.updateScore(data.contestId, data.userId, currentScore);

    // Get current rank
    const userRank = await this.leaderboardService.getUserRank(data.contestId, data.userId);
    const currentRank = userRank ? userRank.rank : 0;

    return {
      submissionId: submission.id,
      isCorrect,
      pointsEarned,
      timeTaken,
      currentScore,
      currentRank,
    };
  }
}
