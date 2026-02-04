import { prisma } from "../../db/prismaClient";
import type { ContestService, LeaderboardService } from "./interfaces";

interface ContestEventEmitter {
  broadcastToContest(contestId: string, event: any): void;
}

interface ContestState {
  contestId: string;
  questions: Array<{
    contestQuestionId: string;
    id: string;
    type: string;
    title: string;
    description: string;
    timeLimit: number;
    memoryLimit?: number | null;
    points: number;
  }>;
  currentQuestionIndex: number;
  currentQuestionStartTime: number; // timestamp when current question started
  timerInterval: NodeJS.Timeout | null;
  questionTimeout: NodeJS.Timeout | null;
  // Track submissions for current question to enable early advancement
  submittedUsers: Set<string>;
  totalParticipants: number;
}

// Runtime state type - derived from timestamps, NOT from DB status
export type RuntimeState = "UPCOMING" | "ACTIVE" | "COMPLETED";

// Singleton instance for global access
let orchestratorInstance: ContestOrchestrator | null = null;

// Track scheduled contest starts
const scheduledStarts: Map<string, NodeJS.Timeout> = new Map();

/**
 * CRITICAL: Derive runtime state from timestamps, NOT from DB status.
 * This is the ONLY source of truth for contest state.
 */
export function getRuntimeState(startAt: Date, endAt: Date): RuntimeState {
  const now = new Date();
  if (now < startAt) return "UPCOMING";
  if (now >= startAt && now <= endAt) return "ACTIVE";
  return "COMPLETED";
}

/**
 * Get milliseconds until contest starts (for scheduling)
 */
export function getMillisUntilStart(startAt: Date): number {
  return Math.max(0, startAt.getTime() - Date.now());
}

export class ContestOrchestrator {
  private activeContests: Map<string, ContestState> = new Map();

  constructor(
    private readonly contestService: ContestService,
    private readonly leaderboardService: LeaderboardService,
    private readonly eventEmitter: ContestEventEmitter
  ) {
    orchestratorInstance = this;
  }

  // Static method to get singleton instance
  static getInstance(): ContestOrchestrator | null {
    return orchestratorInstance;
  }

  // Get current question for a contest (for late joiners)
  getCurrentQuestionData(contestId: string): {
    question: any;
    questionNumber: number;
    totalQuestions: number;
    remainingTime: number;
  } | null {
    const state = this.activeContests.get(contestId);
    if (!state || state.currentQuestionIndex < 0) {
      return null;
    }

    const question = state.questions[state.currentQuestionIndex];
    if (!question) {
      return null;
    }

    const elapsed = Math.floor((Date.now() - state.currentQuestionStartTime) / 1000);
    const remainingTime = Math.max(0, question.timeLimit - elapsed);

    return {
      question,
      questionNumber: state.currentQuestionIndex + 1,
      totalQuestions: state.questions.length,
      remainingTime,
    };
  }

  // Check if contest is being orchestrated
  isContestActive(contestId: string): boolean {
    return this.activeContests.has(contestId);
  }

  /**
   * Update participant count when a user joins.
   * Called by WebSocket handler when user successfully joins contest.
   * This ensures early advancement logic works correctly for late joiners.
   */
  updateParticipantCount(contestId: string): void {
    const state = this.activeContests.get(contestId);
    if (!state) {
      return;
    }

    // Recount participants from database
    prisma.contestParticipant.count({
      where: { contestId }
    }).then(count => {
      if (state.totalParticipants !== count) {
        console.log(`👥 Updated participant count for contest ${contestId}: ${state.totalParticipants} → ${count}`);
        state.totalParticipants = count;
      }
    }).catch(err => {
      console.error(`Failed to update participant count for contest ${contestId}:`, err);
    });
  }

  /**
   * CRITICAL: Record a user's submission for the current question.
   * Called by WebSocket handler after successful submission.
   * 
   * If all participants have submitted, immediately advance to next question.
   * This ensures users don't wait unnecessarily for the full timer.
   */
  recordSubmission(contestId: string, userId: string, questionId: string): void {
    const state = this.activeContests.get(contestId);
    if (!state) {
      console.log(`⚠️ recordSubmission: Contest ${contestId} not active`);
      return;
    }

    const currentQuestion = state.questions[state.currentQuestionIndex];
    if (!currentQuestion || currentQuestion.id !== questionId) {
      console.log(`⚠️ recordSubmission: Question ${questionId} is not the current question`);
      return;
    }

    // Record this user's submission
    state.submittedUsers.add(userId);
    
    console.log(`📝 Submission recorded: ${state.submittedUsers.size}/${state.totalParticipants} for question ${state.currentQuestionIndex + 1}`);

    // Check if ALL participants have submitted - if so, advance immediately!
    if (state.submittedUsers.size >= state.totalParticipants && state.totalParticipants > 0) {
      console.log(`🚀 All ${state.totalParticipants} participants submitted! Advancing to next question early.`);
      this.advanceToNextQuestion(state);
    }
  }

