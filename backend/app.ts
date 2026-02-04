import express from "express";
import cors from "cors";
import authRoutes from "./auth";
import contestRoutes from "./contests";
import questionRoutes from "./questions";
import submissionRoutes from "./submissions";
import userStatsRoutes from "./users";
import editorialRoutes from "./editorials";

const app = express();

// Enable CORS for all origins in development (configure for production)
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/contests", contestRoutes);
app.use("/contest", contestRoutes);
app.use("/questions", questionRoutes);
app.use("/submissions", submissionRoutes);
app.use("/users", userStatsRoutes);
app.use("/editorials", editorialRoutes);

// Health check endpoint for Docker
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
