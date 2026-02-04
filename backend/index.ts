import "dotenv/config";
import { createServer } from "http";
import app from "./app";
import { ContestWebSocketServer } from "./websocket/server";
import { PublicWebSocketServer } from "./websocket/public";
import {
  MockContestService,
  MockTimerService,
} from "./services/mocks";
import { RedisLeaderboardService } from "./services/leaderboard.service";
import { PrismaSubmissionService } from "./services/submission.service";
import { ContestOrchestrator } from "./services/contest.orchestrator";
import { redis } from "./redis";
import { prisma } from "../db/prismaClient";

const server = createServer(app);

// Initialize services
const contestService = new MockContestService();
const leaderboardService = new RedisLeaderboardService(redis);
const submissionService = new PrismaSubmissionService(leaderboardService);
const timerService = new MockTimerService();

const wsServer = new ContestWebSocketServer(
  contestService,
  submissionService,
  leaderboardService,
  timerService
);

wsServer.initialize();

const publicWsServer = new PublicWebSocketServer();
publicWsServer.initialize();

// Initialize ContestOrchestrator
const orchestrator = new ContestOrchestrator(
  contestService,
  leaderboardService,
  wsServer
);

// Auto-start ACTIVE contests on server boot
(async () => {
  const activeContests = await prisma.contest.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  
  for (const contest of activeContests) {
    await orchestrator.startContest(contest.id);
    console.log(`Started active contest: ${contest.id}`);
  }
})();

// Schedule contest status broadcasts for public subscribers
(async () => {
  const contests = await prisma.contest.findMany({
    select: { id: true, startAt: true, endAt: true },
  });
  contests.forEach((contest) => {
    publicWsServer.scheduleContest(contest.id, contest.startAt, contest.endAt);
  });
})();

// Handle WebSocket upgrade requests
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`)
    .pathname;

  if (pathname === "/ws/contest") {
    wsServer.handleUpgrade(request, socket, head);
  } else if (pathname === "/ws/public") {
    publicWsServer.handleUpgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});

const port = Number(process.env.PORT || process.env.BACKEND_PORT || 3000);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`WebSocket server available at ws://localhost:${port}/ws/contest`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  wsServer.close();
  publicWsServer.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
