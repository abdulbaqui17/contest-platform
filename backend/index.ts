import "dotenv/config";
import express from "express";
import { createServer } from "http";
import authRoutes from "./auth";
import contestRoutes from "./contests";
import { ContestWebSocketServer } from "./websocket/server";
import {
  MockContestService,
  MockTimerService,
} from "./services/mocks";
import { RedisLeaderboardService } from "./services/leaderboard.service";
import { PrismaSubmissionService } from "./services/submission.service";
import { ContestOrchestrator } from "./services/contest.orchestrator";
import { redis } from "./redis";
import { prisma } from "../db/prismaClient";

const app = express();
const server = createServer(app);

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/contests", contestRoutes);
app.use("/contest", contestRoutes);
app.use("/leaderboard", contestRoutes);

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

// Handle WebSocket upgrade requests
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`)
    .pathname;

  if (pathname === "/ws/contest") {
    wsServer.handleUpgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
  console.log("WebSocket server available at ws://localhost:3000/ws/contest");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  wsServer.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});