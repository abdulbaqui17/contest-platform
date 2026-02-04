import axios from 'axios';
import {
  AuthResponse,
  ContestSummary,
  ContestDetail,
  QuestionDetail,
  SigninRequest,
  CreateContestRequest,
  CreateQuestionRequest,
} from '../types';

// Use environment variable for API base URL (configured at build time)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  signin: async (data: SigninRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/signin', data);
    return response.data;
  },

  signup: async (data: { name: string; email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  getMe: async (): Promise<{ id: string; name: string; email: string; role: string; createdAt: string }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Contests API
export const contestsAPI = {
  getAll: async (): Promise<ContestSummary[]> => {
    const response = await api.get('/contests');
    return response.data;
  },

  create: async (data: CreateContestRequest): Promise<ContestSummary> => {
    const response = await api.post('/contests', data);
    return response.data;
  },

  getById: async (id: string): Promise<ContestDetail> => {
    const response = await api.get(`/contest/${id}`);
    return response.data;
  },

  join: async (contestId: string): Promise<{ message: string }> => {
    const response = await api.post(`/contest/${contestId}/join`);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/contests/${id}`);
    return response.data;
  },

  getLeaderboard: async (contestId: string): Promise<{ leaderboard: any[]; totalParticipants: number }> => {
    const response = await api.get(`/contest/${contestId}/leaderboard`);
    return response.data;
  },

  getMyLeaderboardEntry: async (contestId: string): Promise<{
    rank: number;
    userId: string;
    userName: string;
    score: number;
    questionsAnswered: number;
  }> => {
    const response = await api.get(`/contest/leaderboard/${contestId}/me`);
    return response.data;
  },
};

// Questions API
export const questionsAPI = {
  getAll: async (contestId: string): Promise<QuestionDetail[]> => {
    const response = await api.get(`/contests/${contestId}/questions`);
    return response.data;
  },

  create: async (contestId: string, data: CreateQuestionRequest): Promise<QuestionDetail> => {
    const response = await api.post(`/contests/${contestId}/questions`, data);
    return response.data;
  },

  getById: async (questionId: string): Promise<any> => {
    const response = await api.get(`/questions/${questionId}`);
    return response.data;
  },

  // Create standalone question (not tied to contest yet)
  createStandalone: async (data: CreateQuestionRequest): Promise<any> => {
    const response = await api.post('/questions', data);
    return response.data;
  },

  getAllStandalone: async (): Promise<any[]> => {
    const response = await api.get('/questions');
    return response.data;
  },

  // Get test cases for a coding question
  getTestCases: async (questionId: string): Promise<{
    questionId: string;
    timeLimit: number | null;
    memoryLimit: number | null;
    testCases: Array<{
      id: string;
      input: string;
      expectedOutput: string;
      isHidden: boolean;
      order: number;
    }>;
  }> => {
    const response = await api.get(`/questions/${questionId}/testcases`);
    return response.data;
  },
};

// Submissions API (for coding challenges)
export const submissionsAPI = {
  // Submit code for full evaluation
  submitCode: async (
    questionId: string,
    contestId: string,
    code: string,
    language: string
  ): Promise<{
    submissionId: string;
    status: string;
    isCorrect: boolean;
    points: number;
    currentScore?: number;
    currentRank?: number;
    testCasesPassed: number;
    totalTestCases: number;
    executionTime?: number;
    memoryUsed?: number;
    runtime?: number;
    memory?: number;
    compilationError?: string;
    testCaseResults?: Array<{
      testCaseId: string;
      passed: boolean;
      input: string;
      expectedOutput: string;
      actualOutput: string;
      executionTime: number;
      memoryUsed: number;
      error?: string;
      isHidden: boolean;
    }>;
    results?: Array<{
      testCase: number;
      input: string;
      expected: string;
      actual: string;
      passed: boolean;
      time: number;
      memory: number;
    }>;
  }> => {
    const response = await api.post('/submissions/code', {
      questionId,
      contestId,
      code,
      language,
    });
    return response.data;
  },

  // Run code against sample test cases (without saving submission)
  runCode: async (
    questionId: string,
    code: string,
    language: string,
    customInput?: string
  ): Promise<{
    status: string;
    passed?: number;
    total?: number;
    results: Array<{
      testCaseId?: string;
      passed: boolean;
      input: string;
      expectedOutput: string;
      actualOutput: string;
      executionTime: number;
      memoryUsed: number;
      error?: string;
    }>;
    compilationError?: string;
  }> => {
    const response = await api.post('/submissions/run', {
      questionId,
      code,
      language,
      customInput,
    });
    return response.data;
  },

  // Get submission by ID
  getSubmission: async (submissionId: string): Promise<any> => {
    const response = await api.get(`/submissions/${submissionId}`);
    return response.data;
  },

  // Get user's submissions for a question in a contest
  getSubmissions: async (questionId: string, contestId: string): Promise<any[]> => {
    const response = await api.get(`/submissions/question/${questionId}/contest/${contestId}`);
    return response.data;
  },

  // Get supported languages
  getSupportedLanguages: async (): Promise<{ id: string; name: string }[]> => {
    const response = await api.get('/submissions/languages');
    return response.data;
  },

  // Submit code for practice (non-contest)
  submitPractice: async (
    code: string,
    language: string,
    questionId: string
  ): Promise<{
    submissionId: string;
    status: string;
    isAccepted: boolean;
    testCasesPassed: number;
    totalTestCases: number;
    runtime: number;
    memory: number;
    compilationError?: string;
    runtimeError?: string;
    results: Array<{
      testCase: number;
      input: string;
      expected: string;
      actual: string;
      passed: boolean;
      time: number;
      memory: number;
      error?: string;
    }>;
    hiddenTestsPassed: number;
    hiddenTestsTotal: number;
  }> => {
    const response = await api.post('/submissions/practice', {
      code,
      language,
      questionId,
    });
    return response.data;
  },

  // Submit code for contest
  submitContest: async (
    code: string,
    language: string,
    questionId: string,
    contestId: string
  ): Promise<{
    submissionId: string;
    status: string;
    isCorrect: boolean;
    points: number;
    testCasesPassed: number;
    totalTestCases: number;
    runtime?: number;
    memory?: number;
    executionTime?: number;
    memoryUsed?: number;
    compilationError?: string;
    results: Array<{
      testCase: number;
      input: string;
      expected: string;
      actual: string;
      passed: boolean;
      time: number;
      memory: number;
    }>;
  }> => {
    const response = await api.post('/submissions/contest', {
      code,
      language,
      questionId,
      contestId,
    });
    return response.data;
  },

  // Get submission history
  getHistory: async (questionId?: string, limit = 20, offset = 0): Promise<{
    submissions: Array<{
      id: string;
      type: 'practice' | 'contest';
      contest?: { id: string; title: string };
      question: { id: string; title: string; difficulty: string };
      language: string;
      status: string;
      isCorrect?: boolean;
      runtime: number | null;
      memory: number | null;
      testCasesPassed: number | null;
      totalTestCases: number | null;
      submittedAt: string;
    }>;
    total: number;
  }> => {
    const params = new URLSearchParams();
    if (questionId) params.append('questionId', questionId);
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    
    const response = await api.get(`/submissions?${params}`);
    return response.data;
  },
};

// User Stats API
export const userStatsAPI = {
  getMyStats: async (): Promise<{
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    totalAttempted: number;
    totalSubmissions: number;
    acceptedCount: number;
    acceptanceRate: number;
    contestsParticipated: number;
    bestContestRank: number | null;
    totalContestScore: number;
    currentStreak: number;
    maxStreak: number;
    lastActiveAt: string;
    recentSubmissions: Array<{
      id: string;
      question: { id: string; title: string; difficulty: string };
      language: string;
      status: string;
      runtime: number;
      submittedAt: string;
    }>;
    solvedProblems: Array<{
      questionId: string;
      title: string;
      difficulty: string;
      solvedAt: string;
      bestRuntime?: number;
      bestMemory?: number;
      language?: string;
    }>;
    languageDistribution: Array<{
      language: string;
      count: number;
    }>;
  }> => {
    const response = await api.get('/users/stats');
    return response.data;
  },

  getUserStats: async (userId: string): Promise<{
    user: { id: string; name: string; joinedAt: string };
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    totalSubmissions: number;
    acceptanceRate: number;
    contestsParticipated: number;
    bestContestRank: number | null;
    currentStreak: number;
    maxStreak: number;
  }> => {
    const response = await api.get(`/users/stats/${userId}`);
    return response.data;
  },

  getProfile: async (): Promise<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    stats: {
      totalSolved: number;
      easySolved: number;
      mediumSolved: number;
      hardSolved: number;
      totalSubmissions: number;
      acceptanceRate: number;
      currentStreak: number;
      maxStreak: number;
    };
  }> => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  getLeaderboard: async (limit = 50): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      name: string;
      totalSolved: number;
      easySolved: number;
      mediumSolved: number;
      hardSolved: number;
      acceptanceRate: number;
      currentStreak: number;
    }>;
  }> => {
    const response = await api.get(`/users/leaderboard?limit=${limit}`);
    return response.data;
  },
};

// Editorial API
export const editorialAPI = {
  getEditorial: async (questionId: string): Promise<{
    questionId: string;
    questionTitle: string;
    approach: string;
    timeComplexity: string;
    spaceComplexity: string;
    solutionCode: Record<string, string>;
    hints: string[];
    videoUrl?: string;
  }> => {
    const response = await api.get(`/editorials/${questionId}`);
    return response.data;
  },

  getHints: async (questionId: string, revealed = 0): Promise<{
    questionId: string;
    hints: string[];
    totalHints: number;
    revealedCount: number;
    hasMore: boolean;
    nextHintIndex: number | null;
  }> => {
    const response = await api.get(`/editorials/${questionId}/hints?revealed=${revealed}`);
    return response.data;
  },

  createEditorial: async (questionId: string, data: {
    approach: string;
    timeComplexity: string;
    spaceComplexity: string;
    solutionCode?: Record<string, string>;
    hints?: string[];
    videoUrl?: string;
  }): Promise<{ message: string; editorial: any }> => {
    const response = await api.post(`/editorials/${questionId}`, data);
    return response.data;
  },
};
