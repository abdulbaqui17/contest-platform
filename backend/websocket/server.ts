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

  // Handle WebSocket upgrade
  handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
    // Extract token from query parameter
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };

      // Upgrade connection
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

  // Initialize WebSocket server
  initialize() {
    this.wss.on("connection", (ws: ExtendedWebSocket) => {
      console.log(
        `Client connected: ${ws.client?.userId} (${ws.client?.email})`
      );

      // Set up pong handler for heartbeat
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      // Set up message handler
      ws.on("message", async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ClientEvent;
          await this.handleClientEvent(ws, message);
        } catch (error) {
          console.error("Error handling message:", error);
          this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Invalid message format");
        }
      });

      // Set up close handler
      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      // Set up error handler
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.handleDisconnect(ws);
      });
    });

    console.log("WebSocket server initialized");
  }

  // Handle client events
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

  // Handler: join_contest
  private async handleJoinContest(ws: ExtendedWebSocket, contestId: string) {
    if (!ws.client) return;

    try {
      // Validate contest exists
      const contest = await this.contestService.getContest(contestId);
      if (!contest) {
        this.sendError(ws, WebSocketErrorCode.CONTEST_NOT_FOUND, "Contest not found");
        ws.close(WebSocketCloseCode.NORMAL_CLOSURE);
        return;
      }

      // Dynamically determine contest status based on current time
      const now = new Date();
      const startAt = new Date(contest.startAt);
      const endAt = new Date(contest.endAt);
      
      let actualStatus = contest.status;
      if (endAt <= now) {
        actualStatus = "COMPLETED";
      } else if (startAt <= now && endAt > now) {
        actualStatus = "ACTIVE";
      } else if (startAt > now) {
        actualStatus = "UPCOMING";
      }

      console.log('Contest join attempt:', {
        contestId,
        userId: ws.client.userId,
        dbStatus: contest.status,
        calculatedStatus: actualStatus,
        now: now.toISOString(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString()
      });

      // Validate contest is active (based on time, not just DB status)
      if (actualStatus === "COMPLETED") {
        // Send contest completed state
        this.sendContestCompleted(ws, contestId, ws.client.userId);
        return;
      }

      if (actualStatus !== "ACTIVE") {
        this.sendError(
          ws,
          WebSocketErrorCode.CONTEST_NOT_ACTIVE,
          `Contest is ${actualStatus}. Contest starts at ${startAt.toLocaleString()} and ends at ${endAt.toLocaleString()}.`
        );
        ws.close(WebSocketCloseCode.NORMAL_CLOSURE);
        return;
      }

      // Validate user is participant
      const isParticipant = await this.contestService.isUserParticipant(
        contestId,
        ws.client.userId
      );
      if (!isParticipant) {
        this.sendError(
          ws,
          WebSocketErrorCode.NOT_PARTICIPANT,
          "User not registered for contest"
        );
        ws.close(WebSocketCloseCode.NORMAL_CLOSURE);
        return;
      }

      // Check if user has already completed all questions
      const hasCompleted = await this.hasUserCompletedContest(contestId, ws.client.userId);
      if (hasCompleted) {
        this.sendContestCompleted(ws, contestId, ws.client.userId, true);
        return;
      }

      // Add to contest room
      ws.client.contestId = contestId;
      this.addToRoom(contestId, ws);

      console.log(`User ${ws.client.userId} successfully joined contest ${contestId}`);

      // CRITICAL: Send current state to late joiner
      await this.sendCurrentStateToUser(ws, contestId);
    } catch (error) {
      console.error("Error in join_contest:", error);
      this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Failed to join contest");
    }
  }

  // Send current contest state to a user (for late joiners / resync)
  private async sendCurrentStateToUser(ws: ExtendedWebSocket, contestId: string) {
    if (!ws.client) return;

    try {
      // Get current question from orchestrator
      const currentQuestion = await this.contestService.getCurrentQuestion(
        contestId,
        ws.client.userId
      );

      if (currentQuestion) {
        console.log(`📤 Sending current question to late joiner: ${ws.client.userId}`, {
          questionNumber: currentQuestion.questionNumber,
          totalQuestions: currentQuestion.totalQuestions
        });

        // Send question broadcast
        this.sendToClient(ws, {
          event: "question_broadcast",
          data: currentQuestion,
          timestamp: new Date().toISOString(),
        });

        // Get remaining time from timer service
        const timeRemaining = this.timerService.getRemainingTime(
          contestId,
          currentQuestion.questionId
        );

        // If timer service doesn't have it, calculate from orchestrator data
        const contestState = await this.contestService.getContestState(contestId);
        const actualTimeRemaining = timeRemaining ?? contestState.timerRemaining ?? currentQuestion.timeLimit;

        // Send timer update
        this.sendToClient(ws, {
          event: "timer_update",
          data: {
            questionId: currentQuestion.questionId,
            timeRemaining: actualTimeRemaining,
            totalTime: currentQuestion.timeLimit,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Send leaderboard update
      await this.sendLeaderboardUpdate(ws, contestId);
    } catch (error) {
      console.error("Error sending current state:", error);
    }
  }

  // Check if user has completed all questions
  private async hasUserCompletedContest(contestId: string, userId: string): Promise<boolean> {
    // Import prisma for direct query
    const { prisma } = await import("../../db/prismaClient");
    
    const totalQuestions = await prisma.contestQuestion.count({
      where: { contestId }
    });

    const userSubmissions = await prisma.submission.count({
      where: { contestId, userId }
    });

    return userSubmissions >= totalQuestions && totalQuestions > 0;
  }

  // Send contest completed state
  private async sendContestCompleted(ws: ExtendedWebSocket, contestId: string, userId: string, alreadyCompleted: boolean = false) {
    const { prisma } = await import("../../db/prismaClient");
    
    // Get user's submissions with question points
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

    // Calculate score based on correct answers and question points
    let totalScore = 0;
    let correctAnswers = 0;
    for (const s of submissions) {
      if (s.isCorrect) {
        correctAnswers++;
        // Get points from ContestQuestion
        const contestQuestion = s.question.contests[0];
        totalScore += contestQuestion?.points || 10; // Default 10 points
      }
    }

    // Get rank from leaderboard snapshot or calculate
    const leaderboardEntry = await prisma.leaderboardSnapshot.findFirst({
      where: { contestId, userId }
    });

    this.sendToClient(ws, {
      event: "contest_end",
      data: {
        contestId,
        message: alreadyCompleted 
          ? "You have already completed this contest"
          : "Contest has ended",
        userFinalRank: {
          rank: leaderboardEntry?.rank || 0,
          score: totalScore,
          questionsAnswered: submissions.length,
          correctAnswers,
        },
        alreadyCompleted,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handler: submit_answer
  private async handleSubmitAnswer(
    ws: ExtendedWebSocket,
    data: { questionId: string; selectedOptionId: string | null; submittedAt: string }
  ) {
    if (!ws.client || !ws.client.contestId) {
      this.sendError(ws, WebSocketErrorCode.NOT_PARTICIPANT, "Not in a contest");
      return;
    }

    try {
      // Check if already submitted
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

      // Submit answer via service
      const result = await this.submissionService.submitAnswer({
        userId: ws.client.userId,
        contestId: ws.client.contestId,
        questionId: data.questionId,
        selectedOptionId: data.selectedOptionId,
        submittedAt: data.submittedAt,
      });

      // Send submission result to user
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

      // Trigger leaderboard update (will be batched)
      setTimeout(() => this.broadcastLeaderboardUpdate(ws.client!.contestId!), 100);
    } catch (error: any) {
      console.error("Error in submit_answer:", error);
      
      // Map specific errors to error codes
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

  // Handler: resync
  private async handleResync(ws: ExtendedWebSocket, contestId: string) {
    if (!ws.client) return;

    try {
      const contestState = await this.contestService.getContestState(contestId);

      console.log(`🔄 Resync request from ${ws.client.userId} for contest ${contestId}, status: ${contestState.status}`);

      if (contestState.status === "ACTIVE") {
        // Ensure user is in room
        if (!ws.client.contestId) {
          ws.client.contestId = contestId;
          this.addToRoom(contestId, ws);
        }

        // Check if user already completed
        const hasCompleted = await this.hasUserCompletedContest(contestId, ws.client.userId);
        if (hasCompleted) {
          this.sendContestCompleted(ws, contestId, ws.client.userId, true);
          return;
        }

        // Send current state
        await this.sendCurrentStateToUser(ws, contestId);
      } else if (contestState.status === "COMPLETED") {
        // Contest ended, send completion state
        this.sendContestCompleted(ws, contestId, ws.client.userId);
      } else {
        // Contest not started yet
        this.sendToClient(ws, {
          event: "contest_status",
          data: {
            contestId,
            status: contestState.status,
            message: `Contest is ${contestState.status}`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error in resync:", error);
      this.sendError(ws, WebSocketErrorCode.SERVER_ERROR, "Failed to resync");
    }
  }

  // Handler: ping
  private handlePing(ws: ExtendedWebSocket) {
    this.sendToClient(ws, {
      event: "pong",
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast to contest room
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

  // Broadcast leaderboard update
  private async broadcastLeaderboardUpdate(contestId: string) {
    try {
      const topN = await this.leaderboardService.getTopN(contestId, 20);
      const totalParticipants = await this.leaderboardService.getTotalParticipants(
        contestId
      );

      const room = this.contestRooms.get(contestId);
      if (!room) return;

      // Send to each user with their own rank
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

  // Send leaderboard update to single client
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

  // Send to specific client
  private sendToClient(ws: ExtendedWebSocket, event: ServerEvent) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  // Send error to client
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

  // Room management
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

  // Handle disconnect
  private handleDisconnect(ws: ExtendedWebSocket) {
    if (ws.client?.contestId) {
      this.removeFromRoom(ws.client.contestId, ws);
      console.log(
        `User ${ws.client.userId} disconnected from contest ${ws.client.contestId}`
      );
    }
  }

  // Heartbeat mechanism
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

  // Cleanup
  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }

  // Get WebSocket server instance
  getServer() {
    return this.wss;
  }
}
