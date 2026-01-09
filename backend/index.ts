import "dotenv/config";
import express from "express";
import { createServer } from "http";
import authRoutes from "./auth";
import contestRoutes from "./contests";
import { ContestWebSocketServer } from "./websocket/server";
import {
  MockContestService,
  MockSubmissionService,
  MockTimerService,
} from "./services/mocks";
import { RedisLeaderboardService } from "./services/leaderboard.service";
import { redis } from "./redis";

const app = express();
const server = createServer(app);

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/contests", contestRoutes);
app.use("/contest", contestRoutes);
app.use("/leaderboard", contestRoutes);

// Initialize services
const contestService = new MockContestService();
const submissionService = new MockSubmissionService();
const leaderboardService = new RedisLeaderboardService(redis);
const timerService = new MockTimerService();

const wsServer = new ContestWebSocketServer(
  contestService,
  submissionService,
  leaderboardService,
  timerService
);

wsServer.initialize();

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