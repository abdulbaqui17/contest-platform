import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { prisma } from "../../db/prismaClient";
import { RedisLeaderboardService } from "../services/leaderboard.service";
import { redis } from "../redis";

interface PublicClient extends WebSocket {
  isAlive?: boolean;
  subscriptions?: {
    contests: boolean;
    leaderboards: Set<string>;
  };
}

let publicWsInstance: PublicWebSocketServer | null = null;

export function getPublicWs(): PublicWebSocketServer | null {
  return publicWsInstance;
}

export class PublicWebSocketServer {
  private wss: WebSocketServer;
  private contestSubscribers = new Set<PublicClient>();
  private leaderboardSubscribers: Map<string, Set<PublicClient>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map();
  private leaderboardService = new RedisLeaderboardService(redis);

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    publicWsInstance = this;
    this.setupHeartbeat();
  }

  handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
    this.wss.handleUpgrade(request, socket, head, (ws: PublicClient) => {
      ws.isAlive = true;
      ws.subscriptions = { contests: false, leaderboards: new Set() };
      this.wss.emit("connection", ws, request);
    });
  }

  initialize() {
    this.wss.on("connection", (ws: PublicClient) => {
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientEvent(ws, message);
        } catch (error) {
          console.error("Public WS message error:", error);
        }
      });

      ws.on("close", () => {
        this.removeClient(ws);
      });

      ws.on("error", () => {
        this.removeClient(ws);
      });
    });

    console.log("Public WebSocket server initialized");
  }

  private async handleClientEvent(ws: PublicClient, event: any) {
    switch (event.event) {
      case "subscribe_contests":
        ws.subscriptions!.contests = true;
        this.contestSubscribers.add(ws);
        await this.sendContestsUpdate(ws);
        break;
      case "unsubscribe_contests":
        ws.subscriptions!.contests = false;
        this.contestSubscribers.delete(ws);
        break;
      case "subscribe_leaderboard": {
        const contestId = event.data?.contestId;
        if (!contestId) return;
        if (!this.leaderboardSubscribers.has(contestId)) {
          this.leaderboardSubscribers.set(contestId, new Set());
        }
        this.leaderboardSubscribers.get(contestId)!.add(ws);
        ws.subscriptions!.leaderboards.add(contestId);
        await this.sendLeaderboardUpdate(ws, contestId);
        break;
      }
      case "unsubscribe_leaderboard": {
        const contestId = event.data?.contestId;
        if (!contestId) return;
        this.leaderboardSubscribers.get(contestId)?.delete(ws);
        ws.subscriptions!.leaderboards.delete(contestId);
        break;
      }
      case "ping":
        ws.send(JSON.stringify({ event: "pong", data: {}, timestamp: new Date().toISOString() }));
        break;
      default:
        break;
    }
  }

  async broadcastContestsUpdate() {
    const snapshot = await this.getContestsSnapshot();
    const message = JSON.stringify({
      event: "contests_update",
      data: { contests: snapshot },
      timestamp: new Date().toISOString(),
    });

    this.contestSubscribers.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  async broadcastLeaderboardUpdate(contestId: string) {
    const subscribers = this.leaderboardSubscribers.get(contestId);
    if (!subscribers || subscribers.size === 0) return;

    const topN = await this.leaderboardService.getTopN(contestId, 20);
    const totalParticipants = await this.leaderboardService.getTotalParticipants(contestId);

    const message = JSON.stringify({
      event: "leaderboard_update",
      data: { contestId, topN, totalParticipants },
      timestamp: new Date().toISOString(),
    });

    subscribers.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  scheduleContest(contestId: string, startAt: Date, endAt: Date) {
    const now = Date.now();

    const schedule = (time: Date, keySuffix: "start" | "end") => {
      const key = `${contestId}:${keySuffix}`;
      const existing = this.scheduledTimers.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      const delay = time.getTime() - now;
      if (delay <= 0) {
        return;
      }
      const timeout = setTimeout(async () => {
        this.scheduledTimers.delete(key);
        await this.broadcastContestsUpdate();
      }, delay);
      this.scheduledTimers.set(key, timeout);
    };

    schedule(startAt, "start");
    schedule(endAt, "end");
  }

  unscheduleContest(contestId: string) {
    ["start", "end"].forEach((suffix) => {
      const key = `${contestId}:${suffix}`;
      const existing = this.scheduledTimers.get(key);
      if (existing) {
        clearTimeout(existing);
        this.scheduledTimers.delete(key);
      }
    });
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.scheduledTimers.forEach((timeout) => clearTimeout(timeout));
    this.scheduledTimers.clear();
    this.wss.close();
  }

  private async sendContestsUpdate(ws: PublicClient) {
    const snapshot = await this.getContestsSnapshot();
    ws.send(
      JSON.stringify({
        event: "contests_update",
        data: { contests: snapshot },
        timestamp: new Date().toISOString(),
      })
    );
  }

  private async sendLeaderboardUpdate(ws: PublicClient, contestId: string) {
    const topN = await this.leaderboardService.getTopN(contestId, 20);
    const totalParticipants = await this.leaderboardService.getTotalParticipants(contestId);
    ws.send(
      JSON.stringify({
        event: "leaderboard_update",
        data: { contestId, topN, totalParticipants },
        timestamp: new Date().toISOString(),
      })
    );
  }

  private removeClient(ws: PublicClient) {
    this.contestSubscribers.delete(ws);
    ws.subscriptions?.leaderboards.forEach((contestId) => {
      this.leaderboardSubscribers.get(contestId)?.delete(ws);
    });
  }

  private async getContestsSnapshot() {
    const contests = await prisma.contest.findMany({
      orderBy: { startAt: "desc" },
    });

    const now = new Date();
    return contests.map((contest) => {
      const start = new Date(contest.startAt);
      const end = new Date(contest.endAt);

      let status = contest.status;
      if (end <= now) {
        status = "COMPLETED";
      } else if (start <= now && end > now) {
        status = "ACTIVE";
      } else if (start > now) {
        status = "UPCOMING";
      }

      return { ...contest, status };
    });
  }

  private setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = ws as PublicClient;
        if (client.isAlive === false) {
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);
  }
}
