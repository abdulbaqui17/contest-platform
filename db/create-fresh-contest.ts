import "./prismaClient";
import { prisma } from "./prismaClient";

async function createFreshContest() {
  console.log("🧹 Creating new test contest for verification...");

  // Create a contest that starts 5 seconds from now
  const now = new Date();
  const startTime = new Date(now.getTime() + 5000); // Start in 5 seconds
  const endTime = new Date(startTime.getTime() + 5 * 60 * 1000); // 5 minutes duration

  const contest = await prisma.contest.create({
    data: {
      title: "Live Verification Contest",
      description: "Real-time E2E verification test",
      startAt: startTime,
      endAt: endTime,
      status: "ACTIVE", // Will be ACTIVE immediately
    },
  });

  console.log(`✅ Contest created: ${contest.id}`);
  console.log(`   Starts at: ${startTime.toISOString()}`);
  console.log(`   Ends at: ${endTime.toISOString()}`);

  // Get the existing question
  const question = await prisma.question.findFirst({
    where: { type: "MCQ" },
  });

  if (!question) {
    throw new Error("No MCQ question found");
  }

  // Link question to contest
  await prisma.contestQuestion.create({
    data: {
      contestId: contest.id,
      questionId: question.id,
      orderIndex: 0,
      points: 100,
      timeLimit: 30, // 30 seconds
    },
  });

  console.log(`✅ Question linked: ${question.id}`);

  // Join test user to contest
  const user = await prisma.user.findUnique({
    where: { email: "qa@test.com" },
  });

  if (!user) {
    throw new Error("Test user not found");
  }

  await prisma.contestParticipant.create({
    data: {
      contestId: contest.id,
      userId: user.id,
    },
  });

  console.log(`✅ User joined: ${user.email}`);
  console.log(`\n📋 CONTEST ID: ${contest.id}`);
  console.log(`\nServer will auto-start this contest. Restart backend now!`);
}

createFreshContest()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
