import "dotenv/config";
import express from "express";
import authRoutes from "./auth";
import contestRoutes from "./contests";

const app = express();

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/contests", contestRoutes);
app.use("/contest", contestRoutes);
app.use("/leaderboard", contestRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});