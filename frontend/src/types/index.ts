// Shared types based on backend schemas
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface ContestSummary {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  status: 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
}

export interface Question {
  id: string;
  title: string;
  orderIndex: number;
  points: number;
  timeLimit: number;
}

export interface ContestDetail extends ContestSummary {
  questions: Question[];
}

export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionDetail {
  id: string;
  type: 'MCQ' | 'CODING' | 'DSA' | 'SANDBOX';
  title: string;
  description: string;
  options?: MCQOption[];
  testCases?: Array<{
    id: string;
    input: string;
    expectedOutput: string;
    isHidden: boolean;
    order: number;
  }>;
  points?: number;
  timeLimit?: number;
  memoryLimit?: number | null;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  functionName?: string | null;
}

// WebSocket events for admin monitoring
export interface ContestStartEvent {
  event: 'contest_start';
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
  event: 'question_broadcast';
  data: {
    questionId: string;
    contestQuestionId: string;
    type: 'MCQ' | 'CODING' | 'DSA' | 'SANDBOX';
    title: string;
    description: string;
    mcqOptions?: Array<{
      id: string;
      text: string;
    }>;
    timeLimit: number;
    memoryLimit?: number | null;
    points: number;
    questionNumber: number;
    totalQuestions: number;
    startedAt: string;
  };
  timestamp: string;
}

export interface TimerUpdateEvent {
  event: 'timer_update';
  data: {
    questionId: string;
    timeRemaining: number;
    totalTime: number;
  };
  timestamp: string;
}

export interface LeaderboardUpdateEvent {
  event: 'leaderboard_update';
  data: {
    contestId: string;
    topN: Array<{
      rank: number;
      userId: string;
      userName: string;
      score: number;
      questionsAnswered: number;
    }>;
    userEntry: null; // Admin doesn't have entry
    totalParticipants: number;
  };
  timestamp: string;
}

export interface ContestEndEvent {
  event: 'contest_end';
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
    userFinalRank: null; // Admin doesn't have rank
    totalParticipants: number;
  };
  timestamp: string;
}

export type WebSocketEvent =
  | ContestStartEvent
  | QuestionBroadcastEvent
  | TimerUpdateEvent
  | LeaderboardUpdateEvent
  | ContestEndEvent;

// API request types
export interface SigninRequest {
  email: string;
  password: string;
}

export interface CreateContestRequest {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  questions?: Array<{
    id: string;
    points: number;
    timeLimit: number;
  }>;
}

export interface CreateQuestionRequest {
  type: 'MCQ' | 'CODING' | 'DSA' | 'SANDBOX';
  title: string;
  description: string;
  options?: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
    order?: number;
  }>;
  points?: number;
  timeLimit?: number;
  memoryLimit?: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  functionName?: string;
  starterCode?: Record<string, string>;
  tags?: string[];
}
