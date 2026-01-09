// WebSocket Event Types based on WEBSOCKET_PROTOCOL.md

// Server → Client Events
export interface ContestStartEvent {
  event: "contest_start";
  data: {
    contestId: string;
    title: string;
    startTime: string;
    totalQuestions: number;
    estimatedDuration: number;
  };
  timestamp: string;
}

export interface QuestionBroadcastEvent {
  event: "question_broadcast";
  data: {
    questionId: string;
    contestQuestionId: string;
    type: "MCQ" | "DSA" | "SANDBOX";
    title: string;
    description: string;
    mcqOptions?: Array<{
      id: string;
      text: string;
    }>;
    timeLimit: number;
    points: number;
    questionNumber: number;
    totalQuestions: number;
    startedAt: string;
  };
  timestamp: string;
}

export interface TimerUpdateEvent {
  event: "timer_update";
  data: {
    questionId: string;
    timeRemaining: number;
    totalTime: number;
  };
  timestamp: string;
}

export interface QuestionChangeEvent {
  event: "question_change";
  data: {
    previousQuestionId: string;
    nextQuestionId: string | null;
    timeUntilNext: number;
    message?: string;
  };
  timestamp: string;
}

export interface SubmissionResultEvent {
  event: "submission_result";
  data: {
    submissionId: string;
    questionId: string;
    isCorrect: boolean;
    pointsEarned: number;
    timeTaken: number;
    submittedAt: string;
    currentScore: number;
    currentRank: number;
  };
  timestamp: string;
}

export interface LeaderboardUpdateEvent {
  event: "leaderboard_update";
  data: {
    contestId: string;
    topN: Array<{
      rank: number;
      userId: string;
      userName: string;
      score: number;
      questionsAnswered: number;
    }>;
    userEntry: {
      rank: number;
      userId: string;
      userName: string;
      score: number;
      questionsAnswered: number;
    } | null;
    totalParticipants: number;
  };
  timestamp: string;
}

export interface ContestEndEvent {
  event: "contest_end";
  data: {
    contestId: string;
    title: string;
    endTime: string;
    finalLeaderboard: Array<{
      rank: number;
      userId: string;
      userName: string;
      score: number;
      questionsAnswered: number;
    }>;
    userFinalRank: {
      rank: number;
      score: number;
      questionsAnswered: number;
    };
    totalParticipants: number;
  };
  timestamp: string;
}

export interface ErrorEvent {
  event: "error";
  data: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PongEvent {
  event: "pong";
  data: Record<string, never>;
  timestamp: string;
}

export type ServerEvent =
  | ContestStartEvent
  | QuestionBroadcastEvent
  | TimerUpdateEvent
  | QuestionChangeEvent
  | SubmissionResultEvent
  | LeaderboardUpdateEvent
  | ContestEndEvent
  | ErrorEvent
  | PongEvent;

// Client → Server Events
export interface JoinContestEvent {
  event: "join_contest";
  data: {
    contestId: string;
  };
}

export interface SubmitAnswerEvent {
  event: "submit_answer";
  data: {
    questionId: string;
    selectedOptionId: string | null;
    submittedAt: string;
  };
}

export interface ResyncEvent {
  event: "resync";
  data: {
    contestId: string;
    lastEventTimestamp?: string | null;
  };
}

export interface PingEvent {
  event: "ping";
  data: Record<string, never>;
}

export type ClientEvent =
  | JoinContestEvent
  | SubmitAnswerEvent
  | ResyncEvent
  | PingEvent;

// WebSocket Client State
export interface AuthenticatedClient {
  userId: string;
  email: string;
  role: string;
  contestId?: string;
}

// Error Codes
export enum WebSocketErrorCode {
  INVALID_EVENT = "INVALID_EVENT",
  CONTEST_NOT_FOUND = "CONTEST_NOT_FOUND",
  CONTEST_NOT_ACTIVE = "CONTEST_NOT_ACTIVE",
  NOT_PARTICIPANT = "NOT_PARTICIPANT",
  ALREADY_SUBMITTED = "ALREADY_SUBMITTED",
  INVALID_QUESTION = "INVALID_QUESTION",
  INVALID_OPTION = "INVALID_OPTION",
  TIME_EXPIRED = "TIME_EXPIRED",
  SERVER_ERROR = "SERVER_ERROR",
}

// WebSocket Close Codes
export enum WebSocketCloseCode {
  NORMAL_CLOSURE = 1000,
  GOING_AWAY = 1001,
  INVALID_TOKEN = 4001,
  USER_NOT_FOUND = 4002,
  SERVER_ERROR = 4003,
}
