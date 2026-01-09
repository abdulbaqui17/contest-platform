import { prisma } from "../../db/prismaClient";
import type { ContestService, LeaderboardService } from "./interfaces";

interface ContestEventEmitter {
  broadcastToContest(contestId: string, event: any): void;
}

interface ContestState {
  contestId: string;
  questions: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timeLimit: number;
    points: number;
  }>;
  currentQuestionIndex: number;
  timerInterval: NodeJS.Timeout | null;
  questionTimeout: NodeJS.Timeout | null;
}

export class ContestOrchestrator {
  private activeContests: Map<string, ContestState> = new Map();

  constructor(
    private readonly contestService: ContestService,
    private readonly leaderboardService: LeaderboardService,
    private readonly eventEmitter: ContestEventEmitter
  ) {}

  async startContest(contestId: string): Promise<void> {
    if (this.activeContests.has(contestId)) {
      return;
    }

    const contest = await this.contestService.getContest(contestId);
    if (!contest || contest.status !== "ACTIVE") {
      return;
    }

    const questions = await this.getOrderedQuestions(contestId);
    if (questions.length === 0) {
      return;
    }

    const state: ContestState = {
      contestId,
      questions,
      currentQuestionIndex: -1,
      timerInterval: null,
      questionTimeout: null,
    };

    this.activeContests.set(contestId, state);
    this.emitContestStart(contest);
    this.startNextQuestion(state);
  }

  stopContest(contestId: string): void {
    const state = this.activeContests.get(contestId);
    if (!state) {
      return;
    }

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }
    if (state.questionTimeout) {
      clearTimeout(state.questionTimeout);
    }

    this.activeContests.delete(contestId);
  }

  private async getOrderedQuestions(contestId: string) {
    const contestQuestions = await prisma.contestQuestion.findMany({
      where: { contestId },
      include: { question: true },
      orderBy: { orderIndex: "asc" },
    });

    return contestQuestions.map((cq) => ({
      id: cq.questionId,
      type: cq.question.type,
      title: cq.question.title,
      description: cq.question.description,
      timeLimit: cq.timeLimit,
      points: cq.points,
    }));
  }

  private emitContestStart(contest: any): void {
    this.eventEmitter.broadcastToContest(contest.id, {
      event: "contest_start",
      data: {
        contestId: contest.id,
        title: contest.title,
        startTime: contest.startAt.toISOString(),
        totalQuestions: contest.questions?.length || 0,
        estimatedDuration: Math.floor(
          (contest.endAt.getTime() - contest.startAt.getTime()) / 1000
        ),
      },
      timestamp: new Date().toISOString(),
    });
  }

  private startNextQuestion(state: ContestState): void {
    state.currentQuestionIndex++;
    const question = state.questions[state.currentQuestionIndex];

    if (!question) {
      this.endContest(state);
      return;
    }

    this.emitQuestionBroadcast(state.contestId, question, state.currentQuestionIndex + 1);
    this.startQuestionTimer(state, question);
  }

  private emitQuestionBroadcast(
    contestId: string,
    question: any,
    questionNumber: number
  ): void {
    const mcqOptions = question.type === "MCQ"
      ? prisma.mcqOption.findMany({ where: { questionId: question.id } }).then(opts =>
          opts.map(opt => ({ id: opt.id, text: opt.text }))
        )
      : Promise.resolve([]);

    mcqOptions.then(options => {
      this.eventEmitter.broadcastToContest(contestId, {
        event: "question_broadcast",
        data: {
          questionId: question.id,
          contestQuestionId: question.id, // placeholder
          type: question.type,
          title: question.title,
          description: question.description,
          mcqOptions: options,
          timeLimit: question.timeLimit,
          points: question.points,
          questionNumber,
          totalQuestions: this.activeContests.get(contestId)?.questions.length || 0,
          startedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private startQuestionTimer(state: ContestState, question: any): void {
    let timeRemaining = question.timeLimit;

    state.timerInterval = setInterval(() => {
      this.eventEmitter.broadcastToContest(state.contestId, {
        event: "timer_update",
        data: {
          questionId: question.id,
          timeRemaining,
          totalTime: question.timeLimit,
        },
        timestamp: new Date().toISOString(),
      });

      timeRemaining--;
      if (timeRemaining < 0) {
        if (state.timerInterval) {
          clearInterval(state.timerInterval);
          state.timerInterval = null;
        }
      }
    }, 1000);

    state.questionTimeout = setTimeout(() => {
      this.handleQuestionEnd(state);
    }, question.timeLimit * 1000);
  }

  private handleQuestionEnd(state: ContestState): void {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    const currentQuestion = state.questions[state.currentQuestionIndex];
    const nextQuestion = state.questions[state.currentQuestionIndex + 1];

    this.eventEmitter.broadcastToContest(state.contestId, {
      event: "question_change",
      data: {
        previousQuestionId: currentQuestion.id,
        nextQuestionId: nextQuestion ? nextQuestion.id : null,
        timeUntilNext: nextQuestion ? 5 : 0,
        message: nextQuestion ? "Next question in 5 seconds..." : "Contest ending...",
      },
      timestamp: new Date().toISOString(),
    });

    if (nextQuestion) {
      setTimeout(() => this.startNextQuestion(state), 5000);
    } else {
      setTimeout(() => this.endContest(state), 5000);
    }
  }

  private async endContest(state: ContestState): Promise<void> {
    this.eventEmitter.broadcastToContest(state.contestId, {
      event: "contest_end",
      data: {
        contestId: state.contestId,
        title: "", // placeholder
        endTime: new Date().toISOString(),
        finalLeaderboard: [], // placeholder, would need to fetch
        userFinalRank: { rank: 0, score: 0, questionsAnswered: 0 }, // placeholder
        totalParticipants: 0, // placeholder
      },
      timestamp: new Date().toISOString(),
    });

    await this.leaderboardService.persistLeaderboard(state.contestId);
    this.activeContests.delete(state.contestId);
  }
}
