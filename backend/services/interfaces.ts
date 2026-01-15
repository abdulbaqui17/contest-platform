// Service layer interfaces for WebSocket handlers
// These will be implemented later with actual business logic

export interface ContestService {
  getContest(contestId: string): Promise<{
    id: string;
    title: string;
    status: string;
    startAt: Date;
    endAt: Date;
    questions?: Array<{ id: string }>;  // For counting total questions
  } | null>;

  isUserParticipant(contestId: string, userId: string): Promise<boolean>;

  getCurrentQuestion(contestId: string, userId: string): Promise<{
    questionId: string;
    contestQuestionId: string;
    type: "MCQ" | "DSA" | "SANDBOX";
    title: string;
    description: string;
    mcqOptions?: Array<{ id: string; text: string }>;
    timeLimit: number;
    points: number;
    questionNumber: number;
    totalQuestions: number;
    startedAt: string;
  } | null>;

  getContestState(contestId: string): Promise<{
    status: string;
    currentQuestion?: any;
    timerRemaining?: number;
  }>;
}

export interface SubmissionService {
  submitAnswer(data: {
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
  }>;

  hasUserSubmitted(
    userId: string,
    contestId: string,
    questionId: string
  ): Promise<boolean>;
}

export interface LeaderboardService {
  updateScore(contestId: string, userId: string, score: number): Promise<void>;

  getTopN(contestId: string, n: number): Promise<
    Array<{
      rank: number;
      userId: string;
      userName: string;
      score: number;
      questionsAnswered: number;
    }>
  >;

  getUserRank(contestId: string, userId: string): Promise<{
    rank: number;
    userId: string;
    userName: string;
    score: number;
    questionsAnswered: number;
  } | null>;

  getTotalParticipants(contestId: string): Promise<number>;

  persistLeaderboard(contestId: string): Promise<void>;
}

export interface TimerService {
  startQuestionTimer(
    contestId: string,
    questionId: string,
    duration: number
  ): void;

  stopQuestionTimer(contestId: string, questionId: string): void;

  getRemainingTime(contestId: string, questionId: string): number | null;
}
