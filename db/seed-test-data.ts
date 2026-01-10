import "./prismaClient";
import { prisma } from "./prismaClient";
import bcrypt from "bcrypt";

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean up existing test data
  console.log("🧹 Cleaning up existing test data...");
  await prisma.leaderboardSnapshot.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.contestParticipant.deleteMany();
  await prisma.contestQuestion.deleteMany();
  await prisma.mcqOption.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany({ where: { email: "qa@test.com" } });

  // 1. Create test user
  console.log("👤 Creating test user...");
  const hashedPassword = await bcrypt.hash("test123", 10);
  const user = await prisma.user.create({
    data: {
      name: "QA Test User",
      email: "qa@test.com",
      password: hashedPassword,
      role: "USER",
    },
  });
  console.log(`✅ User created: ${user.id} (${user.email})`);

  // 2. Create MCQ question
  console.log("❓ Creating MCQ question...");
  const question = await prisma.question.create({
    data: {
      type: "MCQ",
      title: "What is 2 + 2?",
      description: "Basic arithmetic test",
    },
  });
  console.log(`✅ Question created: ${question.id}`);

  // 3. Create MCQ options
  console.log("📝 Creating MCQ options...");
  const correctOption = await prisma.mcqOption.create({
    data: {
      questionId: question.id,
      text: "4",
      isCorrect: true,
    },
  });
  const wrongOption = await prisma.mcqOption.create({
    data: {
      questionId: question.id,
      text: "5",
      isCorrect: false,
    },
  });
  console.log(`✅ Options created: ${correctOption.id} (correct), ${wrongOption.id} (wrong)`);

  // 4. Create active contest (starts now, ends in 5 minutes)
  console.log("🏆 Creating contest...");
  const now = new Date();
  const endTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

  const contest = await prisma.contest.create({
    data: {
      title: "QA Test Contest",
      description: "End-to-end runtime test",
      startAt: now,
      endAt: endTime,
      status: "ACTIVE",
    },
  });
  console.log(`✅ Contest created: ${contest.id} (ACTIVE, ends at ${endTime.toISOString()})`);

  // 5. Link question to contest
  console.log("🔗 Linking question to contest...");
  await prisma.contestQuestion.create({
    data: {
      contestId: contest.id,
      questionId: question.id,
      orderIndex: 0,
      points: 100,
      timeLimit: 60, // 60 seconds per question
    },
  });
  console.log("✅ Question linked to contest");

  // 6. Join user to contest
  console.log("👥 Joining user to contest...");
  await prisma.contestParticipant.create({
    data: {
      contestId: contest.id,
      userId: user.id,
    },
  });
  console.log("✅ User joined contest");

  console.log("\n🎉 Database seeding complete!");
  console.log("\n📊 Summary:");
  console.log(`   User ID: ${user.id}`);
  console.log(`   User Email: ${user.email}`);
  console.log(`   User Password: test123`);
  console.log(`   Contest ID: ${contest.id}`);
  console.log(`   Question ID: ${question.id}`);
  console.log(`   Correct Option ID: ${correctOption.id}`);
  console.log(`   Wrong Option ID: ${wrongOption.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
