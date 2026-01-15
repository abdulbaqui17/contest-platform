import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import type {
  AuthenticatedClient,
  ClientEvent,
  ServerEvent,
} from "./types";
import {
  WebSocketCloseCode,
  WebSocketErrorCode,
} from "./types";
import type {
  ContestService,
  LeaderboardService,
  SubmissionService,
  TimerService,
} from "../services/interfaces";
import { ContestOrchestrator, getRuntimeState } from "../services/contest.orchestrator";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

interface ExtendedWebSocket extends WebSocket {
  client?: AuthenticatedClient;
  isAlive?: boolean;
}

export class ContestWebSocketServer {
  private wss: WebSocketServer;
  private contestRooms: Map<string, Set<ExtendedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private contestService: ContestService,
    private submissionService: SubmissionService,
    private leaderboardService: LeaderboardService,
    private timerService: TimerService
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupHeartbeat();
  }

  handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };

      this.wss.handleUpgrade(request, socket, head, (ws: ExtendedWebSocket) => {
        ws.client = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };
        ws.isAlive = true;
        this.wss.emit("connection", ws, request);
      });
    } catch (error) {
      console.error("JWT verification failed:", error);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  }

  initialize() {
    this.wss.on("connection", (ws: ExtendedWebSocket) => {
      console.log(
        `Client connected: ${ws.client?.userId} (${ws.client?.email})`
      );

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ClientEvent;
          await this.handleClientEvent(ws, message);
        } catch (error) {
          console.error("Error handling message:", error);
          this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Invalid message format");
        }
      });

      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.handleDisconnect(ws);
      });
    });

    console.log("WebSocket server initialized");
  }

  private async handleClientEvent(ws: ExtendedWebSocket, event: ClientEvent) {
    try {
      switch (event.event) {
        case "join_contest":
          await this.handleJoinContest(ws, event.data.contestId);
          break;

        case "submit_answer":
          await this.handleSubmitAnswer(ws, event.data);
          break;

        case "resync":
          await this.handleResync(ws, event.data.contestId);
          break;

        case "ping":
          this.handlePing(ws);
          break;

        default:
          this.sendError(
            ws,
            WebSocketErrorCode.INVALID_EVENT,
            "Unknown event type"
          );
      }
    } catch (error) {
      console.error("Error handling client event:", error);
      this.sendError(
        ws,
        WebSocketErrorCode.SERVER_ERROR,
        "Internal server error"
      );
    }
  }

  private async handleJoinContest(ws: ExtendedWebSocket, contestId: string) {
    if (!ws.client) return;

    try {
      const contest = await this.contestService.getContest(contestId);
      if (!contest) {
        this.sendError(ws, WebSocketErrorCode.CONTEST_NOT_FOUND, "Contest not found");
        ws.close(WebSocketCloseCode.NORMAL_CLOSURE);
        return;
      }

      // CRITICAL: Derive runtime state from timestamps, NOT DB status
      const startAt = new Date(contest.startAt);
      const endAt = new Date(contest.endAt);
      const runtimeState = getRuntimeState(startAt, endAt);

      console.log('🎮 Contest join attempt:', {
        contestId,
        userId: ws.client.userId,
        dbStatus: contest.status,
        runtimeState,
        now: new Date().toISOString(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString()
      });

      // Handle COMPLETED state
      if (runtimeState === "COMPLETED") {
        this.sendContestCompleted(ws, contestId, ws.client.userId);
        return;
      }

      // Validate user is participant OR admin (admins can monitor any contest)
      const isAdmin = ws.client.role === 'ADMIN';
      const isParticipant = await this.contestService.isUserParticipant(
        contestId,
        ws.client.userId
      );
      
      if (!isParticipant && !isAdmin) {
        this.sendError(
          ws,
          WebSocketErrorCode.NOT_PARTICIPANT,
          "User not registered for contest"
        );
        ws.close(WebSocketCloseCode.NORMAL_CLOSURE);
        return;
      }
      
      // Track if this is an admin monitoring (they don't submit, just observe)
      const isMonitoring = isAdmin && !isParticipant;
      if (isMonitoring) {
        console.log(`👁️ Admin ${ws.client.userId} joining contest ${contestId} as monitor`);
      }

      // Handle UPCOMING state - send countdown info
      if (runtimeState === "UPCOMING") {
        const countdownSec = Math.max(0, Math.floor((startAt.getTime() - Date.now()) / 1000));
        
        // Add user to room so they get notified when contest starts
        ws.client.contestId = contestId;
        this.addToRoom(contestId, ws);
        
        // Ensure contest is scheduled to start
        const orchestrator = ContestOrchestrator.getInstance();
        if (orchestrator) {
          orchestrator.scheduleContestStart(contestId, startAt);
        }
        
        // Send contest_start event with upcoming info (reusing existing event type)
        this.sendToClient(ws, {
          event: "contest_start",
          data: {
            contestId,
            contestName: contest.title,
            title: contest.title,
            startTime: startAt.toISOString(),
            countdownToStart: countdownSec,
            totalQuestions: contest.questions?.length || 0,
            estimatedDuration: Math.floor((endAt.getTime() - startAt.getTime()) / 1000),
          },
          timestamp: new Date().toISOString(),
        });
        
        console.log(`⏳ User ${ws.client.userId} joined UPCOMING contest ${contestId}, starts in ${countdownSec}s`);
        return;
      }

      // Handle ACTIVE state
      // Check if user has already completed all questions (skip for admin monitors)
      const isMonitoringAdmin = isAdmin && !isParticipant;
      if (!isMonitoringAdmin) {
        const hasCompleted = await this.hasUserCompletedContest(contestId, ws.client.userId);
        if (hasCompleted) {
          this.sendContestCompleted(ws, contestId, ws.client.userId, true);
          return;
        }
      }

      // CRITICAL: Ensure orchestrator is running for this ACTIVE contest
      const orchestrator = ContestOrchestrator.getInstance();
      if (orchestrator) {
        await orchestrator.ensureContestRunning(contestId);
      }

      ws.client.contestId = contestId;
      this.addToRoom(contestId, ws);

      console.log(`✅ ${isMonitoringAdmin ? 'Admin monitor' : 'User'} ${ws.client.userId} successfully joined ACTIVE contest ${contestId}`);

      await this.sendCurrentStateToUser(ws, contestId);
      
      // CRITICAL: Also send leaderboard update immediately so monitors/late-joiners see current state
      await this.sendLeaderboardUpdate(ws, contestId);
    } catch (error) {
      console.error("Error in join_contest:", error);
      this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Failed to join contest");
    }
  }

  private async sendCurrentStateToUser(ws: ExtendedWebSocket, contestId: string) {
    if (!ws.client) return;

    try {
      const currentQuestion = await this.contestService.getCurrentQuestion(
        contestId,
        ws.client.userId
      );

      if (currentQuestion) {
        console.log(`📤 Sending current question to user: ${ws.client.userId}`, {
          questionNumber: currentQuestion.questionNumber,
          totalQuestions: currentQuestion.totalQuestions
        });

        this.sendToClient(ws, {
          event: "question_broadcast",
          data: currentQuestion,
          timestamp: new Date().toISOString(),
        });

        const timeRemaining = this.timerService.getRemainingTime(
          contestId,
          currentQuestion.questionId
        );

        const contestState = await this.contestService.getContestState(contestId);
        const actualTimeRemaining = timeRemaining ?? contestState.timerRemaining ?? currentQuestion.timeLimit;

        this.sendToClient(ws, {
          event: "timer_update",
          data: {
            questionId: currentQuestion.questionId,
            timeRemaining: actualTimeRemaining,
            totalTime: currentQuestion.timeLimit,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // CRITICAL: This should never happen for an ACTIVE contest
        // If it does, it means orchestrator failed to initialize
        console.error(`❌ No current question for ACTIVE contest ${contestId} - this is a bug!`);
        
        // Try to force-start the orchestrator again
        const orchestrator = ContestOrchestrator.getInstance();
        if (orchestrator) {
          console.log(`🔧 Attempting to recover by restarting orchestrator for ${contestId}`);
          await orchestrator.startContest(contestId);
          
          // Try to get question again
          const retryQuestion = await this.contestService.getCurrentQuestion(contestId, ws.client.userId);
          if (retryQuestion) {
            console.log(`✅ Recovery successful - sending question`);
            this.sendToClient(ws, {
              event: "question_broadcast",
              data: retryQuestion,
              timestamp: new Date().toISOString(),
            });
            this.sendToClient(ws, {
              event: "timer_update",
              data: {
                questionId: retryQuestion.questionId,
                timeRemaining: retryQuestion.timeLimit,
                totalTime: retryQuestion.timeLimit,
              },
              timestamp: new Date().toISOString(),
            });
          } else {
            // Still no question - send error to user
            this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Contest is initializing, please try again");
          }
        }
      }

      await this.sendLeaderboardUpdate(ws, contestId);
    } catch (error) {
      console.error("Error sending current state:", error);
    }
  }

  private async hasUserCompletedContest(contestId: string, userId: string): Promise<boolean> {
    const { prisma } = await import("../../db/prismaClient");
    
    const totalQuestions = await prisma.contestQuestion.count({
      where: { contestId }
    });

    const userSubmissions = await prisma.submission.count({
      where: { contestId, userId }
    });

    return userSubmissions >= totalQuestions && totalQuestions > 0;
  }

  private async sendContestCompleted(ws: ExtendedWebSocket, contestId: string, userId: string, alreadyCompleted: boolean = false) {
    const { prisma } = await import("../../db/prismaClient");
    
    const submissions = await prisma.submission.findMany({
      where: { contestId, userId },
      include: {
        question: {
          include: {
            contests: {
              where: { contestId }
            }
          }
        }
      }
    });

    let totalScore = 0;
    let correctAnswers = 0;
    for (const s of submissions) {
      if (s.isCorrect) {
        correctAnswers++;
        const contestQuestion = s.question.contests[0];
        totalScore += contestQuestion?.points || 10; // Default 10 points
      }
    }

    const leaderboardEntry = await prisma.leaderboardSnapshot.findFirst({
      where: { contestId, userId }
    });

    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    });

    const topPlayers = await this.leaderboardService.getTopN(contestId, 10);
    const totalParticipants = await this.leaderboardService.getTotalParticipants(contestId);
    
    this.sendToClient(ws, {
      event: "contest_end",
      data: {
        contestId,
        title: contest?.title || "",
        endTime: contest?.endAt?.toISOString() || new Date().toISOString(),
        finalLeaderboard: topPlayers,
        userFinalRank: {
          rank: leaderboardEntry?.rank || 0,
          score: totalScore,
          questionsAnswered: submissions.length,
        },
        totalParticipants,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private async handleSubmitAnswer(
    ws: ExtendedWebSocket,
    data: { questionId: string; selectedOptionId: string | null; submittedAt: string }
  ) {
    if (!ws.client || !ws.client.contestId) {
      this.sendError(ws, WebSocketErrorCode.NOT_PARTICIPANT, "Not in a contest");
      return;
    }

    try {
      const hasSubmitted = await this.submissionService.hasUserSubmitted(
        ws.client.userId,
        ws.client.contestId,
        data.questionId
      );

      if (hasSubmitted) {
        this.sendError(
          ws,
          WebSocketErrorCode.ALREADY_SUBMITTED,
          "Already submitted for this question",
          { questionId: data.questionId }
        );
        return;
      }

      const result = await this.submissionService.submitAnswer({
        userId: ws.client.userId,
        contestId: ws.client.contestId,
        questionId: data.questionId,
        selectedOptionId: data.selectedOptionId,
        submittedAt: data.submittedAt,
      });

      this.sendToClient(ws, {
        event: "submission_result",
        data: {
          submissionId: result.submissionId,
          questionId: data.questionId,
          isCorrect: result.isCorrect,
          pointsEarned: result.pointsEarned,
          timeTaken: result.timeTaken,
          submittedAt: data.submittedAt,
          currentScore: result.currentScore,
          currentRank: result.currentRank,
        },
        timestamp: new Date().toISOString(),
      });

      // CRITICAL: Record submission with orchestrator for early advancement
      // If all participants have submitted, this will trigger immediate advancement to next question
      const orchestrator = ContestOrchestrator.getInstance();
      if (orchestrator) {
        orchestrator.recordSubmission(ws.client.contestId, ws.client.userId, data.questionId);
      }

      setTimeout(() => this.broadcastLeaderboardUpdate(ws.client!.contestId!), 100);
    } catch (error: any) {
      console.error("Error in submit_answer:", error);
      
      if (error.message?.includes("expired")) {
        this.sendError(ws, WebSocketErrorCode.TIME_EXPIRED, "Time limit exceeded");
      } else if (error.message?.includes("invalid question")) {
        this.sendError(ws, WebSocketErrorCode.INVALID_QUESTION, "Invalid question");
      } else if (error.message?.includes("invalid option")) {
        this.sendError(ws, WebSocketErrorCode.INVALID_OPTION, "Invalid option");
      } else {
        this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Failed to submit answer");
      }
    }
  }

  private async handleResync(ws: ExtendedWebSocket, contestId: string) {
    if (!ws.client) return;

    try {
      // Get contest to derive runtime state
      const contest = await this.contestService.getContest(contestId);
      if (!contest) {
        this.sendError(ws, WebSocketErrorCode.CONTEST_NOT_FOUND, "Contest not found");
        return;
      }

      // CRITICAL: Derive runtime state from timestamps
      const startAt = new Date(contest.startAt);
      const endAt = new Date(contest.endAt);
      const runtimeState = getRuntimeState(startAt, endAt);

      console.log(`🔄 Resync request from ${ws.client.userId} for contest ${contestId}, runtimeState: ${runtimeState}`);

      if (runtimeState === "COMPLETED") {
        this.sendContestCompleted(ws, contestId, ws.client.userId);
        return;
      }

      if (runtimeState === "UPCOMING") {
        const countdownSec = Math.max(0, Math.floor((startAt.getTime() - Date.now()) / 1000));
        
        // Add to room if not already
        if (!ws.client.contestId) {
          ws.client.contestId = contestId;
          this.addToRoom(contestId, ws);
        }
        
        // Ensure scheduled
        const orchestrator = ContestOrchestrator.getInstance();
        if (orchestrator) {
          orchestrator.scheduleContestStart(contestId, startAt);
        }
        
        // Send contest_start with upcoming info
        this.sendToClient(ws, {
          event: "contest_start",
          data: {
            contestId,
            title: contest.title,
            startTime: startAt.toISOString(),
            totalQuestions: contest.questions?.length || 0,
            estimatedDuration: Math.floor((endAt.getTime() - startAt.getTime()) / 1000),
          },
          timestamp: new Date().toISOString(),
        });
        
        console.log(`⏳ Resync: Contest ${contestId} is UPCOMING, starts in ${countdownSec}s`);
        return;
      }

      // ACTIVE state
      if (!ws.client.contestId) {
        ws.client.contestId = contestId;
        this.addToRoom(contestId, ws);
      }

      // Ensure orchestrator is running
      const orchestrator = ContestOrchestrator.getInstance();
      if (orchestrator) {
        await orchestrator.ensureContestRunning(contestId);
      }

      const hasCompleted = await this.hasUserCompletedContest(contestId, ws.client.userId);
      if (hasCompleted) {
        this.sendContestCompleted(ws, contestId, ws.client.userId, true);
        return;
      }

      await this.sendCurrentStateToUser(ws, contestId);
    } catch (error) {
      console.error("Error in resync:", error);
      this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Failed to resync");
    }
  }

  private handlePing(ws: ExtendedWebSocket) {
    this.sendToClient(ws, {
      event: "pong",
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToContest(contestId: string, event: ServerEvent) {
    const room = this.contestRooms.get(contestId);
    if (!room) return;

    const message = JSON.stringify(event);
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private async broadcastLeaderboardUpdate(contestId: string) {
    try {
      const topN = await this.leaderboardService.getTopN(contestId, 20);
      const totalParticipants = await this.leaderboardService.getTotalParticipants(
        contestId
      );

      const room = this.contestRooms.get(contestId);
      if (!room) return;

      for (const ws of room) {
        if (ws.readyState === WebSocket.OPEN && ws.client) {
          const userEntry = await this.leaderboardService.getUserRank(
            contestId,
            ws.client.userId
          );

          this.sendToClient(ws, {
            event: "leaderboard_update",
            data: {
              contestId,
              topN,
              userEntry,
              totalParticipants,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Error broadcasting leaderboard:", error);
    }
  }

  private async sendLeaderboardUpdate(ws: ExtendedWebSocket, contestId: string) {
    if (!ws.client) return;

    try {
      const topN = await this.leaderboardService.getTopN(contestId, 20);
      const userEntry = await this.leaderboardService.getUserRank(
        contestId,
        ws.client.userId
      );
      const totalParticipants = await this.leaderboardService.getTotalParticipants(
        contestId
      );

      this.sendToClient(ws, {
        event: "leaderboard_update",
        data: {
          contestId,
          topN,
          userEntry,
          totalParticipants,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error sending leaderboard:", error);
    }
  }

  private sendToClient(ws: ExtendedWebSocket, event: ServerEvent) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  private sendError(
    ws: ExtendedWebSocket,
    code: WebSocketErrorCode,
    message: string,
    details?: any
  ) {
    this.sendToClient(ws, {
      event: "error",
      data: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private addToRoom(contestId: string, ws: ExtendedWebSocket) {
    if (!this.contestRooms.has(contestId)) {
      this.contestRooms.set(contestId, new Set());
    }
    this.contestRooms.get(contestId)!.add(ws);
  }

  private removeFromRoom(contestId: string, ws: ExtendedWebSocket) {
    const room = this.contestRooms.get(contestId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.contestRooms.delete(contestId);
      }
    }
  }

  private handleDisconnect(ws: ExtendedWebSocket) {
    if (ws.client?.contestId) {
      this.removeFromRoom(ws.client.contestId, ws);
      console.log(
        `User ${ws.client.userId} disconnected from contest ${ws.client.contestId}`
      );
    }
  }

  private setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const extWs = ws as ExtendedWebSocket;
        
        if (extWs.isAlive === false) {
          return extWs.terminate();
        }

        extWs.isAlive = false;
        extWs.ping();
      });
    }, 30000); // 30 seconds
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }

  getServer() {
    return this.wss;
  }
}
