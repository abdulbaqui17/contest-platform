import "dotenv/config";
import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import request from "supertest";
import app from "../app";
import { prisma } from "../../db/prismaClient";

describe("API smoke tests", () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    // Clean database
    await prisma.leaderboardSnapshot.deleteMany();
    await prisma.submission.deleteMany();
    await prisma.practiceSubmission.deleteMany();
    await prisma.contestParticipant.deleteMany();
    await prisma.contestQuestion.deleteMany();
    await prisma.mcqOption.deleteMany();
    await prisma.testCase.deleteMany();
    await prisma.contest.deleteMany();
    await prisma.question.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("signs up and signs in", async () => {
    const signup = await request(app)
      .post("/auth/signup")
      .send({
        name: "Test User",
        email: "testuser@example.com",
        password: "password123",
      })
      .expect(201);

    expect(signup.body.user.email).toBe("testuser@example.com");
    userId = signup.body.user.id;

    const signin = await request(app)
      .post("/auth/signin")
      .send({ email: "testuser@example.com", password: "password123" })
      .expect(200);

    expect(signin.body.token).toBeTruthy();
    token = signin.body.token;
  });

  it("creates MCQ question, contest, joins, and submits answer", async () => {
    const questionRes = await request(app)
      .post("/questions")
      .send({
        type: "MCQ",
        title: "2 + 2",
        description: "Basic arithmetic",
        options: [
          { text: "3", isCorrect: false },
          { text: "4", isCorrect: true },
        ],
      })
      .expect(201);

    const questionId = questionRes.body.id as string;
    const correctOption = questionRes.body.mcqOptions.find((o: any) => o.isCorrect);

    const now = new Date();
    const contestRes = await request(app)
      .post("/contests")
      .send({
        title: "Test Contest",
        description: "Test",
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        questions: [
          { id: questionId, points: 50, timeLimit: 60 },
        ],
      })
      .expect(201);

    const contestId = contestRes.body.id as string;

    await request(app)
      .post(`/contest/${contestId}/join`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const currentQuestion = await request(app)
      .get(`/contest/${contestId}/current-question`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(currentQuestion.body.questionId).toBe(questionId);

    const submitRes = await request(app)
      .post(`/contest/${contestId}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId,
        selectedOptionId: correctOption.id,
      })
      .expect(200);

    expect(submitRes.body.isCorrect).toBe(true);
    expect(submitRes.body.pointsEarned).toBe(50);
  });

  it(
    "runs and submits coding question in practice mode",
    async () => {
      const codingRes = await request(app)
        .post("/questions")
      .send({
        type: "CODING",
        title: "Two Sum",
        description: "Return indices of two numbers",
        functionName: "solution",
        timeLimit: 2000,
        memoryLimit: 256,
        testCases: [
          { input: "[[2,7,11,15],9]", expectedOutput: "[0,1]", isHidden: false, order: 0 },
          { input: "[[3,2,4],6]", expectedOutput: "[1,2]", isHidden: true, order: 1 },
        ],
      })
      .expect(201);

    const codingQuestionId = codingRes.body.id as string;

    const code = `function solution(nums, target) { return [0,1]; }`;

    const runRes = await request(app)
      .post("/submissions/run")
      .send({
        questionId: codingQuestionId,
        code,
        language: "javascript",
      })
      .expect(200);

    expect(runRes.body.status).toBeDefined();
    expect(Array.isArray(runRes.body.results)).toBe(true);

    const submitRes = await request(app)
      .post("/submissions/practice")
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: codingQuestionId,
        code,
        language: "javascript",
      })
      .expect(200);

    expect(submitRes.body.status).toBeDefined();
    expect(submitRes.body.submissionId).toBeTruthy();
    },
    { timeout: 40000 }
  );

  it(
    "supports DSA and SANDBOX questions with test cases",
    async () => {
      const dsaRes = await request(app)
        .post("/questions")
      .send({
        type: "DSA",
        title: "DSA Two Sum",
        description: "Return indices",
        functionName: "solution",
        timeLimit: 2000,
        memoryLimit: 256,
        testCases: [
          { input: "[[2,7,11,15],9]", expectedOutput: "[0,1]", isHidden: false, order: 0 },
        ],
      })
      .expect(201);

    const dsaQuestionId = dsaRes.body.id as string;
    const dsaRun = await request(app)
      .post("/submissions/run")
      .send({
        questionId: dsaQuestionId,
        code: "function solution(nums, target) { return [0,1]; }",
        language: "javascript",
      })
      .expect(200);

    expect(dsaRun.body.status).toBeDefined();

    const sandboxRes = await request(app)
      .post("/questions")
      .send({
        type: "SANDBOX",
        title: "Sandbox Echo",
        description: "Read an integer and output double",
        timeLimit: 2000,
        memoryLimit: 256,
        testCases: [
          { input: "5\n", expectedOutput: "10\n", isHidden: false, order: 0 },
        ],
      })
      .expect(201);

    const sandboxQuestionId = sandboxRes.body.id as string;
    const sandboxRun = await request(app)
      .post("/submissions/run")
      .send({
        questionId: sandboxQuestionId,
        code: "const fs = require('fs'); const n = parseInt(fs.readFileSync(0,'utf8').trim(),10); console.log(n*2);",
        language: "javascript",
      })
      .expect(200);

    expect(sandboxRun.body.status).toBeDefined();
    },
    { timeout: 20000 }
  );

  it(
    "submits coding question in contest and updates leaderboard",
    async () => {
      const codingRes = await request(app)
        .post("/questions")
      .send({
        type: "CODING",
        title: "Contest Two Sum",
        description: "Return indices of two numbers",
        functionName: "solution",
        timeLimit: 2000,
        memoryLimit: 256,
        testCases: [
          { input: "[[2,7,11,15],9]", expectedOutput: "[0,1]", isHidden: false, order: 0 },
          { input: "[[3,2,4],6]", expectedOutput: "[1,2]", isHidden: true, order: 1 },
        ],
      })
      .expect(201);

    const codingQuestionId = codingRes.body.id as string;

    const now = new Date();
    const contestRes = await request(app)
      .post("/contests")
      .send({
        title: "Coding Contest",
        description: "Coding contest",
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        questions: [
          { id: codingQuestionId, points: 25, timeLimit: 120 },
        ],
      })
      .expect(201);

    const contestId = contestRes.body.id as string;

    await request(app)
      .post(`/contest/${contestId}/join`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const correctCode = `function solution(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`;
    const submitRes = await request(app)
      .post("/submissions/contest")
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: codingQuestionId,
        contestId,
        code: correctCode,
        language: "javascript",
      })
      .expect(200);

    expect(submitRes.body.currentScore).toBeGreaterThan(0);
    expect(submitRes.body.currentRank).toBeGreaterThanOrEqual(1);

    const myEntry = await request(app)
      .get(`/contest/leaderboard/${contestId}/me`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(myEntry.body.score).toBe(submitRes.body.currentScore);
    expect(myEntry.body.rank).toBe(submitRes.body.currentRank);

    const wrongCode = `function solution(nums, target) { return [0,0]; }`;
    const submitWrong = await request(app)
      .post("/submissions/contest")
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: codingQuestionId,
        contestId,
        code: wrongCode,
        language: "javascript",
      })
      .expect(200);

    expect(submitWrong.body.currentScore).toBe(submitRes.body.currentScore);
    },
    { timeout: 20000 }
  );

  it("rejects practice submit without token", async () => {
    const codingRes = await request(app)
      .post("/questions")
      .send({
        type: "CODING",
        title: "Auth Guard",
        description: "Test auth",
        functionName: "solution",
        timeLimit: 2000,
        memoryLimit: 256,
        testCases: [
          { input: "[[1,2],3]", expectedOutput: "[0,1]", isHidden: false, order: 0 },
        ],
      })
      .expect(201);

    const codingQuestionId = codingRes.body.id as string;

    await request(app)
      .post("/submissions/practice")
      .send({
        questionId: codingQuestionId,
        code: "function solution(nums, target) { return [0,1]; }",
        language: "javascript",
      })
      .expect(401);
  });
});