  /**
   * Force advance to next question (used when all submit or timer expires)
   */
  private advanceToNextQuestion(state: ContestState): void {
    // Clear existing timers to prevent double-advancement
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (state.questionTimeout) {
      clearTimeout(state.questionTimeout);
      state.questionTimeout = null;
    }

    // Clear submission tracking for next question
    state.submittedUsers.clear();

    // Process question end (broadcasts question_change and moves to next)
    this.handleQuestionEnd(state);
  }

  /**
   * Schedule a contest to start at its startAt time.
   * This ensures UPCOMING contests will automatically start when they become ACTIVE.
   */
  scheduleContestStart(contestId: string, startAt: Date): void {
    // Clear any existing scheduled start
    const existingTimeout = scheduledStarts.get(contestId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const msUntilStart = getMillisUntilStart(startAt);
    
    if (msUntilStart <= 0) {
      // Already should have started, start immediately
      console.log(`⏰ Contest ${contestId} start time passed, starting now`);
      this.startContest(contestId);
      return;
    }

    console.log(`⏰ Scheduling contest ${contestId} to start in ${Math.round(msUntilStart / 1000)}s at ${startAt.toISOString()}`);
    
    const timeout = setTimeout(async () => {
      scheduledStarts.delete(contestId);
      console.log(`⏰ Scheduled start triggered for contest ${contestId}`);
      await this.startContest(contestId);
    }, msUntilStart);

    scheduledStarts.set(contestId, timeout);
  }

  /**
   * CRITICAL: Start contest with proper runtime state validation.
   * Contest MUST only start when runtime state is ACTIVE.
   * If UPCOMING, schedule a delayed start.
   */
  async startContest(contestId: string): Promise<void> {
    if (this.activeContests.has(contestId)) {
      console.log(`Contest ${contestId} is already running`);
      return;
    }

    const contest = await this.contestService.getContest(contestId);
    if (!contest) {
      console.log(`Contest ${contestId} not found`);
      return;
    }

    const startAt = new Date(contest.startAt);
    const endAt = new Date(contest.endAt);
    const runtimeState = getRuntimeState(startAt, endAt);

    console.log(`🔍 Contest ${contestId} runtime state check:`, {
      runtimeState,
      dbStatus: contest.status,
      now: new Date().toISOString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString()
    });

    if (runtimeState === "COMPLETED") {
      console.log(`❌ Contest ${contestId} has already ended`);
      return;
    }

    if (runtimeState === "UPCOMING") {
      // Schedule the contest to start at startAt
      console.log(`⏳ Contest ${contestId} is UPCOMING, scheduling delayed start`);
      this.scheduleContestStart(contestId, startAt);
      return;
    }

    // Runtime state is ACTIVE - proceed to start
    const questions = await this.getOrderedQuestions(contestId);
    if (questions.length === 0) {
      console.log(`❌ Contest ${contestId} has no questions`);
      return;
    }

    // Get total participants for early advancement check
    const participantCount = await prisma.contestParticipant.count({
      where: { contestId }
    });

    const state: ContestState = {
      contestId,
      questions,
      currentQuestionIndex: -1,
      currentQuestionStartTime: 0,
      timerInterval: null,
      questionTimeout: null,
      submittedUsers: new Set(),
      totalParticipants: participantCount,
    };

    this.activeContests.set(contestId, state);
    console.log(`🚀 ContestOrchestrator: Starting contest ${contestId} with ${questions.length} questions, ${participantCount} participants`);
    this.emitContestStart(contest);
    
    // CRITICAL: Immediately start first question - ACTIVE contest MUST have a current question
    await this.startNextQuestion(state);
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
    
    // Clear any scheduled start
    const scheduledTimeout = scheduledStarts.get(contestId);
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout);
      scheduledStarts.delete(contestId);
    }
  }

  /**
   * CRITICAL: Ensure contest is running if it should be ACTIVE.
   * This is called on user join/resync to handle edge cases where
   * orchestrator might not have started the contest yet.
   * 
   * Returns the runtime state for the caller to use.
   */
  async ensureContestRunning(contestId: string): Promise<{
    runtimeState: RuntimeState;
    startAt: Date;
    endAt: Date;
  } | null> {
    const contest = await this.contestService.getContest(contestId);
    if (!contest) {
      return null;
    }

    const startAt = new Date(contest.startAt);
    const endAt = new Date(contest.endAt);
    const runtimeState = getRuntimeState(startAt, endAt);

    // If contest should be ACTIVE but isn't running, start it now
    if (runtimeState === "ACTIVE" && !this.activeContests.has(contestId)) {
      console.log(`⚡ Auto-starting contest ${contestId} - runtime is ACTIVE but orchestrator wasn't running`);
      await this.startContest(contestId);
    }

    // If contest is UPCOMING and not scheduled, schedule it
    if (runtimeState === "UPCOMING" && !scheduledStarts.has(contestId)) {
      console.log(`⏰ Auto-scheduling contest ${contestId} - runtime is UPCOMING`);
      this.scheduleContestStart(contestId, startAt);
    }

    return { runtimeState, startAt, endAt };
  }

  private async getOrderedQuestions(contestId: string) {
    const contestQuestions = await prisma.contestQuestion.findMany({
      where: { contestId },
      include: { question: true },
      orderBy: { orderIndex: "asc" },
    });

    return contestQuestions.map((cq) => ({
      contestQuestionId: cq.id,
      id: cq.questionId,
      type: cq.question.type,
      title: cq.question.title,
      description: cq.question.description,
      timeLimit: cq.timeLimit,
      memoryLimit: cq.question.memoryLimit, // For coding questions
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

  private async startNextQuestion(state: ContestState): Promise<void> {
    state.currentQuestionIndex++;
    const question = state.questions[state.currentQuestionIndex];

    if (!question) {
      await this.endContest(state);
      return;
    }

    // CRITICAL: Reset submission tracking for new question AND check database for existing submissions
    state.submittedUsers.clear();
    
    // CRITICAL FIX: Check database for users who have already submitted this question
    // This handles cases where orchestrator was restarted mid-contest
    try {
      const existingSubmissions = await prisma.submission.findMany({
        where: {
          contestId: state.contestId,
          questionId: question.id,
        },
        select: { userId: true },
      });
      
      existingSubmissions.forEach(s => state.submittedUsers.add(s.userId));
      
      if (existingSubmissions.length > 0) {
        console.log(`📝 Restored ${existingSubmissions.length} existing submissions for question ${state.currentQuestionIndex + 1}`);
        
        // CRITICAL: Check if all participants have already submitted - if so, skip to next question
        if (state.submittedUsers.size >= state.totalParticipants && state.totalParticipants > 0) {
          console.log(`⚡ All participants already submitted question ${state.currentQuestionIndex + 1}. Skipping to next question.`);
          // Recursively advance to next question
          await this.startNextQuestion(state);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check existing submissions:', error);
    }
    
    state.currentQuestionStartTime = Date.now(); // Track when question started
    console.log(`📢 Broadcasting question ${state.currentQuestionIndex + 1}/${state.questions.length} for contest ${state.contestId}`);
    // CRITICAL: Await question broadcast to ensure mcqOptions are loaded
    await this.emitQuestionBroadcast(state.contestId, question, state.currentQuestionIndex + 1);
    this.startQuestionTimer(state, question);
  }

  private async emitQuestionBroadcast(
    contestId: string,
    question: any,
    questionNumber: number
  ): Promise<void> {
    // CRITICAL: Load mcqOptions BEFORE broadcasting (only for MCQ questions)
    const mcqOptions = question.type === "MCQ"
      ? await prisma.mcqOption.findMany({ 
          where: { questionId: question.id },
          select: { id: true, text: true }
        }).then(opts => opts.map(opt => ({ id: opt.id, text: opt.text })))
      : [];

    console.log(`📝 Broadcasting question ${questionNumber} (${question.type}) with ${mcqOptions.length} MCQ options`);
    
    this.eventEmitter.broadcastToContest(contestId, {
      event: "question_broadcast",
      data: {
        questionId: question.id,
        contestQuestionId: question.contestQuestionId,
        type: question.type,
        title: question.title,
        description: question.description,
        mcqOptions: mcqOptions,
        timeLimit: question.timeLimit,
        memoryLimit: question.memoryLimit, // For coding questions
        points: question.points,
        questionNumber,
        totalQuestions: this.activeContests.get(contestId)?.questions.length || 0,
        startedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
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
    // Clear timers (may already be cleared if called from advanceToNextQuestion)
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (state.questionTimeout) {
      clearTimeout(state.questionTimeout);
      state.questionTimeout = null;
    }

    const currentQuestion = state.questions[state.currentQuestionIndex];
    const nextQuestion = state.questions[state.currentQuestionIndex + 1];

    console.log(`⏭️ Question ${state.currentQuestionIndex + 1} ended for contest ${state.contestId}. Next: ${nextQuestion ? 'Question ' + (state.currentQuestionIndex + 2) : 'END'}`);

    this.eventEmitter.broadcastToContest(state.contestId, {
      event: "question_change",
      data: {
        previousQuestionId: currentQuestion.id,
        nextQuestionId: nextQuestion ? nextQuestion.id : null,
        timeUntilNext: nextQuestion ? 2 : 0, // Reduced from 5 to 2 seconds for better UX
        message: nextQuestion ? "Next question in 2 seconds..." : "Contest ending...",
      },
      timestamp: new Date().toISOString(),
    });

    if (nextQuestion) {
      // Reduced delay from 5 seconds to 2 seconds for snappier progression
      setTimeout(async () => await this.startNextQuestion(state), 2000);
    } else {
      setTimeout(async () => await this.endContest(state), 2000);
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
